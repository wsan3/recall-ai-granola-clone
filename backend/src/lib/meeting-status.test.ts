import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    meeting: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

describe("maybeMarkMeetingReady", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it("does nothing when the meeting does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const { maybeMarkMeetingReady } = await import("./meeting-status");

    await maybeMarkMeetingReady("missing");

    expect(update).not.toHaveBeenCalled();
  });

  it("does nothing when only the video has arrived (no note blocks yet)", async () => {
    findUnique.mockResolvedValue({ id: "m1", status: "processing", videoUrl: "https://example.com/video.mp4", noteBlocks: [] });
    const { maybeMarkMeetingReady } = await import("./meeting-status");

    await maybeMarkMeetingReady("m1");

    expect(update).not.toHaveBeenCalled();
  });

  it("does nothing when only notes have arrived (no video yet)", async () => {
    findUnique.mockResolvedValue({ id: "m1", status: "processing", videoUrl: null, noteBlocks: [{ id: "n1" }] });
    const { maybeMarkMeetingReady } = await import("./meeting-status");

    await maybeMarkMeetingReady("m1");

    expect(update).not.toHaveBeenCalled();
  });

  it("marks the meeting ready once both video and notes are present", async () => {
    findUnique.mockResolvedValue({
      id: "m1",
      status: "processing",
      videoUrl: "https://example.com/video.mp4",
      noteBlocks: [{ id: "n1" }],
    });
    const { maybeMarkMeetingReady } = await import("./meeting-status");

    await maybeMarkMeetingReady("m1");

    expect(update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { status: "ready" } });
  });

  it("is a no-op if the meeting is already ready or failed", async () => {
    findUnique.mockResolvedValue({
      id: "m1",
      status: "ready",
      videoUrl: "https://example.com/video.mp4",
      noteBlocks: [{ id: "n1" }],
    });
    const { maybeMarkMeetingReady } = await import("./meeting-status");

    await maybeMarkMeetingReady("m1");

    expect(update).not.toHaveBeenCalled();
  });
});
