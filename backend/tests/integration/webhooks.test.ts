import crypto from "crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/recall", () => ({
  retrieveRecording: vi.fn(),
}));

const SECRET = process.env.RECALL_WORKSPACE_VERIFICATION_SECRET as string;

function sign(msgId: string, timestamp: string, payload: string): string {
  const key = Buffer.from(SECRET.slice("whsec_".length), "base64");
  const sig = crypto
    .createHmac("sha256", key)
    .update(`${msgId}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${sig}`;
}

function webhookRequest(payload: object, { signed = true }: { signed?: boolean } = {}) {
  const body = JSON.stringify(payload);
  const msgId = "msg_1";
  const timestamp = String(Math.floor(Date.now() / 1000));

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) {
    headers["webhook-id"] = msgId;
    headers["webhook-timestamp"] = timestamp;
    headers["webhook-signature"] = sign(msgId, timestamp, body);
  }

  return new NextRequest("http://localhost/api/webhooks/recall", { method: "POST", headers, body });
}

function lifecyclePayload(event: string, overrides: { sdkUploadId: string; recordingId: string }) {
  return {
    event,
    data: {
      data: { code: "done", sub_code: null, updated_at: new Date().toISOString() },
      recording: { id: overrides.recordingId, metadata: {} },
      sdk_upload: { id: overrides.sdkUploadId, metadata: {} },
    },
  };
}

describe("POST /api/webhooks/recall", () => {
  it("rejects a request with an invalid signature", async () => {
    const { POST } = await import("@/app/api/webhooks/recall/route");
    const payload = lifecyclePayload("sdk_upload.complete", {
      sdkUploadId: "up_1",
      recordingId: "rec_1",
    });
    const request = webhookRequest(payload, { signed: false });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("acknowledges but no-ops when no Meeting matches the sdk_upload id", async () => {
    const { POST } = await import("@/app/api/webhooks/recall/route");
    const payload = lifecyclePayload("sdk_upload.complete", {
      sdkUploadId: "unknown_upload",
      recordingId: "rec_1",
    });

    const response = await POST(webhookRequest(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("on sdk_upload.complete, fetches and stores the mixed video URL and marks the meeting ready when notes already exist", async () => {
    const { retrieveRecording } = await import("@/lib/recall");
    vi.mocked(retrieveRecording).mockResolvedValue({
      id: "rec_1",
      media_shortcuts: { video_mixed: { data: { download_url: "https://example.com/video.mp4" } } },
    });

    const meeting = await prisma.meeting.create({
      data: { sdkUploadId: "up_1", status: "recording" },
    });
    await prisma.noteBlock.create({
      data: { meetingId: meeting.id, order: 0, source: "user", text: "note" },
    });

    const { POST } = await import("@/app/api/webhooks/recall/route");
    const payload = lifecyclePayload("sdk_upload.complete", {
      sdkUploadId: "up_1",
      recordingId: "rec_1",
    });
    const response = await POST(webhookRequest(payload));

    expect(response.status).toBe(200);
    const updated = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(updated?.videoUrl).toBe("https://example.com/video.mp4");
    expect(updated?.status).toBe("ready");
  });

  it("treats sdk_upload.completed as an alias of sdk_upload.complete", async () => {
    const { retrieveRecording } = await import("@/lib/recall");
    vi.mocked(retrieveRecording).mockResolvedValue({
      id: "rec_2",
      media_shortcuts: {
        video_mixed: { data: { download_url: "https://example.com/video2.mp4" } },
      },
    });

    const meeting = await prisma.meeting.create({
      data: { sdkUploadId: "up_2", status: "recording" },
    });

    const { POST } = await import("@/app/api/webhooks/recall/route");
    const payload = lifecyclePayload("sdk_upload.completed", {
      sdkUploadId: "up_2",
      recordingId: "rec_2",
    });
    await POST(webhookRequest(payload));

    const updated = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(updated?.videoUrl).toBe("https://example.com/video2.mp4");
  });

  it("leaves videoUrl unset (not a hard failure) when the recording has no video_mixed yet", async () => {
    const { retrieveRecording } = await import("@/lib/recall");
    vi.mocked(retrieveRecording).mockResolvedValue({ id: "rec_3", media_shortcuts: {} });

    const meeting = await prisma.meeting.create({
      data: { sdkUploadId: "up_3", status: "recording" },
    });

    const { POST } = await import("@/app/api/webhooks/recall/route");
    const payload = lifecyclePayload("sdk_upload.complete", {
      sdkUploadId: "up_3",
      recordingId: "rec_3",
    });
    const response = await POST(webhookRequest(payload));

    expect(response.status).toBe(200);
    const updated = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(updated?.videoUrl).toBeNull();
    expect(updated?.status).toBe("processing");
  });

  it("marks the meeting failed on sdk_upload.failed", async () => {
    const meeting = await prisma.meeting.create({
      data: { sdkUploadId: "up_4", status: "recording" },
    });

    const { POST } = await import("@/app/api/webhooks/recall/route");
    const payload = lifecyclePayload("sdk_upload.failed", {
      sdkUploadId: "up_4",
      recordingId: "rec_4",
    });
    await POST(webhookRequest(payload));

    const updated = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(updated?.status).toBe("failed");
  });

  it("moves the meeting to processing on sdk_upload.uploading", async () => {
    const meeting = await prisma.meeting.create({
      data: { sdkUploadId: "up_5", status: "recording" },
    });

    const { POST } = await import("@/app/api/webhooks/recall/route");
    const payload = lifecyclePayload("sdk_upload.uploading", {
      sdkUploadId: "up_5",
      recordingId: "rec_5",
    });
    await POST(webhookRequest(payload));

    const updated = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(updated?.status).toBe("processing");
    expect(updated?.endedAt).not.toBeNull();
  });
});
