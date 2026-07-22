/**
 * The IPC contract between the main process (src/main.ts, which sends these)
 * and the renderer (src/useRecallSession.ts, which consumes them via
 * src/preload.ts). Keeping this in one shared file means a mismatch between
 * what main.ts sends and what the renderer expects is a compile error.
 */

export type MeetingWindowPayload = {
  id: string;
  title?: string;
  url?: string;
  platform?: string;
};

export type SdkEventPayload =
  | { type: "permissions-granted" }
  | { type: "permission-status"; permission: string; status: string }
  | { type: "meeting-detected"; window: MeetingWindowPayload }
  | { type: "meeting-updated"; window: MeetingWindowPayload }
  | { type: "meeting-closed"; window: MeetingWindowPayload }
  | { type: "recording-started"; window: MeetingWindowPayload }
  | { type: "recording-ended"; window: MeetingWindowPayload }
  | { type: "realtime-event"; event: string; window: MeetingWindowPayload; data: unknown }
  | {
      type: "media-capture-status";
      window: MeetingWindowPayload;
      mediaType: string;
      capturing: boolean;
    }
  | { type: "error"; window?: MeetingWindowPayload; errorType: string; message: string }
  | { type: "network-status"; status: string }
  | { type: "shutdown"; code: number; signal: string };

export type MeetingChannelPayload =
  | { type: "meeting-started"; meetingId: string; window: MeetingWindowPayload }
  | { type: "start-recording-failed"; message: string };

/**
 * Request/response for the `finish-meeting` IPC invoke, sent by the renderer
 * once useRecallSession has a complete transcript for the call. The main
 * process makes the actual backend call (keeps all backend HTTP calls in one
 * place, and avoids a cross-origin fetch from the renderer to the ngrok'd
 * dev backend).
 */
export type FinishMeetingRequest = {
  meetingId: string;
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

// A string-literal discriminant (not a boolean) - TS's discriminated-union
// narrowing on a boolean `ok: true/false` field silently breaks without
// strictNullChecks, which this project doesn't enable. See docs/challenges.md.
export type FinishMeetingResponse =
  { status: "ok"; synthesisFailed?: boolean } | { status: "error"; error: string };

export type MeetingStatus = "recording" | "processing" | "ready" | "failed";

/** Mirrors the shape returned by GET /api/meetings (backend/src/app/api/meetings/route.ts). */
export type MeetingSummary = {
  id: string;
  meetingTitle: string | null;
  platform: string | null;
  meetingUrl: string | null;
  status: MeetingStatus;
  videoUrl: string | null;
  createdAt: string;
  endedAt: string | null;
  noteBlockCount: number;
};

export type NoteBlockData = {
  id: string;
  order: number;
  source: "user" | "ai";
  text: string;
  sourceUtteranceIds: string[];
};

export type UtteranceData = {
  id: string;
  speakerName: string | null;
  text: string;
  startMs: number;
  endMs: number | null;
};

/** Mirrors the shape returned by GET /api/meetings/:id (backend/src/app/api/meetings/[id]/route.ts). */
export type MeetingDetail = Omit<MeetingSummary, "noteBlockCount"> & {
  noteBlocks: NoteBlockData[];
  utterances: UtteranceData[];
};

export type ListMeetingsResult =
  { status: "ok"; meetings: MeetingSummary[] } | { status: "error"; error: string };

export type GetMeetingResult =
  { status: "ok"; meeting: MeetingDetail } | { status: "error"; error: string };

export type UpdateMeetingTitleResult = { status: "ok" } | { status: "error"; error: string };

export type DeleteMeetingResult = { status: "ok" } | { status: "error"; error: string };
