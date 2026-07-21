import { describe, expect, it } from "vitest";
import { type Action, initialState, reducer, type State } from "./useRecallSession";

function apply(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

const WINDOW = { id: "w1", title: "Standup", url: "https://meet.google.com/abc", platform: "google_meet" };

describe("useRecallSession reducer", () => {
  it("starts in the initializing phase", () => {
    expect(initialState.phase).toBe("initializing");
  });

  it("moves to waiting-for-meeting once permissions are granted from initializing", () => {
    const state = apply(initialState, { channel: "sdk-event", payload: { type: "permissions-granted" } });
    expect(state.phase).toBe("waiting-for-meeting");
  });

  it("does not regress phase when permissions-granted fires again later", () => {
    const recording = apply(
      initialState,
      { channel: "sdk-event", payload: { type: "permissions-granted" } },
      { channel: "sdk-event", payload: { type: "meeting-detected", window: WINDOW } },
      { channel: "meeting", payload: { type: "meeting-started", meetingId: "m1", window: WINDOW } },
      { channel: "sdk-event", payload: { type: "recording-started", window: WINDOW } }
    );
    expect(recording.phase).toBe("recording");

    const stillRecording = reducer(recording, { channel: "sdk-event", payload: { type: "permissions-granted" } });
    expect(stillRecording.phase).toBe("recording");
  });

  it("tracks per-permission status updates", () => {
    const state = apply(initialState, {
      channel: "sdk-event",
      payload: { type: "permission-status", permission: "microphone", status: "granted" },
    });
    expect(state.permissions).toEqual({ microphone: "granted" });
  });

  it("walks meeting-detected -> meeting-started -> recording-started through to recording", () => {
    const detected = reducer(initialState, { channel: "sdk-event", payload: { type: "meeting-detected", window: WINDOW } });
    expect(detected.phase).toBe("starting-recording");
    expect(detected.window).toEqual(WINDOW);

    const started = reducer(detected, {
      channel: "meeting",
      payload: { type: "meeting-started", meetingId: "m1", window: WINDOW },
    });
    expect(started.phase).toBe("starting-recording");
    expect(started.meetingId).toBe("m1");

    const recording = reducer(started, { channel: "sdk-event", payload: { type: "recording-started", window: WINDOW } });
    expect(recording.phase).toBe("recording");
    expect(recording.recordingStartedAtMs).not.toBeNull();
  });

  it("surfaces a start-recording-failed message as an error", () => {
    const state = reducer(initialState, {
      channel: "meeting",
      payload: { type: "start-recording-failed", message: "Recall API is down" },
    });
    expect(state.phase).toBe("error");
    expect(state.errorMessage).toBe("Recall API is down");
  });

  it("merges partial window metadata on meeting-updated", () => {
    const detected = reducer(initialState, { channel: "sdk-event", payload: { type: "meeting-detected", window: WINDOW } });
    const updated = reducer(detected, {
      channel: "sdk-event",
      payload: { type: "meeting-updated", window: { id: "w1", title: "Standup (renamed)" } },
    });
    expect(updated.window).toEqual({ ...WINDOW, title: "Standup (renamed)" });
  });

  describe("recording-ended / meeting-closed phase-reset regression", () => {
    // Regression test for the bug where the "Meeting ended - wrapping up..."
    // banner never went away: recording-ended and meeting-closed both fire
    // for one meeting ending, and used to unconditionally reset phase back
    // to "ended" even after finishMeeting had already moved past it.
    const recordingState: State = { ...initialState, phase: "recording", meetingId: "m1" };

    it("moves recording -> ended on the first of the two events", () => {
      const state = reducer(recordingState, { channel: "sdk-event", payload: { type: "recording-ended", window: WINDOW } });
      expect(state.phase).toBe("ended");
    });

    it("does not clobber synthesizing back to ended when meeting-closed arrives after finishMeeting has started", () => {
      const ended = reducer(recordingState, { channel: "sdk-event", payload: { type: "recording-ended", window: WINDOW } });
      const synthesizing = reducer(ended, { channel: "local", payload: { type: "finish-started" } });
      expect(synthesizing.phase).toBe("synthesizing");

      const afterMeetingClosed = reducer(synthesizing, {
        channel: "sdk-event",
        payload: { type: "meeting-closed", window: WINDOW },
      });
      expect(afterMeetingClosed.phase).toBe("synthesizing");
    });

    it("does not clobber done back to ended", () => {
      const doneState: State = { ...recordingState, phase: "done" };
      const state = reducer(doneState, { channel: "sdk-event", payload: { type: "meeting-closed", window: WINDOW } });
      expect(state.phase).toBe("done");
    });

    it("does not clobber error back to ended", () => {
      const errorState: State = { ...recordingState, phase: "error", errorMessage: "boom" };
      const state = reducer(errorState, { channel: "sdk-event", payload: { type: "recording-ended", window: WINDOW } });
      expect(state.phase).toBe("error");
      expect(state.errorMessage).toBe("boom");
    });

    it("is a no-op re-affirming ended when already ended", () => {
      const endedState: State = { ...recordingState, phase: "ended" };
      const state = reducer(endedState, { channel: "sdk-event", payload: { type: "meeting-closed", window: WINDOW } });
      expect(state.phase).toBe("ended");
    });
  });

  describe("local finish-meeting lifecycle", () => {
    it("finish-started -> finish-succeeded moves synthesizing -> done", () => {
      const synthesizing = reducer(initialState, { channel: "local", payload: { type: "finish-started" } });
      expect(synthesizing.phase).toBe("synthesizing");
      const done = reducer(synthesizing, { channel: "local", payload: { type: "finish-succeeded" } });
      expect(done.phase).toBe("done");
    });

    it("finish-failed surfaces the error message", () => {
      const state = reducer(initialState, { channel: "local", payload: { type: "finish-failed", message: "network error" } });
      expect(state.phase).toBe("error");
      expect(state.errorMessage).toBe("network error");
    });
  });

  describe("transcript realtime events", () => {
    const recordingState: State = { ...initialState, phase: "recording", recordingStartedAtMs: Date.now() - 5000 };

    it("appends a finalized transcript.data line and clears any partial line", () => {
      const withPartial: State = {
        ...recordingState,
        partialLine: { id: "line-x", participant: null, text: "partial...", isPartial: true, atMs: 1000 },
      };
      const state = reducer(withPartial, {
        channel: "sdk-event",
        payload: {
          type: "realtime-event",
          event: "transcript.data",
          window: WINDOW,
          data: { data: { words: [{ text: "Hello" }, { text: "world" }], participant: { id: 1, name: "Alex" } } },
        },
      });

      expect(state.transcript).toHaveLength(1);
      expect(state.transcript[0]).toMatchObject({ text: "Hello world", participant: { id: "1", name: "Alex" }, isPartial: false });
      expect(state.partialLine).toBeNull();
    });

    it("stores transcript.partial_data separately without touching the finalized transcript", () => {
      const state = reducer(recordingState, {
        channel: "sdk-event",
        payload: {
          type: "realtime-event",
          event: "transcript.partial_data",
          window: WINDOW,
          data: { words: [{ text: "Hel" }], participant: { id: 2, name: "Sam" } },
        },
      });

      expect(state.transcript).toHaveLength(0);
      expect(state.partialLine).toMatchObject({ text: "Hel", isPartial: true });
    });

    it("ignores a transcript event with no words", () => {
      const state = reducer(recordingState, {
        channel: "sdk-event",
        payload: { type: "realtime-event", event: "transcript.data", window: WINDOW, data: { data: {} } },
      });
      expect(state.transcript).toHaveLength(0);
    });

    it("tracks speech_on/speech_off into activeSpeakerIds and appends a participant event", () => {
      const speaking = reducer(recordingState, {
        channel: "sdk-event",
        payload: {
          type: "realtime-event",
          event: "participant_events.speech_on",
          window: WINDOW,
          data: { participant: { id: 7, name: "Jamie" } },
        },
      });
      expect(speaking.activeSpeakerIds.has("7")).toBe(true);
      expect(speaking.participantEvents).toEqual([{ type: "speech_on", participantName: "Jamie", atMs: expect.any(Number) }]);

      const stopped = reducer(speaking, {
        channel: "sdk-event",
        payload: {
          type: "realtime-event",
          event: "participant_events.speech_off",
          window: WINDOW,
          data: { participant: { id: 7, name: "Jamie" } },
        },
      });
      expect(stopped.activeSpeakerIds.has("7")).toBe(false);
      expect(stopped.participantEvents).toHaveLength(2);
    });

    it("tracks join/update into participantsById and appends a participant event", () => {
      const joined = reducer(recordingState, {
        channel: "sdk-event",
        payload: {
          type: "realtime-event",
          event: "participant_events.join",
          window: WINDOW,
          data: { participant: { id: 3, name: "Robin" } },
        },
      });
      expect(joined.participantsById.get("3")).toEqual({ id: "3", name: "Robin" });
      expect(joined.participantEvents[0]).toMatchObject({ type: "join", participantName: "Robin" });

      const updated = reducer(joined, {
        channel: "sdk-event",
        payload: {
          type: "realtime-event",
          event: "participant_events.update",
          window: WINDOW,
          data: { participant: { id: 3, name: "Robin Hood" } },
        },
      });
      expect(updated.participantsById.get("3")).toEqual({ id: "3", name: "Robin Hood" });
      expect(updated.participantEvents).toHaveLength(2);
    });

    it("ignores realtime events it doesn't recognize without throwing", () => {
      const state = reducer(recordingState, {
        channel: "sdk-event",
        payload: { type: "realtime-event", event: "some.unknown.event", window: WINDOW, data: {} },
      });
      expect(state).toMatchObject({ phase: "recording" });
    });
  });

  it("surfaces a top-level SDK error", () => {
    const state = reducer(initialState, { channel: "sdk-event", payload: { type: "error", errorType: "sdk", message: "crashed" } });
    expect(state.phase).toBe("error");
    expect(state.errorMessage).toBe("crashed");
  });

  it("caps the debug log at 300 entries, newest first", () => {
    let state = initialState;
    for (let i = 0; i < 305; i++) {
      state = reducer(state, { channel: "sdk-event", payload: { type: "permission-status", permission: "mic", status: String(i) } });
    }
    expect(state.debugLog).toHaveLength(300);
    expect(state.debugLog[0].payload).toMatchObject({ status: "304" });
  });

  it("passes through media-capture-status/network-status/shutdown without changing phase", () => {
    const recordingState: State = { ...initialState, phase: "recording" };
    const a = reducer(recordingState, {
      channel: "sdk-event",
      payload: { type: "media-capture-status", window: WINDOW, mediaType: "audio", capturing: true },
    });
    const b = reducer(a, { channel: "sdk-event", payload: { type: "network-status", status: "online" } });
    const c = reducer(b, { channel: "sdk-event", payload: { type: "shutdown", code: 0, signal: "SIGTERM" } });
    expect(c.phase).toBe("recording");
  });
});
