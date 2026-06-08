#!/usr/bin/env sh
set -eu

PROJECT_NAME="${PROJECT_NAME:-subscription-manager}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"
WEB_IMAGE="${WEB_IMAGE:-subscription-manager-web:latest}"

echo "[1/4] Stop frontend web container only..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" stop web >/dev/null 2>&1 || true

echo "[2/4] Remove old frontend image if exists..."
docker image rm -f "$WEB_IMAGE" >/dev/null 2>&1 || true

echo "[3/4] Build frontend image without cache..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" build --no-cache web

echo "[4/4] Recreate frontend web only..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --force-recreate --no-deps web

echo "Done. Frontend rebuild completed for project '$PROJECT_NAME'."
