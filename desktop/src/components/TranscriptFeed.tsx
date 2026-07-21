import { useEffect, useRef } from "react";
import type { Participant, TranscriptLine } from "../types";

function speakerLabel(participant: Participant | null, participantsById: Map<string, Participant>) {
  if (!participant) return "Someone";
  const known = participantsById.get(participant.id);
  return known?.name ?? participant.name ?? "Someone";
}

function TranscriptRow({
  line,
  participantsById,
  isSpeaking,
}: {
  line: TranscriptLine;
  participantsById: Map<string, Participant>;
  isSpeaking: boolean;
}) {
  return (
    <div className={`px-1 py-1.5 ${line.isPartial ? "opacity-60" : ""}`}>
      <span
        className={`mr-2 text-xs font-semibold uppercase tracking-wide ${
          isSpeaking ? "text-emerald-600" : "text-gray-400"
        }`}
      >
        {speakerLabel(line.participant, participantsById)}
      </span>
      <span className="text-sm text-gray-800">{line.text}</span>
    </div>
  );
}

export function TranscriptFeed({
  transcript,
  partialLine,
  activeSpeakerIds,
  participantsById,
}: {
  transcript: TranscriptLine[];
  partialLine: TranscriptLine | null;
  activeSpeakerIds: Set<string>;
  participantsById: Map<string, Participant>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [transcript.length, partialLine?.text]);

  const lines = partialLine ? [...transcript, partialLine] : transcript;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="mb-2 text-sm font-semibold text-gray-500">Live transcript</h2>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        {lines.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Transcript will appear here once the meeting starts.</p>
        )}
        {lines.map((line) => (
          <TranscriptRow
            key={line.id}
            line={line}
            participantsById={participantsById}
            isSpeaking={!!line.participant && activeSpeakerIds.has(line.participant.id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
