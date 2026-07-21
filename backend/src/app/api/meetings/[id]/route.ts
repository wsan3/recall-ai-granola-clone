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

type PatchMeetingBody = {
  meetingTitle?: string;
};

/**
 * Lets the user rename a meeting from the Meeting Detail view - the SDK's
 * own window title (e.g. a generic "Zoom Meeting") isn't always a useful
 * name, and some platforms/windows don't carry one at all.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as PatchMeetingBody;

  const meetingTitle = body.meetingTitle?.trim();
  if (!meetingTitle) {
    return NextResponse.json({ error: "meetingTitle is required" }, { status: 400 });
  }

  try {
    const meeting = await prisma.meeting.update({
      where: { id },
      data: { meetingTitle },
    });
    return NextResponse.json({ meeting: { id: meeting.id, meetingTitle: meeting.meetingTitle } });
  } catch (error) {
    console.error(`[meetings/:id] Failed to update meeting=${id}`, error);
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
}
