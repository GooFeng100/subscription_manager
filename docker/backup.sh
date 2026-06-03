#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
PROJECT_NAME="${PROJECT_NAME:-subscription_manager}"
MONGO_VOLUME="${MONGO_VOLUME:-${PROJECT_NAME}_mongodb_data}"
REDIS_VOLUME="${REDIS_VOLUME:-${PROJECT_NAME}_redis_data}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

backup_volume() {
  local volume="$1"
  local name="$2"
  docker run --rm \
    -v "${volume}:/data:ro" \
    -v "${BACKUP_DIR}:/backup" \
    alpine:3.20 \
    sh -lc "cd /data && tar -czf /backup/${name}-${STAMP}.tar.gz ."
  echo "$BACKUP_DIR/${name}-${STAMP}.tar.gz"
}

echo "MongoDB backup: $(backup_volume "$MONGO_VOLUME" "mongodb")"
echo "Redis backup:   $(backup_volume "$REDIS_VOLUME" "redis")"
