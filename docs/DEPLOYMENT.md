# Deployment Guide

This repository supports two deployment styles:

For the full end-to-end deployment and maintenance workflow, treat [`docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`](FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md) as the authoritative runbook.

## 1. NAS local deployment

Use `compose.yaml` in the NAS visual compose UI or from CLI.
This repository treats `compose.yaml` as the only authoritative Docker Compose file.
`docker-compose.yml` is a historical leftover and should not be used for deployment.

- Base URL: `http://192.168.10.3:8084`
- Exposed port: `8084`
- Internal services:
  - `app`
  - `caddy`
  - `mongodb`
  - `redis`

Recommended commands:

```bash
cp .env.example .env
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
```

## 2. Production deployment

Use the **outer** production deployment files under `/opt/apps/subscription-manager/` with a real domain and HTTPS.

Before starting production, copy `repo/.env.production.example` to the outer `.env.prod` and fill all required values.

Required environment variables:

- `APP_BASE_URL=https://your-domain.example`
- `MONGO_ROOT_USERNAME=submgr`
- `MONGO_ROOT_PASSWORD=...`
- `MONGODB_URI=mongodb://submgr:...@mongodb:27017/subscription_manager?authSource=admin`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_SECRET=...`

Recommended commands:

```bash
cp repo/.env.production.example .env.prod
vim .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

For a step-by-step cloud-server checklist, see [`docs/CLOUD_DEPLOYMENT_STEPS.md`](CLOUD_DEPLOYMENT_STEPS.md).

The production deployment model is:

- `repo/` is managed by GitHub
- outer `docker-compose.prod.yml` / `.env.prod` / `caddy/Caddyfile` / `deploy.sh` do **not** enter Git
- `git pull` only updates `repo/` and does not overwrite production configuration
- Caddy is a container service, not a host-installed Caddy or Nginx
- the exposed entrypoint is the Caddy container on `80/443`

The production stack uses:

- `caddy` on ports `80/443`
- MongoDB persistent volume
- Redis persistent volume
- `restart: unless-stopped` for auto recovery

## Backup

Production backup main plan is MongoDB logical backup with `mongodump` / `mongorestore`.

- `.env.prod`, `docker-compose.prod.yml`, `caddy/Caddyfile` must be backed up separately.
- `docker/backup.sh` / `docker/restore.sh` are local NAS or cold-backup supplements, not the daily first choice for production.
- See [`docs/BACKUP_RESTORE.md`](BACKUP_RESTORE.md) for details.

## Release tags

Recommended release tag policy: [`docs/RELEASE_TAG_POLICY.md`](RELEASE_TAG_POLICY.md).

## Verification

After deployment, verify:

```text
GET /health
GET /config
GET /api/auth/me
```

For NAS local deployment, the entry point should be:

```text
http://192.168.10.3:8084
```
