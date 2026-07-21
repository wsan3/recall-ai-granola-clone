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

- `src/app/api/*` — API routes (health check, SDK upload proxy, webhooks, meetings CRUD)
- `src/lib/prisma.ts` — Prisma client, wired to the `better-sqlite3` driver adapter
- `prisma/schema.prisma` — `Meeting` / `Utterance` / `ParticipantEvent` / `NoteBlock` models
