import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/recall", () => ({
  createSdkUpload: vi.fn().mockResolvedValue({ id: "up_test_1", upload_token: "tok_test_1" }),
}));

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/sdk-uploads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sdk-uploads", () => {
  it("creates a Meeting with the SDK upload id and window metadata, and returns the upload token", async () => {
    const { POST } = await import("@/app/api/sdk-uploads/route");

    const response = await POST(
      postRequest({ windowId: "w1", title: "Weekly Sync", url: "https://meet.google.com/abc", platform: "google_meet" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ id: "up_test_1", upload_token: "tok_test_1", meeting_id: expect.any(String) });

    const meeting = await prisma.meeting.findUnique({ where: { id: json.meeting_id } });
    expect(meeting).toMatchObject({
      sdkUploadId: "up_test_1",
      status: "recording",
      windowId: "w1",
      meetingTitle: "Weekly Sync",
      meetingUrl: "https://meet.google.com/abc",
      platform: "google_meet",
    });
  });

  it("still creates a Meeting when no window metadata is provided", async () => {
    const { POST } = await import("@/app/api/sdk-uploads/route");

    const response = await POST(postRequest({}));
    const json = await response.json();

    expect(response.status).toBe(200);
    const meeting = await prisma.meeting.findUnique({ where: { id: json.meeting_id } });
    expect(meeting?.meetingTitle).toBeNull();
  });

  it("returns 502 when Recall's Create Desktop SDK Upload call fails", async () => {
    const { createSdkUpload } = await import("@/lib/recall");
    vi.mocked(createSdkUpload).mockRejectedValueOnce(new Error("Create Desktop SDK Upload failed: 500"));

    const { POST } = await import("@/app/api/sdk-uploads/route");
    const response = await POST(postRequest({}));

    expect(response.status).toBe(502);
    expect(await prisma.meeting.count()).toBe(0);
  });
});
