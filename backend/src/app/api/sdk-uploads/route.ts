import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSdkUpload } from "@/lib/recall";

/**
 * Called by the Electron app right after it detects a meeting. Proxies Recall's
 * Create Desktop SDK Upload endpoint (keeping RECALL_API_KEY server-side, out of
 * the desktop client) and creates the local Meeting record the rest of the app
 * hangs off of.
 */
export async function POST() {
  let upload: { id: string; upload_token: string };
  try {
    upload = await createSdkUpload();
  } catch (error) {
    console.error("[sdk-uploads] Create Desktop SDK Upload failed", error);
    return NextResponse.json(
      { error: "Failed to create Recall SDK upload" },
      { status: 502 }
    );
  }

  const meeting = await prisma.meeting.create({
    data: {
      sdkUploadId: upload.id,
      status: "recording",
    },
  });

  return NextResponse.json({
    id: upload.id,
    upload_token: upload.upload_token,
    meeting_id: meeting.id,
  });
}
