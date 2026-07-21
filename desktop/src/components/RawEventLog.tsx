import { useState } from "react";
import type { DebugLogEntry } from "../useRecallSession";

/**
 * Collapsed by default - kept around as a verification tool while the exact
 * shape of some realtime-event payloads is still being confirmed against a
 * real call (see docs/recall-doc-gaps.md).
 */
export function RawEventLog({ entries }: { entries: DebugLogEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        className="w-full px-6 py-2 text-left text-xs font-medium text-gray-500 hover:text-gray-700"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "▾" : "▸"} Raw event log ({entries.length})
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto px-6 pb-3 font-mono text-[11px] text-gray-600">
          {entries.map((entry) => (
            <div key={entry.id} className="py-0.5">
              <span className="text-gray-400">[{entry.at}]</span>{" "}
              <span className="font-semibold">{entry.channel}</span>{" "}
              <span>{JSON.stringify(entry.payload)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
