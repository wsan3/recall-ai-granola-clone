import logo from "../assets/granola-clone-logo.png";

export type Screen =
  { name: "live" } | { name: "meetings" } | { name: "meeting-detail"; meetingId: string };

function tabClass(active: boolean): string {
  return `rounded-md px-3 py-1.5 text-sm font-medium ${
    active ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"
  }`;
}

export function NavBar({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const onPastMeetingsTab = screen.name === "meetings" || screen.name === "meeting-detail";

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <img src={logo} alt="Granola clone" className="mr-1 h-7 w-7 rounded-full" />
      <button
        className={tabClass(screen.name === "live")}
        onClick={() => onNavigate({ name: "live" })}
      >
        Live meeting
      </button>
      <button
        className={tabClass(onPastMeetingsTab)}
        onClick={() => onNavigate({ name: "meetings" })}
      >
        Past meetings
      </button>
    </div>
  );
}
