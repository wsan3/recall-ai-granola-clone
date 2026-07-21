export type SessionPhase =
  | "initializing"
  | "waiting-for-meeting"
  | "starting-recording"
  | "recording"
  | "ended"
  | "synthesizing"
  | "done"
  | "error";

export type Participant = {
  id: string;
  name: string | null;
};

export type TranscriptLine = {
  id: string;
  participant: Participant | null;
  text: string;
  isPartial: boolean;
  /**
   * Milliseconds since recording started, captured client-side when the
   * line was finalized. Recall's realtime-event payloads don't document a
   * word-level timestamp for desktop_sdk_callback (see
   * docs/recall-doc-gaps.md), so this is an approximation - good enough for
   * "jump to roughly this moment" video-seek citations, not frame-accurate.
   */
  atMs: number | null;
};

/**
 * A raw participant lifecycle event, collected for POST .../finish. `atMs` is
 * measured the same approximate way as TranscriptLine.atMs.
 */
export type ParticipantEventEntry = {
  type: "join" | "update" | "speech_on" | "speech_off";
  participantName: string | null;
  atMs: number | null;
};

/**
 * The exact shape of `realtime-event` payloads for transcript/participant
 * events isn't nailed down in Recall's public docs for desktop_sdk_callback
 * specifically (the embedded schema components didn't resolve via the docs
 * API - see docs/recall-doc-gaps.md). This parses defensively against the two
 * most likely shapes and is meant to be corrected once verified against a
 * real call.
 */
export type RawRealtimeEventData = {
  data?: {
    words?: { text: string }[];
    participant?: { id?: number | string; name?: string | null } | null;
  };
  words?: { text: string }[];
  participant?: { id?: number | string; name?: string | null } | null;
};
