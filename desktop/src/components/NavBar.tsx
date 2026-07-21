export type Screen = { name: "live" } | { name: "meetings" } | { name: "meeting-detail"; meetingId: string };

function tabClass(active: boolean): string {
  return `rounded-md px-3 py-1.5 text-sm font-medium ${
    active ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"
  }`;
}

export function NavBar({
  screen,
  onNavigate,
  justFinishedMeetingId,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  justFinishedMeetingId: string | null;
}) {
  const onPastMeetingsTab = screen.name === "meetings" || screen.name === "meeting-detail";

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <button className={tabClass(screen.name === "live")} onClick={() => onNavigate({ name: "live" })}>
        Live meeting
      </button>
      <button className={tabClass(onPastMeetingsTab)} onClick={() => onNavigate({ name: "meetings" })}>
        Past meetings
      </button>

      {justFinishedMeetingId && (
        <button
          onClick={() => onNavigate({ name: "meeting-detail", meetingId: justFinishedMeetingId })}
          className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          View notes →
        </button>
      )}
    </div>
  );
}
