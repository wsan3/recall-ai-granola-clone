import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSdkUpload } from "@/lib/recall";

type SdkUploadRequestBody = {
  windowId?: string;
  title?: string;
  url?: string;
  platform?: string;
};

/**
 * Called by the Electron app right after it detects a meeting. Proxies Recall's
 * Create Desktop SDK Upload endpoint (keeping RECALL_API_KEY server-side, out of
 * the desktop client) and creates the local Meeting record the rest of the app
 * hangs off of. The request body carries the SDK's own window metadata
 * (title/url/platform) so the Past Meetings list has something better than
 * "Untitled meeting" to show.
 */
export async function POST(request: NextRequest) {
  let upload: { id: string; upload_token: string };
  try {
    upload = await createSdkUpload();
  } catch (error) {
    console.error("[sdk-uploads] Create Desktop SDK Upload failed", error);
    return NextResponse.json({ error: "Failed to create Recall SDK upload" }, { status: 502 });
  }

  const body = (await request.json().catch(() => ({}))) as SdkUploadRequestBody;

  const meeting = await prisma.meeting.create({
    data: {
      sdkUploadId: upload.id,
      status: "recording",
      windowId: body.windowId,
      meetingTitle: body.title,
      meetingUrl: body.url,
      platform: body.platform,
    },
  });

  return NextResponse.json({
    id: upload.id,
    upload_token: upload.upload_token,
    meeting_id: meeting.id,
  });
}
