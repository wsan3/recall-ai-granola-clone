<p align="center">
  <img src="assets/granola-clone-logo.png" alt="Granola clone logo" width="420" />
</p>

# Granola Clone — built on Recall.ai's Desktop Recording SDK

[![CI](https://github.com/wsan3/recall-ai-granola-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/wsan3/recall-ai-granola-clone/actions/workflows/ci.yml)

A demo AI meeting notepad, in the spirit of [Granola](docs/granola.md), built to showcase [Recall.ai](https://recall.ai)'s meeting platform for prospective customers building similar products.

Unlike a typical "bot joins your call" meeting recorder, this app uses Recall's **Desktop Recording SDK** to detect and capture meetings locally, without ever adding a visible participant to the call — matching how Granola itself actually works.

## What it does

1. Launch the desktop app. It detects when you join a call (Zoom or Google Meet) and starts recording automatically — no bot, no admission prompt, nothing visible in the call.
2. While the call is live, transcript lines stream in with speaker labels and a "who's talking" indicator, and you can jot down quick notes of your own.
3. When the call ends, your notes and the transcript are sent for AI synthesis: an OpenAI pass expands on what your notes only hinted at, producing structured notes that cite the exact transcript lines they're based on.
4. The Meeting Detail view shows your own notes in black next to the AI-expanded notes in gray. Click any gray note and the embedded recording seeks to that moment while the transcript scrolls to and highlights the source lines.
5. A Past Meetings list keeps every recorded meeting available to revisit.

## Recall.ai features used

- **Desktop Recording SDK** — meeting detection and capture with no visible participant
- **Real-time transcription in-process** — `recallai_streaming` + `desktop_sdk_callback` delivers live transcript/participant events straight into the app, no webhook hop
- **SDK Upload lifecycle webhooks** — verified `sdk_upload.*` handling
- **Recording + media shortcuts** — `media_shortcuts.video_mixed` for post-call playback
- **Webhook signature verification** — HMAC verification per Recall's Svix-based scheme

Full rationale and data flow: [`docs/architecture.md`](docs/architecture.md). For exactly where each Recall API/SDK call and webhook lives in the code, see [`docs/recall-snippets.md`](docs/recall-snippets.md).

## Repository structure

```
backend/    Next.js (API routes only) — issues SDK upload tokens, receives Recall webhooks, runs AI note synthesis, persists data (Prisma/SQLite)
desktop/    Electron Forge + React app — the user-facing notepad client, built on @recallai/desktop-sdk
docs/       Architecture, Recall feature map, and product background notes
Makefile    Every setup/lint/typecheck/test/format command below, and what CI runs (`make ci`)
```

## Setup

You'll run three things locally: the backend, a public tunnel to it (for Recall's webhook), and the desktop app. `make setup` installs both projects' dependencies plus the root-level git hooks in one shot (equivalent to running `npm install` in `backend/`, `desktop/`, and the repo root).

```bash
make setup
```

**1. Backend config**

```bash
cd backend && cp .env.example .env   # then fill in the values below
cd ..
make migrate                          # creates the local SQLite schema
```

Fill in `backend/.env`:

- `RECALL_API_KEY` — from the [Recall dashboard](https://us-west-2.recall.ai/dashboard/developers/api-keys) for your region
- `RECALL_REGION` — must match the API key's region (`us-west-2`, `us-east-1`, `eu-central-1`, or `ap-northeast-1`)
- `RECALL_WORKSPACE_VERIFICATION_SECRET` — same dashboard, used to verify incoming webhooks
- `PUBLIC_API_BASE_URL` — a stable public URL for the backend (see step 2 below)
- `OPENAI_API_KEY` — used for the post-call notes synthesis pass

**2. Public tunnel + webhook subscription**

Recall needs a public URL to deliver the `sdk_upload.*` webhook to. In local dev, a tunnel works:

```bash
ngrok http --domain=<your-static-domain> 3000
```

Then, in the Recall dashboard, create a webhook endpoint pointing at `https://<your-domain>/api/webhooks/recall`, subscribed to `sdk_upload.complete`, `sdk_upload.uploading`, and `sdk_upload.failed`. Set `PUBLIC_API_BASE_URL` in `backend/.env` to that same domain.

See [`desktop/README.md`](desktop/README.md) for macOS permissions setup (required once, in dev mode) and app structure.

## Running the app

Once setup is done, every day-to-day run looks like this — three things, each in
its own terminal:

```bash
make dev-backend     # terminal 1 — Next.js on http://localhost:3000
ngrok http --domain=<your-static-domain> 3000   # terminal 2 (skip if already running)
make dev-desktop      # terminal 3 — opens the Electron window
```

Verify the backend came up before starting the desktop app: `curl http://localhost:3000/api/health` should return `{"status":"ok", ...}`.

Then:

1. **Grant OS permissions** (macOS, once per machine) — the Electron window will prompt for microphone, screen recording, and accessibility access the first time it starts. See [`desktop/README.md`](desktop/README.md) if the prompts don't show up as expected in dev mode.
2. **Join a call** — start or join a meeting in Zoom Desktop or Google Meet (Chrome). The app detects the meeting window automatically and starts recording; no bot joins the call and nothing changes for other participants.
3. **Watch it work** — the "Live meeting" tab fills in with a live transcript (speaker labels + a "who's talking" indicator) as people talk. Type your own quick notes in the left panel as you go.
4. **End the call** — once the meeting window closes, the banner shows "wrapping up…" while the transcript + your notes are sent to the backend for AI synthesis, then the app jumps straight to that meeting's detail view.
5. **Review the notes** — your notes appear in black, the AI-expanded notes in gray underneath. Click any gray note to seek the embedded recording to that moment and highlight the transcript lines it came from.
6. **Revisit anytime** — the "Past meetings" tab lists every recorded meeting; click one to reopen its detail view, or click its title to rename it.

> **Dev note:** if you add or change an `ipcMain.handle`/event listener in `desktop/src/main.ts`, fully restart `make dev-desktop` (kill the process, don't rely on the Vite hot-reload log line). Electron's `app.on("ready")` only fires once per real OS process, so newly-registered handlers won't take effect until a real restart — a stale process will throw `No handler registered for '<channel>'` when the renderer calls it.

## Testing & CI

| Command                        | What it runs                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `make lint`                    | ESLint for both `backend/` and `desktop/`                                              |
| `make typecheck`               | `tsc --noEmit` for both projects                                                       |
| `make test`                    | Vitest unit/component tests for both projects (fast, no DB/server needed)              |
| `make test-integration`        | Backend route-handler tests against a disposable SQLite DB (see `tests/integration/`)  |
| `make test-e2e`                | Playwright hitting a real `next build && next start` server, Recall/OpenAI calls faked |
| `make format` / `format-check` | Prettier write / check across the whole repo                                           |
| `make ci`                      | All of the above, in the order CI runs them — the local way to reproduce a CI failure  |

[GitHub Actions](.github/workflows/ci.yml) runs three jobs on every push/PR: **Backend** (lint, typecheck, unit, integration, e2e), **Desktop** (lint, typecheck, unit + component), and **Formatting**. Desktop intentionally has no E2E layer — its Vitest suite already covers the `useRecallSession` reducer regression that would have most benefited from one, and a full Electron+Playwright harness (packaging, IPC test hooks, a fake backend) was more complexity than this demo's scope called for.

A husky **pre-commit hook** runs Prettier (via lint-staged) on staged files automatically — set up for you by `npm install`/`make setup` at the repo root.

## Why the Desktop SDK instead of a Meeting Bot

Granola's core differentiator is that it never joins your call as a visible participant — it runs locally and detects meetings on your machine. Recall's Meeting Bot API would have been the safer, faster build (pure backend, no OS constraints), but it would produce a demo of "a generic meeting recorder," not of Granola specifically. The Desktop SDK is the primitive that actually matches Granola's real architecture, at the cost of extra client-side complexity (Electron packaging, macOS permissions, meeting-detection edge cases). That trade-off, and the alternatives considered (including Recall's botless Meeting Direct Connect), are discussed in [`docs/architecture.md`](docs/architecture.md).

## Known limitations / future work

- **Windows** — built and tested on macOS (Apple Silicon) only; the SDK also supports Windows 10+, untested here
- **Teams and Safari-based Meet** — need `full-disk-access`, which this app doesn't request; use Zoom Desktop or Google Meet in Chrome instead
- **Production packaging/code-signing** — runs unpacked in dev mode; Recall ships a patched `osx-sign` fork for real distribution
- **Calendar integration** — no auto-scheduling; the app only reacts to meetings detected live on the machine it runs on
- **Meeting Direct Connect** — a botless server-side alternative (Zoom RTMS / Google Meet Media API) worth evaluating, not implemented here
- **Third-party STT providers** — only Recall's own streaming transcription is wired up (AssemblyAI/Deepgram/Speechmatics are supported by Recall but not used here)

Full list: [`docs/architecture.md`](docs/architecture.md#known-limitations--not-implemented).
