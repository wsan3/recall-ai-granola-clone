# Desktop

Electron Forge (Vite + TypeScript + React) app. This is the user-facing client: it initializes the [Desktop Recording SDK](https://docs.recall.ai/docs/desktop-sdk), detects meetings locally, requests an upload token from the backend, and starts recording — no visible bot ever joins the call. See [`../docs/architecture.md`](../docs/architecture.md) for the full picture.

## Setup

```bash
npm install
npm start   # backend must already be running on http://localhost:3000 (see ../backend/README.md)
```

By default the app points at `http://localhost:3000` for its backend and `https://us-west-2.recall.ai` as the Recall API URL. Override either with environment variables if needed (neither is a secret - the actual Recall API key stays server-side):

```bash
BACKEND_URL=https://your-backend RECALL_API_URL=https://us-east-1.recall.ai npm start
```

## macOS permissions (development mode)

The Desktop SDK needs Accessibility, Microphone, and Screen Recording permissions to detect and capture meetings. **In development** (running unpackaged via `npm start`), macOS attributes these permission requests to whatever app is hosting the terminal process that launched Electron - e.g. **Cursor**, VS Code, or iTerm - not to the Electron app itself. This is documented Desktop SDK behavior, not a bug in this app.

To grant permissions during development:

1. Run `npm start`. macOS will prompt for Accessibility, Microphone, and Screen Recording.
2. In **System Settings → Privacy & Security**, enable the permission for your terminal/IDE app (e.g. Cursor) under each of **Accessibility**, **Microphone**, and **Screen Recording**.
   - Microphone only appears in that list _after_ the app has actually attempted to access it once - if you don't see it yet, relaunch `npm start` first.
3. Fully quit and reopen the terminal/IDE app (not just the Electron process) for Accessibility/Screen Recording changes to take effect.
4. Relaunch `npm start`. You should see a `permissions-granted` event in the app's event log.

Once the app is code-signed and packaged for distribution (`npm run make`), permissions attribute to the packaged app itself instead - see [Publishing Your App](https://docs.recall.ai/docs/publishing-your-app) for the production packaging/signing requirements (Electron Forge's default `osx-sign` needs Recall's fork to sign the SDK's bundled binary correctly).

## Structure

- `src/main.ts` — owns the Desktop SDK: init, permissions, meeting-detection → upload-token → `startRecording`, relays all SDK events to the renderer over IPC, and proxies backend calls (`finish-meeting`, `list-meetings`, `get-meeting`) so the renderer never talks to the backend directly (avoids CORS)
- `src/preload.ts` — `contextBridge` exposing a narrow `window.recall` API to the renderer: event subscriptions plus the three backend-proxying calls above
- `src/useRecallSession.ts` — the live-session state machine (permissions, transcript, active speakers, participant events) plus `finishMeeting()`, fired once a meeting ends
- `src/ipcEvents.ts` — the full main ↔ renderer IPC contract in one file, so a mismatch is a compile error
- `src/App.tsx` — top-level view switcher: **Live meeting** (notepad + live transcript + speaker indicator), **Past meetings** (list), **Meeting Detail** (black/gray notes + video + transcript, click-to-jump citations)
- `src/components/` — the React components for each of the above, plus a collapsible raw-event-log panel kept around for verification
- `src/config.ts` — non-secret `BACKEND_URL` / `RECALL_API_URL` config
