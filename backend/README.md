# Backend

API-only Next.js app. Issues Recall.ai Desktop SDK upload tokens, receives Recall's `sdk_upload.*` webhook, runs the post-call AI notes synthesis pass, and persists everything to SQLite via Prisma. See [`../docs/architecture.md`](../docs/architecture.md) for the full picture — this is the backend half of that diagram.

## Setup

```bash
cp .env.example .env   # then fill in RECALL_API_KEY, RECALL_WORKSPACE_VERIFICATION_SECRET, OPENAI_API_KEY, etc.
npm install
npx prisma migrate dev
npm run dev
```

Verify it's running:

```bash
curl http://localhost:3000/api/health
```

## Structure

- `src/app/api/health` — health check
- `src/app/api/sdk-uploads` — proxies Recall's Create Desktop SDK Upload, creates the local `Meeting`
- `src/app/api/webhooks/recall` — verified `sdk_upload.*` handler; fetches `media_shortcuts.video_mixed` on complete
- `src/app/api/meetings` / `src/app/api/meetings/[id]` — list/detail for the Past Meetings and Meeting Detail views
- `src/app/api/meetings/[id]/finish` — persists the client-collected transcript/notes, then runs the OpenAI synthesis pass
- `src/lib/recall.ts` — retry-aware Recall API client
- `src/lib/synthesize-notes.ts` — the OpenAI structured-output synthesis pass
- `src/lib/meeting-status.ts` — flips a `Meeting` to `ready` once both the video and the AI notes have landed
- `src/lib/prisma.ts` — Prisma client, wired to the `better-sqlite3` driver adapter
- `prisma/schema.prisma` — `Meeting` / `Utterance` / `ParticipantEvent` / `NoteBlock` models
