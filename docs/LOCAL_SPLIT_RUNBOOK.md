# Local Split Runbook

This is the local operating guide for the split deployment.

## Required Projects

- `/vol1/1000/docker/shared-data`
- `/vol1/1000/docker/gateway-caddy`
- `/vol1/1000/docker/subscription_manager`

## Startup Sequence

1. Start `shared-data`
2. Start `gateway-caddy`
3. Start `subscription-manager`

## Stop Sequence

1. Stop `subscription-manager`
2. Stop `gateway-caddy`
3. Stop `shared-data`

## subscription-manager Commands

```bash
cd /vol1/1000/docker/subscription_manager
cp .env.split.example .env
chmod +x scripts/local-app-up.sh scripts/local-app-down.sh
./scripts/local-app-up.sh
```

## Expected Checks

- `http://localhost:8084/health`
- `http://localhost:8084/config`
- `http://localhost:8084/sub/<有效token>?target=clash`

## Stop Sequence

```bash
cd /vol1/1000/docker/subscription_manager
./scripts/local-app-down.sh
```

## Notes

- `subscription-manager` does not include MongoDB or Redis anymore.
- MongoDB and Redis are provided by `shared-data`.
- `gateway-caddy` is the only public reverse proxy entrypoint.
- `gateway-caddy` is pure reverse proxy and does not host `frontend/dist`.
- `web` uses `frontend/Dockerfile` and Nginx to serve `dist`.
- `app` keeps the service name `app` for compatibility with internal references.
- `subconverter` keeps the service name `subconverter` for compatibility.
- `shared-data` keeps MongoDB/Redis service names `mongodb`/`redis` on `data_net`.
- Local Redis uses `protected-mode no` because it is never exposed on the host and only accepts container traffic on `data_net`.
- Real secrets belong in the runtime `.env`, not in Git.
- The legacy monolithic compose files are kept only as historical references.
- `compose.yaml` is the authoritative local split entry.
