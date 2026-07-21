# Granola Clone — built on Recall.ai's Desktop Recording SDK

A demo AI meeting notepad, in the spirit of [Granola](docs/granola.md), built to showcase [Recall.ai](https://recall.ai)'s meeting platform for prospective customers building similar products.

Unlike a typical "bot joins your call" meeting recorder, this app uses Recall's **Desktop Recording SDK** to detect and capture meetings locally, without ever adding a visible participant to the call — matching how Granola itself actually works. See [`docs/implementation-plan.md`](docs/implementation-plan.md) for the full architecture, rationale, and build plan, and [`docs/assessment.md`](docs/assessment.md) for the assessment this was built for.

## Status

This project is under active development, following the checkpointed build sequence in [`docs/implementation-plan.md`](docs/implementation-plan.md). Each checkpoint is committed separately.

## Repository structure

```
backend/    Next.js (API routes only) — issues SDK upload tokens, receives Recall webhooks, runs AI note synthesis, persists data (Prisma/SQLite)
desktop/    Electron Forge + React app — the user-facing notepad client, built on @recallai/desktop-sdk
docs/       Product background, the assessment brief, and the implementation plan
```

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `RECALL_API_KEY` — from the [Recall dashboard](https://us-west-2.recall.ai/dashboard/developers/api-keys) for your region
   - `RECALL_REGION` — must match the API key's region (`us-west-2`, `us-east-1`, `eu-central-1`, or `ap-northeast-1`)
   - `RECALL_WORKSPACE_VERIFICATION_SECRET` — created in the same dashboard, used to verify incoming webhooks
   - `PUBLIC_API_BASE_URL` — a stable public URL for the backend (a static ngrok domain works for local dev)
   - `OPENAI_API_KEY` — used for the post-call notes synthesis pass
2. See `backend/README.md` and `desktop/README.md` (added as those pieces are built) for how to run each half of the app.

## Why the Desktop SDK instead of a Meeting Bot

Granola's core differentiator is that it never joins your call as a visible participant — it runs locally and detects meetings on your machine. Recall's Meeting Bot API would have been the safer, faster build (pure backend, no OS constraints), but it would produce a demo of "a generic meeting recorder," not of Granola specifically. The Desktop SDK is the primitive that actually matches Granola's real architecture, at the cost of extra client-side complexity (Electron packaging, macOS permissions, meeting-detection edge cases). That trade-off, and the alternatives considered (including Recall's botless Meeting Direct Connect), are discussed in [`docs/implementation-plan.md`](docs/implementation-plan.md).
