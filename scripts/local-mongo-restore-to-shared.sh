#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/local-mongo-restore-to-shared.sh [archive-path]

Restores a subscription_manager MongoDB archive into shared-mongo using --drop.
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
archive_path="${1:-}"
if [[ -z "$archive_path" ]]; then
  latest="$(ls -1t "$project_root"/backups/subscription_manager_local_*.archive.gz 2>/dev/null | head -n 1 || true)"
  archive_path="$latest"
fi

if [[ -z "$archive_path" ]]; then
  echo "ERROR: archive path is required and no backup archive was found in backups/." >&2
  exit 1
fi

if ! docker inspect shared-mongo >/dev/null 2>&1; then
  echo "ERROR: shared-mongo is not running or not reachable." >&2
  exit 1
fi

if [[ ! -f "$archive_path" ]]; then
  echo "ERROR: archive file does not exist: $archive_path" >&2
  exit 1
fi

cat <<INFO
Archive to restore: $archive_path
Target container: shared-mongo
WARNING: this restore uses mongorestore --drop and will replace matching collections in the shared MongoDB database.
INFO

read -r -p "Type YES to continue with restore into shared-mongo: " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "Aborted by user."
  exit 1
fi

container_archive="/tmp/subscription_manager.archive.gz"
docker cp "$archive_path" shared-mongo:"$container_archive"
docker exec shared-mongo mongorestore --archive="$container_archive" --gzip --drop

echo "Restore completed successfully."
echo "You should verify database names and collection lists with mongosh next."
