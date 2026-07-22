import { useEffect, useState, type MouseEvent } from "react";
import type { MeetingSummary } from "../ipcEvents";
import { StatusBadge } from "./StatusBadge";

type ListState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; meetings: MeetingSummary[] };

export function MeetingsList({ onSelect }: { onSelect: (meetingId: string) => void }) {
  const [state, setState] = useState<ListState>({ phase: "loading" });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    window.recall.listMeetings().then((result) => {
      if (cancelled) return;
      setState(
        result.status === "ok"
          ? { phase: "loaded", meetings: result.meetings }
          : { phase: "error", message: result.error }
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(event: MouseEvent, meetingId: string) {
    event.stopPropagation();
    if (state.phase !== "loaded") return;
    if (!window.confirm("Delete this meeting? This can't be undone.")) return;

    setDeletingId(meetingId);
    const result = await window.recall.deleteMeeting(meetingId);
    setDeletingId(null);

    if (result.status === "ok") {
      setState({
        phase: "loaded",
        meetings: state.meetings.filter((meeting) => meeting.id !== meetingId),
      });
    } else {
      window.alert(`Failed to delete meeting: ${result.error}`);
    }
  }

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
          <div
            key={meeting.id}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <button onClick={() => onSelect(meeting.id)} className="min-w-0 flex-1 text-left">
              <div className="truncate font-medium text-gray-800">
                {meeting.meetingTitle ?? "Untitled meeting"}
              </div>
              <div className="truncate text-xs text-gray-500">
                {meeting.platform ?? "Unknown platform"} ·{" "}
                {new Date(meeting.createdAt).toLocaleString()} · {meeting.noteBlockCount}{" "}
                {meeting.noteBlockCount === 1 ? "note" : "notes"}
              </div>
            </button>
            <div className="flex items-center gap-3">
              <StatusBadge status={meeting.status} />
              <button
                onClick={(event) => handleDelete(event, meeting.id)}
                disabled={deletingId === meeting.id}
                aria-label="Delete meeting"
                title="Delete meeting"
                className="rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {deletingId === meeting.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
