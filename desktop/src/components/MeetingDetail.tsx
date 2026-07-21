import { useEffect, useRef, useState } from "react";
import type { MeetingDetail as MeetingDetailData } from "../ipcEvents";
import { NotesPanel } from "./NotesPanel";
import { TranscriptPanel } from "./TranscriptPanel";
import { StatusBadge } from "./StatusBadge";
import { EditableTitle } from "./EditableTitle";

type DetailState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; meeting: MeetingDetailData };

export function MeetingDetail({ meetingId, onBack }: { meetingId: string; onBack: () => void }) {
  const [state, setState] = useState<DetailState>({ phase: "loading" });
  const [activeUtteranceIds, setActiveUtteranceIds] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const utteranceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    setActiveUtteranceIds(new Set());
    window.recall.getMeeting(meetingId).then((result) => {
      if (cancelled) return;
      setState(
        result.status === "ok"
          ? { phase: "loaded", meeting: result.meeting }
          : { phase: "error", message: result.error }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  function handleCitationClick(utteranceIds: string[]) {
    if (state.phase !== "loaded" || utteranceIds.length === 0) return;
    const cited = state.meeting.utterances.filter((u) => utteranceIds.includes(u.id));
    if (cited.length === 0) return;

    const earliest = cited.reduce((min, u) => (u.startMs < min.startMs ? u : min));
    if (videoRef.current) {
      videoRef.current.currentTime = earliest.startMs / 1000;
    }
    setActiveUtteranceIds(new Set(utteranceIds));
    utteranceRefs.current.get(earliest.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        {state.phase === "loaded" && (
          <>
            <div className="min-w-0 flex-1">
              <EditableTitle
                meetingId={state.meeting.id}
                title={state.meeting.meetingTitle}
                onSaved={(meetingTitle) =>
                  setState((current) =>
                    current.phase === "loaded"
                      ? { ...current, meeting: { ...current.meeting, meetingTitle } }
                      : current
                  )
                }
              />
              <div className="truncate text-xs text-gray-500">
                {state.meeting.platform ?? "Unknown platform"} ·{" "}
                {new Date(state.meeting.createdAt).toLocaleString()}
              </div>
            </div>
            <StatusBadge status={state.meeting.status} />
          </>
        )}
      </div>

      {state.phase === "loading" && <div className="p-6 text-sm text-gray-500">Loading…</div>}
      {state.phase === "error" && (
        <div className="p-6 text-sm text-red-600">Failed to load meeting: {state.message}</div>
      )}

      {state.phase === "loaded" && (
        <>
          {state.meeting.videoUrl ? (
            <div className="border-b border-gray-200 bg-black">
              <video
                ref={videoRef}
                src={state.meeting.videoUrl}
                controls
                className="mx-auto max-h-64 w-full"
              />
            </div>
          ) : (
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
              Recording not available yet — citations will still highlight the transcript.
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-hidden p-4">
            <NotesPanel
              noteBlocks={state.meeting.noteBlocks}
              onCitationClick={handleCitationClick}
            />
            <TranscriptPanel
              utterances={state.meeting.utterances}
              activeUtteranceIds={activeUtteranceIds}
              registerRef={(utteranceId, el) => {
                if (el) {
                  utteranceRefs.current.set(utteranceId, el);
                } else {
                  utteranceRefs.current.delete(utteranceId);
                }
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
