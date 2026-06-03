#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <volume-name> <archive-path>" >&2
  echo "Example: $0 subscription_manager_mongodb_data ./backups/mongodb-20260602-120000.tar.gz" >&2
  exit 1
fi

VOLUME_NAME="$1"
ARCHIVE_PATH="$2"

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "$(cd "$(dirname "$ARCHIVE_PATH")" && pwd):/backup" \
  alpine:3.20 \
  sh -lc "cd /data && tar -xzf /backup/$(basename "$ARCHIVE_PATH")"

echo "Restored ${VOLUME_NAME} from ${ARCHIVE_PATH}"
