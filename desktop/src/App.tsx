import { useState } from "react";
import { RecordingBanner } from "./components/RecordingBanner";
import { TranscriptFeed } from "./components/TranscriptFeed";
import { Notepad } from "./components/Notepad";
import { RawEventLog } from "./components/RawEventLog";
import { useRecallSession } from "./useRecallSession";

export function App() {
  const session = useRecallSession();
  const [notes, setNotes] = useState("");

  return (
    <div className="flex h-full flex-col bg-gray-100">
      <RecordingBanner phase={session.phase} meetingWindow={session.window} errorMessage={session.errorMessage} />

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden p-4">
        <Notepad value={notes} onChange={setNotes} />
        <TranscriptFeed
          transcript={session.transcript}
          partialLine={session.partialLine}
          activeSpeakerIds={session.activeSpeakerIds}
          participantsById={session.participantsById}
        />
      </div>

      <RawEventLog entries={session.debugLog} />
    </div>
  );
}
