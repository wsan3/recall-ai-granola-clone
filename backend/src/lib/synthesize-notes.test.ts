import { beforeEach, describe, expect, it, vi } from "vitest";

const parseMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { parse: (...args: unknown[]) => parseMock(...args) } };
    },
  };
});

const ORIGINAL_ENV = { ...process.env };

describe("synthesizeNoteBlocks", () => {
  beforeEach(() => {
    vi.resetModules();
    parseMock.mockReset();
    process.env = { ...ORIGINAL_ENV, OPENAI_API_KEY: "test-key" };
  });

  it("returns an empty array without calling OpenAI when there are no utterances", async () => {
    const { synthesizeNoteBlocks } = await import("./synthesize-notes");

    const result = await synthesizeNoteBlocks({ userNotes: "some notes", utterances: [] });

    expect(result).toEqual([]);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;
    const { synthesizeNoteBlocks } = await import("./synthesize-notes");

    await expect(
      synthesizeNoteBlocks({
        userNotes: "",
        utterances: [{ index: 0, speakerName: "Alex", text: "hi" }],
      })
    ).rejects.toThrow(/OPENAI_API_KEY/);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("builds a numbered transcript block and returns the parsed note blocks", async () => {
    parseMock.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              noteBlocks: [
                { text: "The team agreed to ship by Friday.", sourceUtteranceIndexes: [0, 1] },
              ],
            },
          },
        },
      ],
    });

    const { synthesizeNoteBlocks } = await import("./synthesize-notes");
    const result = await synthesizeNoteBlocks({
      userNotes: "quick notes",
      utterances: [
        { index: 0, speakerName: "Alex", text: "Let's ship by Friday." },
        { index: 1, speakerName: "Sam", text: "Sounds good." },
      ],
    });

    expect(result).toEqual([
      { text: "The team agreed to ship by Friday.", sourceUtteranceIndexes: [0, 1] },
    ]);

    const [callArgs] = parseMock.mock.calls[0];
    expect(callArgs.model).toBe("gpt-4o-mini");
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === "user").content;
    expect(userMessage).toContain("[0] Alex: Let's ship by Friday.");
    expect(userMessage).toContain("[1] Sam: Sounds good.");
    expect(userMessage).toContain("quick notes");
  });

  it("falls back to a placeholder when the user typed no notes", async () => {
    parseMock.mockResolvedValue({ choices: [{ message: { parsed: { noteBlocks: [] } } }] });
    const { synthesizeNoteBlocks } = await import("./synthesize-notes");

    await synthesizeNoteBlocks({
      userNotes: "   ",
      utterances: [{ index: 0, speakerName: null, text: "hello" }],
    });

    const [callArgs] = parseMock.mock.calls[0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === "user").content;
    expect(userMessage).toContain("didn't type any notes");
  });

  it("respects OPENAI_MODEL when set", async () => {
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    parseMock.mockResolvedValue({ choices: [{ message: { parsed: { noteBlocks: [] } } }] });

    const { synthesizeNoteBlocks } = await import("./synthesize-notes");
    await synthesizeNoteBlocks({
      userNotes: "",
      utterances: [{ index: 0, speakerName: null, text: "hi" }],
    });

    const [callArgs] = parseMock.mock.calls[0];
    expect(callArgs.model).toBe("gpt-4.1-mini");
  });

  it("returns an empty array if the response has no parsed note blocks", async () => {
    parseMock.mockResolvedValue({ choices: [{ message: {} }] });
    const { synthesizeNoteBlocks } = await import("./synthesize-notes");

    const result = await synthesizeNoteBlocks({
      userNotes: "",
      utterances: [{ index: 0, speakerName: null, text: "hi" }],
    });

    expect(result).toEqual([]);
  });
});
