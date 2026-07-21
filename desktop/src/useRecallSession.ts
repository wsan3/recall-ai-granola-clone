import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MeetingChannelPayload, MeetingWindowPayload, SdkEventPayload } from "./ipcEvents";
import type {
  Participant,
  ParticipantEventEntry,
  RawRealtimeEventData,
  SessionPhase,
  TranscriptLine,
} from "./types";

type LocalPayload =
  | { type: "finish-started" }
  | { type: "finish-succeeded" }
  | { type: "finish-failed"; message: string };

export type DebugLogEntry = {
  id: number;
  at: string;
  channel: "sdk-event" | "meeting" | "local";
  payload: SdkEventPayload | MeetingChannelPayload | LocalPayload;
};

export type State = {
  phase: SessionPhase;
  meetingId: string | null;
  window: MeetingWindowPayload | null;
  permissions: Record<string, string>;
  recordingStartedAtMs: number | null;
  transcript: TranscriptLine[];
  partialLine: TranscriptLine | null;
  activeSpeakerIds: Set<string>;
  participantsById: Map<string, Participant>;
  participantEvents: ParticipantEventEntry[];
  errorMessage: string | null;
  debugLog: DebugLogEntry[];
};

export const initialState: State = {
  phase: "initializing",
  meetingId: null,
  window: null,
  permissions: {},
  recordingStartedAtMs: null,
  transcript: [],
  partialLine: null,
  activeSpeakerIds: new Set(),
  participantsById: new Map(),
  participantEvents: [],
  errorMessage: null,
  debugLog: [],
};

export type Action =
  | { channel: "sdk-event"; payload: SdkEventPayload }
  | { channel: "meeting"; payload: MeetingChannelPayload }
  | { channel: "local"; payload: LocalPayload };

let nextLineId = 0;
let nextLogId = 0;

function participantFromRaw(raw: unknown): Participant | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { id?: number | string; name?: string | null };
  if (p.id === undefined) return null;
  return { id: String(p.id), name: p.name ?? null };
}

/** See RawRealtimeEventData - handles both a nested `data.data` envelope and an already-flattened one. */
function extractTranscriptPayload(raw: unknown) {
  const envelope = raw as RawRealtimeEventData;
  const inner = envelope?.data ?? envelope;
  if (!inner?.words) return null;
  return {
    text: inner.words
      .map((w) => w.text)
      .join(" ")
      .trim(),
    participant: participantFromRaw(inner.participant),
  };
}

function extractParticipant(raw: unknown): Participant | null {
  const envelope = raw as RawRealtimeEventData;
  const inner = envelope?.data ?? envelope;
  return participantFromRaw(inner?.participant);
}

function relativeMs(state: State): number | null {
  return state.recordingStartedAtMs === null ? null : Date.now() - state.recordingStartedAtMs;
}

