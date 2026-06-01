# Subscription Manager

Stage 0 scaffold for the subscription aggregation authorization distribution system.
Stage 1 auth foundation is now available in backend APIs.

## Directory layout

- `backend/`: Node.js + TypeScript + Express backend
- `frontend/`: Vue 3 + Vite + TypeScript frontend scaffold
- `caddy/`: Caddy reverse proxy config
- `docker/`: reserved deployment files
- `compose.yaml`: default compose file for NAS visual UI

## Single domain/base-url variable

Use `APP_BASE_URL` as the single source of truth for service base URL.

- NAS/default local: `http://192.168.10.3:8084`
- Future production example: `https://sub.example.com`

Change only one place for containerized deployment:

1. Copy `.env.example` to `.env`
2. Edit `APP_BASE_URL` in `.env`

Frontend local dev uses `VITE_APP_BASE_URL` in `frontend/.env`.

## Start on NAS (visual compose UI)

The NAS UI usually auto-loads `compose.yaml`. This file is ready for build and run.

Expected services:

- `app` (builds from `backend/Dockerfile`)
- `caddy` (exposes `8084`)
- `mongodb`
- `redis`

## Start with CLI

```bash
cp .env.example .env
docker compose -f compose.yaml up -d --build
```

## Rebuild backend only (same project, no new project)

Use the script below when backend code changes and you want a forced rebuild:

```bash
cd /vol1/1000/docker/subscription_manager
chmod +x docker/rebuild-backend.sh
./docker/rebuild-backend.sh
```

Optional environment overrides:

```bash
PROJECT_NAME=subscription-manager COMPOSE_FILE=compose.yaml APP_IMAGE=subscription-manager-app:latest ./docker/rebuild-backend.sh
```

## Rebuild frontend only (same project, no new project)

```bash
cd /vol1/1000/docker/subscription_manager
chmod +x docker/rebuild-frontend.sh
./docker/rebuild-frontend.sh
```

Optional environment overrides:

```bash
PROJECT_NAME=subscription-manager COMPOSE_FILE=compose.yaml WEB_IMAGE=subscription-manager-web:latest ./docker/rebuild-frontend.sh
```

## Verify

```text
GET http://192.168.10.3:8084/
GET http://192.168.10.3:8084/health
GET http://192.168.10.3:8084/config
```

## Stage 1 auth APIs

All endpoints are under `http://192.168.10.3:8084/api/auth`.

```text
POST /api/auth/admin/login
POST /api/auth/register
POST /api/auth/login
POST /api/auth/change-password
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/admin/auth-logs
```

Default admin is auto-seeded from env:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeThisAdminPassword!
```

You should change `ADMIN_PASSWORD` in `.env` before production.

## Stage 1 one-shot regression test

```bash
cd /vol1/1000/docker/subscription_manager
chmod +x docker/test-stage1.sh
./docker/test-stage1.sh
```

Optional environment overrides:

```bash
BASE_URL=http://127.0.0.1:8084 ADMIN_USER=admin ADMIN_PASS=admin123456 ./docker/test-stage1.sh
```

## Backend local dev

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Frontend local dev

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
