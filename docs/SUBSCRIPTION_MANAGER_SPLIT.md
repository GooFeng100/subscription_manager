# Subscription Manager Split

This document describes the local split state for the `subscription-manager` business app.

## Split Responsibilities

- `gateway-caddy`
  - Pure reverse proxy only
  - Does not host `frontend/dist`
  - Local entrypoint: `8084:80`
  - Cloud entrypoint: `80:80`, `443:443`, `443:443/udp`
- `shared-data`
  - Shared MongoDB + Redis only
  - MongoDB service name: `mongodb`
  - Redis service name: `redis`
  - Container names: `shared-mongo`, `shared-redis`
  - External network: `data_net`
- `subscription-manager`
  - Business app only
  - Contains `web`, `app`, `subconverter`
  - `web` uses Nginx to serve `frontend/dist`
  - `app` uses Node to serve backend APIs
  - `subconverter` stays inside the internal app network

## Authority Files

- `compose.yaml` is the authoritative local split entry for `subscription-manager`
- The old monolithic compose files and the reverse proxy directory have been removed from the main branch
- If you need the old layout, inspect Git history instead of current files

## Why Service Names Stay Stable

The service names are intentionally kept as:

- `app`
- `subconverter`
- `mongodb`
- `redis`

This keeps existing internal dependencies working, especially the backend code that builds internal URLs using `app:3000` and the default backend/runtime settings that already expect `subconverter`, `mongodb`, and `redis`.

For `shared-data`, the service names stay `mongodb` and `redis` while the container names become `shared-mongo` and `shared-redis`.

## Network Model

- `gateway_net`
  - Shared by `gateway-caddy`, `subscription-manager web`, and `subscription-manager app`
- `data_net`
  - Shared by `subscription-manager app` and `shared-data`
- `subscription_internal`
  - Private network inside the business app stack
  - Shared by `web`, `app`, and `subconverter`

## Shared Redis Mode

- `shared-data` runs Redis with `protected-mode no` for local Docker-only access
- Redis is not published on the host, so the only clients are containers on `data_net`
- This keeps local container networking simple while avoiding host port exposure
- Cloud deployments may choose `requirepass` and stricter access control

## Local Startup Order

1. Start `shared-data`
2. Start `gateway-caddy`
3. Start `subscription-manager`

## Local Stop Order

1. Stop `subscription-manager`
2. Stop `gateway-caddy`
3. Stop `shared-data`

## Common Problems

- `/health 502`
  - `app` is not running or cannot reach MongoDB/Redis
- `/config 502`
  - `app` is running but cannot read runtime settings from MongoDB
- `web 502`
  - `gateway-caddy` cannot reach `web:80`
- MongoDB connection failed
  - `data_net` missing or `MONGODB_URI` still points to the old stack
- Redis connection failed
  - `data_net` missing or `REDIS_URL` still points to the old stack
- subconverter connection failed
  - `subconverter` is not on `subscription_internal` or `CONVERTER_BACKEND_URL` is wrong
- `8084` already occupied
  - Another Caddy or reverse proxy stack is still bound to the port

## Cloud Migration Notes

- Cloud gateway-caddy should move to `80/443`
- `APP_BASE_URL` must change to the real HTTPS domain
- `SESSION_COOKIE_SECURE=true` in production
- Always back up MongoDB before migration
- Never treat any removed monolithic compose file as a deployment target
