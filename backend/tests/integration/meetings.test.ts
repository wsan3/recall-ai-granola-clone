import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

function getRequest(url: string) {
  return new NextRequest(url);
}

function patchRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/meetings", () => {
  it("lists meetings newest-first with note counts", async () => {
    const older = await prisma.meeting.create({
      data: { meetingTitle: "Older meeting", platform: "zoom", createdAt: new Date("2024-01-01") },
    });
    const newer = await prisma.meeting.create({
      data: {
        meetingTitle: "Newer meeting",
        platform: "google_meet",
        createdAt: new Date("2024-01-02"),
      },
    });
    await prisma.noteBlock.createMany({
      data: [
        { meetingId: newer.id, order: 0, source: "user", text: "note 1" },
        { meetingId: newer.id, order: 1, source: "ai", text: "note 2" },
      ],
    });

    const { GET } = await import("@/app/api/meetings/route");
    const response = await GET();
    const json = await response.json();

    expect(json.meetings.map((m: { id: string }) => m.id)).toEqual([newer.id, older.id]);
    expect(json.meetings[0].noteBlockCount).toBe(2);
    expect(json.meetings[1].noteBlockCount).toBe(0);
  });

  it("returns an empty list when there are no meetings", async () => {
    const { GET } = await import("@/app/api/meetings/route");
    const response = await GET();
    expect(await response.json()).toEqual({ meetings: [] });
  });
});

describe("GET /api/meetings/:id", () => {
  it("returns notes (with parsed citation ids) and utterances ordered by startMs", async () => {
    const meeting = await prisma.meeting.create({ data: { meetingTitle: "Detail test" } });
    const utterance = await prisma.utterance.create({
      data: { meetingId: meeting.id, speakerName: "Alex", text: "hello", startMs: 500 },
    });
    await prisma.utterance.create({
      data: { meetingId: meeting.id, speakerName: "Sam", text: "hi", startMs: 100 },
    });
    await prisma.noteBlock.create({
      data: {
        meetingId: meeting.id,
        order: 0,
        source: "ai",
        text: "Alex greeted the team.",
        sourceUtteranceIds: JSON.stringify([utterance.id]),
      },
    });

    const { GET } = await import("@/app/api/meetings/[id]/route");
    const response = await GET(getRequest(`http://localhost/api/meetings/${meeting.id}`), {
      params: Promise.resolve({ id: meeting.id }),
    });
    const json = await response.json();

    expect(json.meeting.id).toBe(meeting.id);
    expect(json.meeting.utterances.map((u: { text: string }) => u.text)).toEqual(["hi", "hello"]);
    expect(json.meeting.noteBlocks[0].sourceUtteranceIds).toEqual([utterance.id]);
  });

  it("returns 404 for a meeting that does not exist", async () => {
    const { GET } = await import("@/app/api/meetings/[id]/route");
    const response = await GET(getRequest("http://localhost/api/meetings/does-not-exist"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/meetings/:id", () => {
  it("renames a meeting", async () => {
    const meeting = await prisma.meeting.create({ data: { meetingTitle: "Old title" } });

    const { PATCH } = await import("@/app/api/meetings/[id]/route");
    const response = await PATCH(
      patchRequest(`http://localhost/api/meetings/${meeting.id}`, { meetingTitle: "New title" }),
      {
        params: Promise.resolve({ id: meeting.id }),
      }
    );

    expect(response.status).toBe(200);
    const updated = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(updated?.meetingTitle).toBe("New title");
  });

  it("rejects an empty title with 400", async () => {
    const meeting = await prisma.meeting.create({ data: { meetingTitle: "Old title" } });

    const { PATCH } = await import("@/app/api/meetings/[id]/route");
    const response = await PATCH(
      patchRequest(`http://localhost/api/meetings/${meeting.id}`, { meetingTitle: "   " }),
      {
        params: Promise.resolve({ id: meeting.id }),
      }
    );

    expect(response.status).toBe(400);
    const unchanged = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(unchanged?.meetingTitle).toBe("Old title");
  });

  it("returns 404 for a meeting that does not exist", async () => {
    const { PATCH } = await import("@/app/api/meetings/[id]/route");
    const response = await PATCH(
      patchRequest("http://localhost/api/meetings/does-not-exist", { meetingTitle: "x" }),
      {
        params: Promise.resolve({ id: "does-not-exist" }),
      }
    );
    expect(response.status).toBe(404);
  });
});
