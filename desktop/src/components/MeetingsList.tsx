import { useEffect, useState } from "react";
import type { MeetingSummary } from "../ipcEvents";
import { StatusBadge } from "./StatusBadge";

type ListState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; meetings: MeetingSummary[] };

export function MeetingsList({ onSelect }: { onSelect: (meetingId: string) => void }) {
  const [state, setState] = useState<ListState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    window.recall.listMeetings().then((result) => {
      if (cancelled) return;
      setState(
        result.status === "ok" ? { phase: "loaded", meetings: result.meetings } : { phase: "error", message: result.error }
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === "loading") {
    return <div className="p-6 text-sm text-gray-500">Loading meetings…</div>;
  }

  if (state.phase === "error") {
    return <div className="p-6 text-sm text-red-600">Failed to load meetings: {state.message}</div>;
  }

  if (state.meetings.length === 0) {
    return (
      <div className="p-6 text-sm text-gray-500">
        No meetings yet — once the app records a meeting, it'll show up here.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {state.meetings.map((meeting) => (
          <button
            key={meeting.id}
            onClick={() => onSelect(meeting.id)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-gray-800">{meeting.meetingTitle ?? "Untitled meeting"}</div>
              <div className="truncate text-xs text-gray-500">
                {meeting.platform ?? "Unknown platform"} · {new Date(meeting.createdAt).toLocaleString()} ·{" "}
                {meeting.noteBlockCount} {meeting.noteBlockCount === 1 ? "note" : "notes"}
              </div>
            </div>
            <StatusBadge status={meeting.status} />
          </button>
        ))}
      </div>
    </div>
  );
}
