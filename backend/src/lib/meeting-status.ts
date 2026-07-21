import { prisma } from "./prisma";

/**
 * A Meeting reaches "ready" via two independent async paths that can finish
 * in either order: the Electron app's POST .../finish (produces NoteBlocks)
 * and the sdk_upload.complete[/.completed] webhook (produces videoUrl).
 * Call this after either one completes; it only flips status to "ready"
 * once both are present.
 */
export async function maybeMarkMeetingReady(meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { noteBlocks: { select: { id: true }, take: 1 } },
  });
  if (!meeting || meeting.status === "ready" || meeting.status === "failed") {
    return;
  }

  const hasVideo = Boolean(meeting.videoUrl);
  const hasNotes = meeting.noteBlocks.length > 0;
  if (hasVideo && hasNotes) {
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "ready" } });
  }
}
