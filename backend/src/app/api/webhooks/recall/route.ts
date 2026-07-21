import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequestFromRecall } from "@/lib/verify-recall-request";

type SdkUploadLifecyclePayload = {
  // Only complete/failed/uploading are actually subscribable in the dashboard
  // today. recording_started/recording_ended are documented (with full
  // payload examples) but not offered in the subscription UI - see
  // docs/recall-doc-gaps.md #4. Handled here defensively in case a workspace
  // does receive them.
  //
  // A live test also produced a *second*, distinct delivery for the same
  // sdk_upload/recording with event: "sdk_upload.completed" (trailing "d"),
  // undocumented anywhere alongside "sdk_upload.complete" - see
  // docs/recall-doc-gaps.md #5. Treated as an alias below.
  event:
    | "sdk_upload.complete"
    | "sdk_upload.completed"
    | "sdk_upload.failed"
    | "sdk_upload.uploading"
    | "sdk_upload.recording_started"
    | "sdk_upload.recording_ended";
  data: {
    data: { code: string; sub_code: string | null; updated_at: string };
    recording: { id: string; metadata: Record<string, unknown> };
    sdk_upload: { id: string; metadata: Record<string, unknown> };
  };
};

/**
 * Receives the Svix-delivered `sdk_upload.*` lifecycle webhooks (dashboard
 * webhook subscription), the async counterpart to the desktop_sdk_callback
 * real-time events. See docs/architecture.md for how these fit together.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers: Record<string, string | null> = {
    "webhook-id": request.headers.get("webhook-id"),
    "webhook-timestamp": request.headers.get("webhook-timestamp"),
    "webhook-signature": request.headers.get("webhook-signature"),
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  };

  const secret = process.env.RECALL_WORKSPACE_VERIFICATION_SECRET;
  if (!secret) {
    console.error("[webhooks/recall] RECALL_WORKSPACE_VERIFICATION_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    verifyRequestFromRecall({ secret, headers, payload: rawBody });
  } catch (error) {
    console.warn("[webhooks/recall] Signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as SdkUploadLifecyclePayload;
  const { event, data } = payload;
  const sdkUploadId = data.sdk_upload.id;
  const recordingId = data.recording.id;

  console.log(`[webhooks/recall] ${event} for sdk_upload=${sdkUploadId} recording=${recordingId}`);

  const meeting = await prisma.meeting.findUnique({ where: { sdkUploadId } });
  if (!meeting) {
    console.warn(`[webhooks/recall] No Meeting found for sdk_upload=${sdkUploadId}`);
    return NextResponse.json({ received: true });
  }

  switch (event) {
    case "sdk_upload.recording_started":
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { recordingId, status: "recording" },
      });
      break;
    case "sdk_upload.recording_ended":
    case "sdk_upload.uploading":
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { recordingId, status: "processing", endedAt: new Date() },
      });
      break;
    case "sdk_upload.complete":
    case "sdk_upload.completed":
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { recordingId, status: "processing" },
      });
      break;
    case "sdk_upload.failed":
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { recordingId, status: "failed" },
      });
      break;
  }

  return NextResponse.json({ received: true });
}
