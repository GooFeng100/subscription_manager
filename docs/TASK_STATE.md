# TASK_STATE

## Date

2026-06-01

## Round Goal

Implement Stage 2 (users + one-time activation codes) with backend APIs, minimal frontend management page, and Docker verification.

## Project Current Status

- Project root: `/vol1/1000/docker/subscription_manager`
- This round completed core Stage 2 backend capabilities and a minimal Stage 2 UI entry page.
- Business code changed in backend routes/db schema and frontend `App.vue`.

## Current Completed Stage

- Stage 0 scaffold: completed.
- Stage 1 auth foundation: completed and retained.
- Stage 2 core backend (user status management, one-time code flow, renew logs): completed in this round.
- Stage 2 minimal management page: completed in this round.

## Docker Status

- `docker compose up -d --build app caddy` and `docker compose up -d --build`: success.
- Containers status: `subscription-manager-app`, `subscription-manager-caddy`, `subscription-manager-mongodb`, `subscription-manager-redis` are `Up`.
- `mongodb` and `redis` health checks remain healthy.
- Compose warning persists: both `compose.yaml` and `docker-compose.yml` exist; compose uses `compose.yaml`.

## API Status

Verified via `http://127.0.0.1:8084`:

- `GET /`: `200 OK`
- `GET /health`: `200 OK`
- Stage 2 API functional checks:
  - `POST /api/admin/codes`: `201`
  - `POST /api/redeem`: `200`
  - `GET /api/admin/renew-logs`: `200`
  - second redeem with same code returns `409` (one-time use enforced)

## Task Spec Reference

- Canonical task-book file: `docs/DEV_TASK.md`
- Active milestone target: Stage 2

## Changes In This Round

- Added: `backend/src/routes/stage2.ts`
- Updated: `backend/src/lib/db.ts` (activation codes + renew logs types/collections/indexes)
- Updated: `backend/src/index.ts` (mount Stage 2 routes)
- Updated: `caddy/Caddyfile` (fix API-first route handling to avoid SPA fallback swallowing `/api`)
- Updated: `frontend/src/App.vue` (minimal Stage 2 operations page)
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1150,1235p' docs/DEV_TASK.md`
- `docker compose up -d --build app caddy`
- `docker compose up -d --build`
- `docker compose ps`
- `docker exec subscription-manager-caddy cat /etc/caddy/Caddyfile`
- `curl http://127.0.0.1:8084/`
- `curl http://127.0.0.1:8084/health`
- API flow tests:
  - admin login
  - user register/login
  - code create/list
  - redeem
  - renew logs query
  - repeat redeem conflict check

## Test Results

- End-to-end Stage 2 core flow works:
  - newly registered user starts as `inactive`
  - redeem success switches user to `active`
  - `expire_at` and `disable_after` are calculated and returned
  - same code second redeem fails with `409`
  - renew logs are written and queryable
- Caddy/API routing issue was found and fixed in this round.
- Note: local `npm run typecheck` in host shell failed because local toolchain is not installed (`tsc: not found`), but Docker build pipeline compiles backend/frontend successfully.

## Next Tasks

1. Continue Stage 2 polishing: add admin endpoints for code copy/revoke/delete UI controls and manual renew controls refinement.
2. Add explicit concurrent redeem stress test script (parallel requests) to hard-verify single-success behavior under load.
3. After Stage 2 acceptance confirmation, commit and push milestone to GitHub.

## Open Issues

- Non-blocking: duplicate compose filename warning still exists.
- Optional hardening: add database transaction/session wrapper for redeem + user update + renew log write to strengthen atomicity guarantees.
