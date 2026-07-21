.PHONY: setup setup-backend setup-desktop \
	dev-backend dev-desktop \
	lint lint-backend lint-desktop \
	typecheck typecheck-backend typecheck-desktop \
	test test-backend test-desktop \
	test-integration \
	test-e2e \
	format format-check \
	ci clean

# Installs dependencies for both npm projects (backend/, desktop/) plus the
# root-level git hooks (husky). Run this first on a fresh clone.
setup: setup-backend setup-desktop
	npm install

setup-backend:
	cd backend && npm install

setup-desktop:
	cd desktop && npm install

# Runs the Next.js backend dev server. Needs backend/.env - see README.md.
dev-backend:
	cd backend && npm run dev

# Runs the Electron app. Needs the backend (and, for real meetings, ngrok)
# already running - see README.md.
dev-desktop:
	cd desktop && npm start

lint: lint-backend lint-desktop

lint-backend:
	cd backend && npm run lint

lint-desktop:
	cd desktop && npm run lint

typecheck: typecheck-backend typecheck-desktop

typecheck-backend:
	cd backend && npx tsc --noEmit

typecheck-desktop:
	cd desktop && npx tsc --noEmit

# Unit + component tests only (fast, no DB/server/browser needed).
test: test-backend test-desktop

test-backend:
	cd backend && npm run test

test-desktop:
	cd desktop && npm run test

# Backend integration tests spin up a disposable SQLite DB - see
# backend/tests/integration/global-setup.ts.
test-integration:
	cd backend && npm run test:integration

# Backend E2E builds and starts a real (throwaway) Next.js server - see
# backend/playwright.config.ts. Desktop has no E2E suite by design; its
# reducer unit tests cover the one regression that would most benefit
# from one.
test-e2e:
	cd backend && npm run test:e2e

format:
	npx prettier --write .

format-check:
	npx prettier --check .

# What CI runs, in the same order, so you can reproduce a CI failure locally.
ci: lint typecheck test test-integration test-e2e format-check

clean:
	rm -rf backend/.next backend/.next-e2e backend/node_modules backend/prisma/*.db*
	rm -rf desktop/.vite desktop/out desktop/node_modules
	rm -rf node_modules
