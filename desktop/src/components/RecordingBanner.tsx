import type { MeetingWindowPayload } from "../ipcEvents";
import type { SessionPhase } from "../types";

const PHASE_COPY: Record<SessionPhase, { label: string; dot: string; bg: string }> = {
  initializing: { label: "Starting up…", dot: "bg-gray-400", bg: "bg-gray-50" },
  "waiting-for-meeting": {
    label: "Ready — waiting for a meeting to start",
    dot: "bg-gray-400",
    bg: "bg-gray-50",
  },
  "starting-recording": { label: "Meeting detected — starting…", dot: "bg-amber-500", bg: "bg-amber-50" },
  recording: { label: "Recording", dot: "bg-red-500 animate-pulse", bg: "bg-red-50" },
  ended: { label: "Meeting ended", dot: "bg-gray-400", bg: "bg-gray-50" },
  error: { label: "Something went wrong", dot: "bg-red-600", bg: "bg-red-50" },
};

export function RecordingBanner({
  phase,
  meetingWindow,
  errorMessage,
}: {
  phase: SessionPhase;
  meetingWindow: MeetingWindowPayload | null;
  errorMessage: string | null;
}) {
  const copy = PHASE_COPY[phase];

  return (
    <div className={`flex items-center gap-3 border-b border-gray-200 px-6 py-3 ${copy.bg}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${copy.dot}`} />
      <span className="font-medium text-gray-800">{copy.label}</span>
      {meetingWindow?.platform && (
        <span className="text-sm text-gray-500">· {meetingWindow.platform}</span>
      )}
      {meetingWindow?.title && (
        <span className="truncate text-sm text-gray-500">· {meetingWindow.title}</span>
      )}
      {phase === "error" && errorMessage && (
        <span className="truncate text-sm text-red-700">· {errorMessage}</span>
      )}
    </div>
  );
}
