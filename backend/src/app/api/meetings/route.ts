import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Powers the Electron app's Past Meetings list. */
export async function GET() {
  const meetings = await prisma.meeting.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { noteBlocks: true } } },
  });

  return NextResponse.json({
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      meetingTitle: meeting.meetingTitle,
      platform: meeting.platform,
      meetingUrl: meeting.meetingUrl,
      status: meeting.status,
      videoUrl: meeting.videoUrl,
      createdAt: meeting.createdAt,
      endedAt: meeting.endedAt,
      noteBlockCount: meeting._count.noteBlocks,
    })),
  });
}
