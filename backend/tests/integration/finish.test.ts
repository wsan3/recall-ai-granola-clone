import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/synthesize-notes", () => ({
  synthesizeNoteBlocks: vi.fn(),
}));

function postRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callFinish(meetingId: string, body: unknown) {
  const { POST } = await import("@/app/api/meetings/[id]/finish/route");
  return POST(postRequest(`http://localhost/api/meetings/${meetingId}/finish`, body), {
    params: Promise.resolve({ id: meetingId }),
  });
}

describe("POST /api/meetings/:id/finish", () => {
  it("persists utterances, participant events, and user notes, then stores AI note blocks mapped to utterance ids", async () => {
    const { synthesizeNoteBlocks } = await import("@/lib/synthesize-notes");
    vi.mocked(synthesizeNoteBlocks).mockResolvedValue([
      { text: "The team agreed to ship Friday.", sourceUtteranceIndexes: [0, 1] },
    ]);

    const meeting = await prisma.meeting.create({ data: { status: "processing" } });

    const response = await callFinish(meeting.id, {
      notes: "Quick notes\n\nSecond paragraph",
      utterances: [
        { speakerName: "Alex", text: "Let's ship Friday.", startMs: 100, endMs: null },
        { speakerName: "Sam", text: "Sounds good.", startMs: 200, endMs: null },
      ],
      participantEvents: [{ type: "join", participantName: "Alex" }],
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });

    const utterances = await prisma.utterance.findMany({ where: { meetingId: meeting.id }, orderBy: { startMs: "asc" } });
    expect(utterances).toHaveLength(2);

    const participantEvents = await prisma.participantEvent.findMany({ where: { meetingId: meeting.id } });
    expect(participantEvents).toHaveLength(1);

    const noteBlocks = await prisma.noteBlock.findMany({ where: { meetingId: meeting.id }, orderBy: { order: "asc" } });
    expect(noteBlocks).toHaveLength(3); // 2 user paragraphs + 1 AI block
    expect(noteBlocks[0]).toMatchObject({ source: "user", text: "Quick notes" });
    expect(noteBlocks[1]).toMatchObject({ source: "user", text: "Second paragraph" });
    expect(noteBlocks[2].source).toBe("ai");
    expect(JSON.parse(noteBlocks[2].sourceUtteranceIds)).toEqual(utterances.map((u) => u.id));
  });

  it("returns synthesisFailed but keeps the persisted transcript when OpenAI fails", async () => {
    const { synthesizeNoteBlocks } = await import("@/lib/synthesize-notes");
    vi.mocked(synthesizeNoteBlocks).mockRejectedValue(new Error("OpenAI is down"));

    const meeting = await prisma.meeting.create({ data: { status: "processing" } });

    const response = await callFinish(meeting.id, {
      notes: "My notes",
      utterances: [{ speakerName: "Alex", text: "hello", startMs: 0, endMs: null }],
      participantEvents: [],
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true, synthesisFailed: true });

    expect(await prisma.utterance.count({ where: { meetingId: meeting.id } })).toBe(1);
    const userBlocks = await prisma.noteBlock.findMany({ where: { meetingId: meeting.id, source: "user" } });
    expect(userBlocks).toHaveLength(1);
    const aiBlocks = await prisma.noteBlock.findMany({ where: { meetingId: meeting.id, source: "ai" } });
    expect(aiBlocks).toHaveLength(0);

    const unchanged = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(unchanged?.status).toBe("processing");
  });

  it("marks the meeting ready when the video URL is already present", async () => {
    const { synthesizeNoteBlocks } = await import("@/lib/synthesize-notes");
    vi.mocked(synthesizeNoteBlocks).mockResolvedValue([]);

    const meeting = await prisma.meeting.create({
      data: { status: "processing", videoUrl: "https://example.com/video.mp4" },
    });

    await callFinish(meeting.id, { notes: "notes", utterances: [], participantEvents: [] });

    const updated = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(updated?.status).toBe("ready");
  });

  it("returns 404 for a meeting that does not exist", async () => {
    const response = await callFinish("does-not-exist", { notes: "", utterances: [], participantEvents: [] });
    expect(response.status).toBe(404);
  });
});
