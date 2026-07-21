import { useEffect, useReducer } from "react";
import type { MeetingChannelPayload, MeetingWindowPayload, SdkEventPayload } from "./ipcEvents";
import type { Participant, RawRealtimeEventData, SessionPhase, TranscriptLine } from "./types";

type DebugLogEntry = {
  id: number;
  at: string;
  channel: "sdk-event" | "meeting";
  payload: SdkEventPayload | MeetingChannelPayload;
};

type State = {
  phase: SessionPhase;
  window: MeetingWindowPayload | null;
  permissions: Record<string, string>;
  transcript: TranscriptLine[];
  partialLine: TranscriptLine | null;
  activeSpeakerIds: Set<string>;
  participantsById: Map<string, Participant>;
  errorMessage: string | null;
  debugLog: DebugLogEntry[];
};

const initialState: State = {
  phase: "initializing",
  window: null,
  permissions: {},
  transcript: [],
  partialLine: null,
  activeSpeakerIds: new Set(),
  participantsById: new Map(),
  errorMessage: null,
  debugLog: [],
};

type Action =
  | { channel: "sdk-event"; payload: SdkEventPayload }
  | { channel: "meeting"; payload: MeetingChannelPayload };

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
    text: inner.words.map((w) => w.text).join(" ").trim(),
    participant: participantFromRaw(inner.participant),
  };
}

function extractParticipant(raw: unknown): Participant | null {
  const envelope = raw as RawRealtimeEventData;
  const inner = envelope?.data ?? envelope;
  return participantFromRaw(inner?.participant);
}

function reducer(state: State, action: Action): State {
  const debugLog = [
    { id: nextLogId++, at: new Date().toLocaleTimeString(), channel: action.channel, payload: action.payload },
    ...state.debugLog,
  ].slice(0, 300);

  if (action.channel === "meeting") {
    const payload = action.payload;
    switch (payload.type) {
      case "meeting-started":
        return { ...state, phase: "starting-recording", debugLog };
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
        return { ...state, phase: "recording", debugLog };

      case "recording-ended":
      case "meeting-closed":
        return { ...state, phase: "ended", debugLog };

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
            atMs: null,
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
          if (payload.event === "participant_events.speech_on") {
            activeSpeakerIds.add(participant.id);
          } else {
            activeSpeakerIds.delete(participant.id);
          }
          return { ...state, activeSpeakerIds, debugLog };
        }

        if (payload.event === "participant_events.join" || payload.event === "participant_events.update") {
          const participant = extractParticipant(payload.data);
          if (!participant) return { ...state, debugLog };
          const participantsById = new Map(state.participantsById);
          participantsById.set(participant.id, participant);
          return { ...state, participantsById, debugLog };
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

  useEffect(() => {
    const offSdkEvent = window.recall.on("sdk-event", (payload) => dispatch({ channel: "sdk-event", payload }));
    const offMeeting = window.recall.on("meeting", (payload) => dispatch({ channel: "meeting", payload }));

    return () => {
      offSdkEvent();
      offMeeting();
    };
  }, []);

  return state;
}
