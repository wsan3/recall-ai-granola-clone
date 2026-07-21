import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Powers the Electron app's Meeting Detail view (notes + transcript + video). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      noteBlocks: { orderBy: { order: "asc" } },
      utterances: { orderBy: { startMs: "asc" } },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json({
    meeting: {
      id: meeting.id,
      meetingTitle: meeting.meetingTitle,
      platform: meeting.platform,
      meetingUrl: meeting.meetingUrl,
      status: meeting.status,
      videoUrl: meeting.videoUrl,
      createdAt: meeting.createdAt,
      endedAt: meeting.endedAt,
      noteBlocks: meeting.noteBlocks.map((block) => ({
        id: block.id,
        order: block.order,
        source: block.source,
        text: block.text,
        sourceUtteranceIds: JSON.parse(block.sourceUtteranceIds) as string[],
      })),
      utterances: meeting.utterances.map((utterance) => ({
        id: utterance.id,
        speakerName: utterance.speakerName,
        text: utterance.text,
        startMs: utterance.startMs,
        endMs: utterance.endMs,
      })),
    },
  });
}
