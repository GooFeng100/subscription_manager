#!/usr/bin/env bash
set -euo pipefail

if ! docker network inspect gateway_net >/dev/null 2>&1; then
  echo "gateway_net does not exist. Start gateway-caddy first or create the network."
  exit 1
fi

if ! docker network inspect data_net >/dev/null 2>&1; then
  echo "data_net does not exist. Start shared-data first or create the network."
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env is missing. Copy .env.split.example to .env first."
  exit 1
fi

docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps

echo "--- subscription-manager-app logs ---"
docker logs --tail=80 subscription-manager-app
echo "--- subscription-manager-web logs ---"
docker logs --tail=80 subscription-manager-web
echo "Verification commands:"
echo "curl -i http://localhost:8084/health"
echo "curl -i http://localhost:8084/config"
