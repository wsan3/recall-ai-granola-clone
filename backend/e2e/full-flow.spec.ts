import crypto from "crypto";
import { expect, test } from "@playwright/test";
import { E2E_WEBHOOK_SECRET } from "../playwright.config";

/**
 * Drives the full meeting lifecycle as a real HTTP client against a live
 * `next dev` server: create -> finish (synthesis) -> webhook (video ready)
 * -> list/detail/rename. `E2E_TEST=1` (set on the server, see
 * playwright.config.ts) makes the Recall/OpenAI calls inside that flow
 * return canned data instead of hitting real third-party APIs.
 */

function signWebhook(msgId: string, timestamp: string, payload: string): string {
  const key = Buffer.from(E2E_WEBHOOK_SECRET.slice("whsec_".length), "base64");
  const sig = crypto
    .createHmac("sha256", key)
    .update(`${msgId}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${sig}`;
}

function webhookHeaders(payload: string) {
  const msgId = `e2e-msg-${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    "content-type": "application/json",
    "webhook-id": msgId,
    "webhook-timestamp": timestamp,
    "webhook-signature": signWebhook(msgId, timestamp, payload),
  };
}

test("full meeting lifecycle: create, finish, webhook, list, detail, rename", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).status).toBe("ok");

  const created = await request.post("/api/sdk-uploads", {
    data: {
      windowId: "w-e2e",
      title: "E2E Standup",
      url: "https://meet.google.com/e2e",
      platform: "google_meet",
    },
  });
  expect(created.ok()).toBeTruthy();
  const {
    id: sdkUploadId,
    meeting_id: meetingId,
    upload_token: uploadToken,
  } = await created.json();
  expect(meetingId).toBeTruthy();
  expect(uploadToken).toBe("e2e_upload_token");

  const finished = await request.post(`/api/meetings/${meetingId}/finish`, {
    data: {
      notes: "Ship the release Friday.",
      utterances: [
        { speakerName: "Alex", text: "Let's ship Friday.", startMs: 100, endMs: 900 },
        { speakerName: "Sam", text: "Agreed.", startMs: 1000, endMs: 1400 },
      ],
      participantEvents: [{ type: "join", participantName: "Alex" }],
    },
  });
  expect(finished.ok()).toBeTruthy();
  expect(await finished.json()).toEqual({ received: true });

  const listAfterFinish = await (await request.get("/api/meetings")).json();
  const listedMeeting = listAfterFinish.meetings.find((m: { id: string }) => m.id === meetingId);
  expect(listedMeeting).toBeTruthy();
  // finish() only persists the transcript/notes - status only moves once the
  // sdk_upload.* webhook below arrives with the video.
  expect(listedMeeting.status).toBe("recording");
  expect(listedMeeting.noteBlockCount).toBeGreaterThan(0);

  const webhookPayload = JSON.stringify({
    event: "sdk_upload.complete",
    data: {
      data: { code: "done", sub_code: null, updated_at: new Date().toISOString() },
      recording: { id: "e2e-recording-1", metadata: {} },
      sdk_upload: { id: sdkUploadId, metadata: {} },
    },
  });
  const webhookResponse = await request.post("/api/webhooks/recall", {
    headers: webhookHeaders(webhookPayload),
    data: webhookPayload,
  });
  expect(webhookResponse.ok()).toBeTruthy();

  const detail = await (await request.get(`/api/meetings/${meetingId}`)).json();
  expect(detail.meeting.status).toBe("ready");
  expect(detail.meeting.videoUrl).toBe("https://example.com/e2e-fake-video.mp4");
  expect(detail.meeting.utterances).toHaveLength(2);
  const userBlock = detail.meeting.noteBlocks.find((b: { source: string }) => b.source === "user");
  const aiBlock = detail.meeting.noteBlocks.find((b: { source: string }) => b.source === "ai");
  expect(userBlock.text).toBe("Ship the release Friday.");
  expect(aiBlock.text).toContain("[e2e-fake]");
  expect(aiBlock.sourceUtteranceIds).toHaveLength(2);

  const renamed = await request.patch(`/api/meetings/${meetingId}`, {
    data: { meetingTitle: "Renamed via E2E" },
  });
  expect(renamed.ok()).toBeTruthy();
  const detailAfterRename = await (await request.get(`/api/meetings/${meetingId}`)).json();
  expect(detailAfterRename.meeting.meetingTitle).toBe("Renamed via E2E");
});

test("rejects a webhook with an invalid signature", async ({ request }) => {
  const payload = JSON.stringify({
    event: "sdk_upload.failed",
    data: {
      data: { code: "error", sub_code: null, updated_at: new Date().toISOString() },
      recording: { id: "x", metadata: {} },
      sdk_upload: { id: "x", metadata: {} },
    },
  });

  const response = await request.post("/api/webhooks/recall", {
    headers: {
      "content-type": "application/json",
      "webhook-id": "bad-msg",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,not-a-real-signature",
    },
    data: payload,
  });

  expect(response.status()).toBe(401);
});

test("returns 404 for a meeting that does not exist", async ({ request }) => {
  const response = await request.get("/api/meetings/does-not-exist");
  expect(response.status()).toBe(404);
});
