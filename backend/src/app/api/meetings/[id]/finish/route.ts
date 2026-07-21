import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { synthesizeNoteBlocks, type SynthesisUtteranceInput } from "@/lib/synthesize-notes";
import { maybeMarkMeetingReady } from "@/lib/meeting-status";

type FinishRequestBody = {
  notes: string;
  utterances: {
    speakerName: string | null;
    text: string;
    startMs: number | null;
    endMs: number | null;
  }[];
  participantEvents: {
    type: string;
    participantName: string | null;
  }[];
};

/**
 * Called by the Electron app once a meeting ends (recording-ended /
 * meeting-closed). Persists the client-collected transcript + participant
 * events, then runs the OpenAI synthesis pass to produce AI NoteBlocks that
 * cite back to specific utterances. See docs/architecture.md.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const body = (await request.json()) as FinishRequestBody;

  // Persist the raw transcript/participant events first so this data
  // survives even if the OpenAI pass below fails (e.g. a provider outage).
  const createdUtterances = await Promise.all(
    body.utterances.map((u) =>
      prisma.utterance.create({
        data: {
          meetingId,
          speakerName: u.speakerName,
          text: u.text,
          startMs: u.startMs ?? 0,
          endMs: u.endMs,
        },
      })
    )
  );

  if (body.participantEvents.length > 0) {
    await prisma.participantEvent.createMany({
      data: body.participantEvents.map((e) => ({
        meetingId,
        type: e.type,
        participantName: e.participantName,
      })),
    });
  }

  let order = 0;
  const userBlocks = body.notes
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  for (const text of userBlocks) {
    await prisma.noteBlock.create({
      data: { meetingId, order: order++, source: "user", text, sourceUtteranceIds: "[]" },
    });
  }

  const synthesisInput: SynthesisUtteranceInput[] = createdUtterances.map((u, index) => ({
    index,
    speakerName: u.speakerName,
    text: u.text,
  }));

  try {
    const aiBlocks = await synthesizeNoteBlocks({ userNotes: body.notes, utterances: synthesisInput });
    for (const block of aiBlocks) {
      const utteranceIds = block.sourceUtteranceIndexes
        .map((i) => createdUtterances[i]?.id)
        .filter((id): id is string => Boolean(id));
      await prisma.noteBlock.create({
        data: {
          meetingId,
          order: order++,
          source: "ai",
          text: block.text,
          sourceUtteranceIds: JSON.stringify(utteranceIds),
        },
      });
    }
  } catch (error) {
    console.error(`[meetings/finish] OpenAI synthesis failed for meeting=${meetingId}`, error);
    // Transcript/user notes are already persisted above; the meeting just
    // won't have AI-authored blocks yet. Status is left as-is (not "ready")
    // so the gap is visible instead of silently swallowed.
    return NextResponse.json({ received: true, synthesisFailed: true });
  }

  await maybeMarkMeetingReady(meetingId);

  return NextResponse.json({ received: true });
}
