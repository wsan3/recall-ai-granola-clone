import type { MeetingStatus } from "../ipcEvents";

const STATUS_COPY: Record<MeetingStatus, { label: string; className: string }> = {
  recording: { label: "Recording", className: "bg-red-100 text-red-700" },
  processing: { label: "Processing", className: "bg-amber-100 text-amber-700" },
  ready: { label: "Ready", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", className: "bg-gray-200 text-gray-600" },
};

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const copy = STATUS_COPY[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${copy.className}`}>{copy.label}</span>
  );
}
