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
  | { type: "media-capture-status"; window: MeetingWindowPayload; mediaType: string; capturing: boolean }
  | { type: "error"; window?: MeetingWindowPayload; errorType: string; message: string }
  | { type: "network-status"; status: string }
  | { type: "shutdown"; code: number; signal: string };

export type MeetingChannelPayload =
  | { type: "meeting-started"; meetingId: string; window: MeetingWindowPayload }
  | { type: "start-recording-failed"; message: string };
