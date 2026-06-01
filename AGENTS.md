# AGENTS

## Project Scope

- This project is a brand-new subscription distribution management system and does not integrate `mail-code`.
- Project root directory is `/vol1/1000/docker/subscription_manager`.
- Frontend stack is Vue 3 + Vite + TypeScript, with one codebase compatible with Web and Mobile.
- Backend stack is Node.js + TypeScript + Express.
- Database is MongoDB.
- Cache is Redis.
- Anti-automation protection is Cloudflare Turnstile.
- Payment is not included for now; only manual authorization code flow is supported.
- Subscription aggregation calls the `subconverter` backend.

## Execution Rules

- All development, build, test, and `docker compose` commands must run in the NAS project directory `/vol1/1000/docker/subscription_manager`.
- Do not modify `mail-code`, `TradingApp`, or any other directory outside this project.
- Without explicit confirmation, do not run:
  - `rm -rf`
  - `docker volume rm`
  - `docker system prune`
  - any database wipe/clear operation
  - NAS reboot operations
  - edits under `/etc` system configuration

## Task State Sync Rules

- A task-state update is mandatory after each of these activities:
  - development implementation
  - refactor
  - API/interface testing
  - Docker/compose debugging
- The update target is `docs/TASK_STATE.md`.
- Required update fields include at least:
  - current goal and completion status
  - file changes and key commands executed
  - Docker/container status
  - API/interface status
  - next step and blockers
- A task is not considered complete unless `docs/TASK_STATE.md` has been updated in the same round.
