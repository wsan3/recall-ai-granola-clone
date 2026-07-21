import { useEffect, useState } from "react";

/**
 * Click-to-rename meeting title. The SDK's own window title (e.g. a generic
 * "Zoom Meeting", or nothing at all on some platforms) isn't always a useful
 * name, so this lets the user set one from the Meeting Detail view.
 */
export function EditableTitle({
  meetingId,
  title,
  onSaved,
}: {
  meetingId: string;
  title: string | null;
  onSaved: (newTitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(title ?? "");
  }, [title]);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === (title ?? "")) {
      setEditing(false);
      setValue(title ?? "");
      return;
    }

    setSaving(true);
    const result = await window.recall.updateMeetingTitle(meetingId, trimmed);
    setSaving(false);
    setEditing(false);

    if (result.status === "ok") {
      onSaved(trimmed);
    } else {
      console.error("[EditableTitle] Failed to save title", result.error);
      setValue(title ?? "");
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setValue(title ?? "");
            setEditing(false);
          }
        }}
        className="w-full min-w-0 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-sm font-medium text-gray-800 outline-none focus:border-gray-500"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="max-w-full truncate text-left font-medium text-gray-800 hover:underline"
    >
      {title ?? "Untitled meeting"}
    </button>
  );
}