export function reducer(state: State, action: Action): State {
  const debugLog = [
    {
      id: nextLogId++,
      at: new Date().toLocaleTimeString(),
      channel: action.channel,
      payload: action.payload,
    },
    ...state.debugLog,
  ].slice(0, 300);

  if (action.channel === "local") {
    switch (action.payload.type) {
      case "finish-started":
        return { ...state, phase: "synthesizing", debugLog };
      case "finish-succeeded":
        return { ...state, phase: "done", debugLog };
      case "finish-failed":
        return { ...state, phase: "error", errorMessage: action.payload.message, debugLog };
    }
  }

  if (action.channel === "meeting") {
    const payload = action.payload;
    switch (payload.type) {
      case "meeting-started":
        return { ...state, phase: "starting-recording", meetingId: payload.meetingId, debugLog };
      case "start-recording-failed":
        return { ...state, phase: "error", errorMessage: payload.message, debugLog };
    }
  }

  if (action.channel === "sdk-event") {
    const payload = action.payload;

    switch (payload.type) {
      case "permission-status":
        return {
          ...state,
          permissions: { ...state.permissions, [payload.permission]: payload.status },
          debugLog,
        };

      case "permissions-granted":
        return {
          ...state,
          phase: state.phase === "initializing" ? "waiting-for-meeting" : state.phase,
          debugLog,
        };

      case "meeting-detected":
        return { ...state, phase: "starting-recording", window: payload.window, debugLog };

      case "meeting-updated":
        return { ...state, window: { ...state.window, ...payload.window }, debugLog };

      case "recording-started":
        return { ...state, phase: "recording", recordingStartedAtMs: Date.now(), debugLog };

      case "recording-ended":
      case "meeting-closed": {
        // The SDK fires both events for a single meeting ending (recording
        // stops, then the meeting window closes shortly after). Once we've
        // already moved past "ended" - into synthesizing/done/error via
        // finishMeeting - a later one of these two must not clobber that
        // progress back to "ended", or the UI gets stuck showing "wrapping
        // up..." forever even though the finish call already succeeded.
        const alreadyPastEnded =
          state.phase === "ended" ||
          state.phase === "synthesizing" ||
          state.phase === "done" ||
          state.phase === "error";
        return alreadyPastEnded ? { ...state, debugLog } : { ...state, phase: "ended", debugLog };
      }

      case "error":
        return { ...state, phase: "error", errorMessage: payload.message, debugLog };

      case "realtime-event": {
        if (payload.event === "transcript.data" || payload.event === "transcript.partial_data") {
          const parsed = extractTranscriptPayload(payload.data);
          if (!parsed || !parsed.text) {
            return { ...state, debugLog };
          }
          const isPartial = payload.event === "transcript.partial_data";
          const line: TranscriptLine = {
            id: `line-${nextLineId++}`,
            participant: parsed.participant,
            text: parsed.text,
            isPartial,
            atMs: relativeMs(state),
          };
          return isPartial
            ? { ...state, partialLine: line, debugLog }
            : { ...state, transcript: [...state.transcript, line], partialLine: null, debugLog };
        }

        if (
          payload.event === "participant_events.speech_on" ||
          payload.event === "participant_events.speech_off"
        ) {
          const participant = extractParticipant(payload.data);
          if (!participant) return { ...state, debugLog };
          const activeSpeakerIds = new Set(state.activeSpeakerIds);
          const type =
            payload.event === "participant_events.speech_on" ? "speech_on" : "speech_off";
          if (type === "speech_on") {
            activeSpeakerIds.add(participant.id);
          } else {
            activeSpeakerIds.delete(participant.id);
          }
          const participantEvents: ParticipantEventEntry[] = [
            ...state.participantEvents,
            { type, participantName: participant.name, atMs: relativeMs(state) },
          ];
          return { ...state, activeSpeakerIds, participantEvents, debugLog };
        }

        if (
          payload.event === "participant_events.join" ||
          payload.event === "participant_events.update"
        ) {
          const participant = extractParticipant(payload.data);
          if (!participant) return { ...state, debugLog };
          const participantsById = new Map(state.participantsById);
          participantsById.set(participant.id, participant);
          const type = payload.event === "participant_events.join" ? "join" : "update";
          const participantEvents: ParticipantEventEntry[] = [
            ...state.participantEvents,
            { type, participantName: participant.name, atMs: relativeMs(state) },
          ];
          return { ...state, participantsById, participantEvents, debugLog };
        }

        return { ...state, debugLog };
      }

      case "media-capture-status":
      case "network-status":
      case "shutdown":
        return { ...state, debugLog };
    }
  }

  return { ...state, debugLog };
}

export function useRecallSession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    const offSdkEvent = window.recall.on("sdk-event", (payload) =>
      dispatch({ channel: "sdk-event", payload })
    );
    const offMeeting = window.recall.on("meeting", (payload) =>
      dispatch({ channel: "meeting", payload })
    );

    return () => {
      offSdkEvent();
      offMeeting();
    };
  }, []);

  /**
   * Sends the client-collected transcript + participant events + the user's
   * own notepad text to the backend for persistence and AI synthesis. Safe
   * to call more than once (e.g. from an effect on phase change) - only the
   * first call after a meeting starts actually fires.
   */
  const finishMeeting = useCallback(async (notes: string) => {
    const current = stateRef.current;
    if (hasFinishedRef.current || !current.meetingId) return;
    hasFinishedRef.current = true;
    dispatch({ channel: "local", payload: { type: "finish-started" } });

    const result = await window.recall.finishMeeting({
      meetingId: current.meetingId,
      notes,
      utterances: current.transcript.map((line) => ({
        speakerName: line.participant?.name ?? null,
        text: line.text,
        startMs: line.atMs,
        endMs: null,
      })),
      participantEvents: current.participantEvents.map((event) => ({
        type: event.type,
        participantName: event.participantName,
      })),
    });

    if (result.status === "ok") {
      dispatch({ channel: "local", payload: { type: "finish-succeeded" } });
    } else {
      dispatch({ channel: "local", payload: { type: "finish-failed", message: result.error } });
    }
  }, []);

  return { ...state, finishMeeting };
}
