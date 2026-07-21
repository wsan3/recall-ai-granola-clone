/**
 * Turns the raw meeting transcript + the user's own quick notes into
 * structured NoteBlocks via OpenAI structured outputs. AI-authored blocks
 * cite the transcript line indexes they were derived from, which the caller
 * maps back to Utterance ids to power the "click a note, jump to that
 * moment" citation feature.
 */
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const NoteBlockSchema = z.object({
  text: z.string(),
  sourceUtteranceIndexes: z.array(z.number().int()),
});

const SynthesisResultSchema = z.object({
  noteBlocks: z.array(NoteBlockSchema),
});

export type SynthesizedNoteBlock = z.infer<typeof NoteBlockSchema>;

export type SynthesisUtteranceInput = {
  index: number;
  speakerName: string | null;
  text: string;
};

function assertConfigured(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY must be set (see backend/.env.example).");
  }
  return key;
}

function buildTranscriptBlock(utterances: SynthesisUtteranceInput[]): string {
  return utterances.map((u) => `[${u.index}] ${u.speakerName ?? "Unknown"}: ${u.text}`).join("\n");
}

export async function synthesizeNoteBlocks(params: {
  userNotes: string;
  utterances: SynthesisUtteranceInput[];
}): Promise<SynthesizedNoteBlock[]> {
  // Nothing to expand on without a transcript - skip the API call entirely.
  if (params.utterances.length === 0) {
    return [];
  }

  const apiKey = assertConfigured();
  const client = new OpenAI({ apiKey });

  const notesBlock = params.userNotes.trim() || "(the user didn't type any notes during the call)";
  const transcriptBlock = buildTranscriptBlock(params.utterances);

  const completion = await client.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a meeting notes assistant. Given a raw call transcript (numbered lines) and a user's own " +
          "rough notes, produce a concise set of structured note blocks that expand on what happened in the " +
          "meeting - decisions, action items, and key discussion points the user's own notes only hint at. " +
          "Every note block you write MUST cite the transcript line numbers via the sourceUtteranceIndexes " +
          "field. Never mention line numbers, indices, or the word 'lines' inside the note text itself - the " +
          "text field is user-facing prose and citations belong only in sourceUtteranceIndexes. Do not invent " +
          "facts not present in the transcript. Keep each block to 1-2 sentences. Do not restate the user's " +
          "own notes verbatim - only add what the transcript reveals beyond them.",
      },
      {
        role: "user",
        content: `User's own notes:\n${notesBlock}\n\nTranscript:\n${transcriptBlock}`,
      },
    ],
    response_format: zodResponseFormat(SynthesisResultSchema, "synthesis_result"),
  });

  return completion.choices[0]?.message?.parsed?.noteBlocks ?? [];
}
