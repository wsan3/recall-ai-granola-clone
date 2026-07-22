import { useEffect, useRef, useState } from "react";
import { RecordingBanner } from "./components/RecordingBanner";
import { TranscriptFeed } from "./components/TranscriptFeed";
import { Notepad } from "./components/Notepad";
import { RawEventLog } from "./components/RawEventLog";
import { NavBar, type Screen } from "./components/NavBar";
import { MeetingsList } from "./components/MeetingsList";
import { MeetingDetail } from "./components/MeetingDetail";
import { useRecallSession } from "./useRecallSession";

export function App() {
  const session = useRecallSession();
  const [notes, setNotes] = useState("");
  const [screen, setScreen] = useState<Screen>({ name: "live" });

  // finishMeeting reads notes at call time, not via a dependency, so it
  // always sees the latest notepad text without re-firing this effect on
  // every keystroke.
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    if (session.phase === "ended") {
      session.finishMeeting(notesRef.current);
    }
  }, [session.phase, session.finishMeeting]);

  // Once notes finish synthesizing, jump straight to the Meeting Detail view
  // for the meeting that just wrapped up - the natural payoff of the call.
  useEffect(() => {
    if (session.phase === "done" && session.meetingId) {
      setScreen({ name: "meeting-detail", meetingId: session.meetingId });
    }
  }, [session.phase, session.meetingId]);

  // A new meeting starting (phase leaving one of the "settled" states below
  // and re-entering "starting-recording") means the Live Meeting panel is
  // about to show a different call - clear the notepad so it starts blank
  // instead of carrying over the previous meeting's notes.
  const previousPhaseRef = useRef(session.phase);
  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    const isFreshMeeting =
      session.phase === "starting-recording" &&
      (previousPhase === "ended" || previousPhase === "done" || previousPhase === "error");
    if (isFreshMeeting) {
      setNotes("");
    }
    previousPhaseRef.current = session.phase;
  }, [session.phase]);

  return (
    <div className="flex h-full flex-col bg-gray-100">
      <NavBar screen={screen} onNavigate={setScreen} />

      {screen.name === "live" && (
        <>
          <RecordingBanner
            phase={session.phase}
            meetingWindow={session.window}
            errorMessage={session.errorMessage}
          />

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-hidden p-4">
            <Notepad value={notes} onChange={setNotes} />
            <TranscriptFeed
              transcript={session.transcript}
              partialLine={session.partialLine}
              activeSpeakerIds={session.activeSpeakerIds}
              participantsById={session.participantsById}
            />
          </div>

          <RawEventLog entries={session.debugLog} />
        </>
      )}

      {screen.name === "meetings" && (
        <MeetingsList onSelect={(meetingId) => setScreen({ name: "meeting-detail", meetingId })} />
      )}

      {screen.name === "meeting-detail" && (
        <MeetingDetail
          meetingId={screen.meetingId}
          onBack={() => setScreen({ name: "meetings" })}
        />
      )}
    </div>
  );
}
