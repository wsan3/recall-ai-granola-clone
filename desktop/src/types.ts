export type SessionPhase =
  | "initializing"
  | "waiting-for-meeting"
  | "starting-recording"
  | "recording"
  | "ended"
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
