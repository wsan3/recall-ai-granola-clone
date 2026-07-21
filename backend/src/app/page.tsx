export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Granola clone — backend</h1>
      <p>
        This is an API-only service: it issues Recall.ai Desktop SDK upload
        tokens, receives Recall webhooks, runs note synthesis, and persists
        meeting data. There is no user-facing UI here — see the desktop app.
      </p>
      <p>
        Health check: <code>/api/health</code>
      </p>
    </main>
  );
}
