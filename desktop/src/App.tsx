import { useEffect, useState } from "react";

type LogEntry = {
  id: number;
  at: string;
  channel: "sdk-event" | "meeting";
  payload: unknown;
};

let nextId = 0;

/**
 * Scaffold-verification UI: a raw event log for the SDK lifecycle, so we can
 * confirm permissions/init/meeting-detection/recording actually work before
 * building the polished live notepad UI on top of this.
 */
export function App() {
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    const append = (channel: LogEntry["channel"]) => (payload: unknown) => {
      setLog((prev) =>
        [{ id: nextId++, at: new Date().toLocaleTimeString(), channel, payload }, ...prev].slice(
          0,
          200
        )
      );
    };

    const offSdkEvent = window.recall.on("sdk-event", append("sdk-event"));
    const offMeeting = window.recall.on("meeting", append("meeting"));

    return () => {
      offSdkEvent();
      offMeeting();
    };
  }, []);

  return (
    <div style={{ fontFamily: "monospace", padding: "1.5rem", color: "#111" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Granola clone (desktop)</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Listening for the Desktop SDK's lifecycle and real-time events. This raw log will be
        replaced by the live notepad UI.
      </p>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "0.75rem",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        {log.length === 0 && <p style={{ color: "#999" }}>Waiting for events…</p>}
        {log.map((entry) => (
          <div key={entry.id} style={{ marginBottom: "0.5rem", fontSize: 12 }}>
            <span style={{ color: "#999" }}>[{entry.at}]</span>{" "}
            <span style={{ fontWeight: "bold" }}>{entry.channel}</span>{" "}
            <span>{JSON.stringify(entry.payload)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
