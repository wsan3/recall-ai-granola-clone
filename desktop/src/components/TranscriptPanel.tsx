import type { UtteranceData } from "../ipcEvents";

/**
 * Read-only transcript for a past meeting (distinct from the live
 * TranscriptFeed, which handles partial lines/active speakers). Rows
 * matching activeUtteranceIds are highlighted when a note citation is
 * clicked, and registerRef lets the parent scroll a cited row into view.
 */
export function TranscriptPanel({
  utterances,
  activeUtteranceIds,
  registerRef,
}: {
  utterances: UtteranceData[];
  activeUtteranceIds: Set<string>;
  registerRef: (utteranceId: string, el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h2 className="mb-2 text-sm font-semibold text-gray-500">Transcript</h2>
      <div className="flex-1 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
        {utterances.length === 0 && (
          <p className="text-sm text-gray-400">No transcript was captured for this meeting.</p>
        )}
        {utterances.map((utterance) => (
          <div
            key={utterance.id}
            ref={(el) => registerRef(utterance.id, el)}
            className={`rounded px-2 py-1 text-sm transition-colors ${
              activeUtteranceIds.has(utterance.id) ? "bg-amber-100" : ""
            }`}
          >
            <span className="font-medium text-gray-700">{utterance.speakerName ?? "Unknown"}:</span>{" "}
            <span className="text-gray-600">{utterance.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
