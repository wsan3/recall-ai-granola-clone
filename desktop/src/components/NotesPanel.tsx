import type { NoteBlockData } from "../ipcEvents";

/**
 * Two independently-scrolling rows in the same column: your own typed notes
 * (verbatim, black) on top, the AI-expanded notes (gray, clickable
 * citations) below. Kept as separate rows per user feedback - interleaving
 * them by `order` made it hard to tell "what I actually said" from "what the
 * AI inferred."
 */
export function NotesPanel({
  noteBlocks,
  onCitationClick,
}: {
  noteBlocks: NoteBlockData[];
  onCitationClick: (utteranceIds: string[]) => void;
}) {
  const userBlocks = noteBlocks.filter((block) => block.source === "user");
  const aiBlocks = noteBlocks.filter((block) => block.source === "ai");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Your notes</h2>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
          {userBlocks.length === 0 ? (
            <p className="text-sm text-gray-400">No notes were typed during this call.</p>
          ) : (
            userBlocks.map((block) => (
              <p key={block.id} className="text-sm text-gray-900">
                {block.text}
              </p>
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">AI notes</h2>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
          {aiBlocks.length === 0 ? (
            <p className="text-sm text-gray-400">No AI notes for this meeting.</p>
          ) : (
            aiBlocks.map((block) => (
              <p
                key={block.id}
                onClick={() => onCitationClick(block.sourceUtteranceIds)}
                title="Jump to this moment in the transcript and recording"
                className="cursor-pointer text-sm text-gray-500 transition-colors hover:text-gray-700 hover:underline"
              >
                {block.text}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
