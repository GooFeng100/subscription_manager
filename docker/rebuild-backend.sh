#!/usr/bin/env sh
set -eu

PROJECT_NAME="${PROJECT_NAME:-subscription-manager}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"
APP_IMAGE="${APP_IMAGE:-subscription-manager-app:latest}"

echo "[1/5] Stop backend app container only..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" stop app >/dev/null 2>&1 || true

echo "[2/5] Remove old backend image if exists..."
docker image rm -f "$APP_IMAGE" >/dev/null 2>&1 || true

echo "[3/5] Build backend image without cache..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" build --no-cache app

echo "[4/5] Recreate and start backend app only..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --force-recreate --no-deps app

echo "[5/5] Verify backend routes are in built dist..."
docker exec subscription-manager-app sh -lc "grep -R \"admin/change-password\" -n /app/dist >/dev/null"
docker exec subscription-manager-app sh -lc "grep -R \"REGISTER_IP_LIMIT\" -n /app/dist >/dev/null"

echo "Done. Backend rebuild completed for project '$PROJECT_NAME'."
