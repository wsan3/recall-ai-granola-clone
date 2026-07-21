import type { NoteBlockData } from "../ipcEvents";

/**
 * Black text = the user's own typed notes, verbatim. Gray text = AI-expanded
 * blocks the synthesis pass derived from the transcript - clickable, since
 * they carry sourceUtteranceIds citations back to the moment they came from.
 */
export function NotesPanel({
  noteBlocks,
  onCitationClick,
}: {
  noteBlocks: NoteBlockData[];
  onCitationClick: (utteranceIds: string[]) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h2 className="mb-2 text-sm font-semibold text-gray-500">Notes</h2>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
        {noteBlocks.length === 0 && (
          <p className="text-sm text-gray-400">No notes for this meeting.</p>
        )}
        {noteBlocks.map((block) =>
          block.source === "user" ? (
            <p key={block.id} className="text-sm text-gray-900">
              {block.text}
            </p>
          ) : (
            <p
              key={block.id}
              onClick={() => onCitationClick(block.sourceUtteranceIds)}
              title="Jump to this moment in the transcript and recording"
              className="cursor-pointer text-sm text-gray-500 transition-colors hover:text-gray-700 hover:underline"
            >
              {block.text}
            </p>
          )
        )}
      </div>
    </div>
  );
}
