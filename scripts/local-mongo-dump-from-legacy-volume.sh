#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/local-mongo-dump-from-legacy-volume.sh [legacy-volume-name] [output-archive-path]

If no legacy volume is provided, the script tries the known local legacy MongoDB volume names.
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
backups_dir="$project_root/backups"
mkdir -p "$backups_dir"

if ! docker inspect shared-mongo >/dev/null 2>&1; then
  echo "ERROR: shared-mongo is not running or not reachable." >&2
  exit 1
fi

legacy_volume="${1:-}"
outfile="${2:-}"
if [[ -z "$outfile" ]]; then
  timestamp="$(date +%Y%m%d_%H%M%S)"
  outfile="$backups_dir/subscription_manager_local_${timestamp}.archive.gz"
fi

candidates=()
if [[ -n "$legacy_volume" ]]; then
  candidates+=("$legacy_volume")
else
  candidates+=("subscription_manager_mongodb_data" "subscription-manager_mongodb_data")
fi

selected_volume=""
db_list=""
collection_list=""

for volume in "${candidates[@]}"; do
  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    continue
  fi

  temp_name="inspect-dump-${volume//[^a-zA-Z0-9]/-}"
  docker rm -f "$temp_name" >/dev/null 2>&1 || true
  cleanup_temp() {
    docker rm -f "$temp_name" >/dev/null 2>&1 || true
  }
  trap cleanup_temp EXIT

  docker run -d --name "$temp_name" -v "$volume":/data/db mongo:7 >/dev/null

  for _ in $(seq 1 30); do
    if db_list_output="$(docker exec "$temp_name" mongosh --quiet --eval 'printjson(db.adminCommand({listDatabases:1}))' 2>/dev/null)"; then
      db_list="$db_list_output"
      break
    fi
    sleep 1
  done

  if [[ -z "$db_list" ]]; then
    docker rm -f "$temp_name" >/dev/null 2>&1 || true
    trap - EXIT
    continue
  fi

  if ! grep -q "subscription_manager" <<<"$db_list"; then
    docker rm -f "$temp_name" >/dev/null 2>&1 || true
    trap - EXIT
    continue
  fi

  collection_list="$(docker exec "$temp_name" mongosh --quiet --eval "const dbx = db.getSiblingDB('subscription_manager'); printjson(dbx.getCollectionNames())")"
  selected_volume="$volume"
  docker rm -f "$temp_name" >/dev/null 2>&1 || true
  trap - EXIT
  break
done

if [[ -z "$selected_volume" ]]; then
  echo "ERROR: no legacy volume with subscription_manager database was found." >&2
  exit 1
fi

cat <<INFO
Legacy volume: $selected_volume
Database list:
$db_list
Collections in subscription_manager:
$collection_list
Output archive: $outfile
INFO

read -r -p "This will dump the legacy MongoDB volume into '$outfile'. Type YES to continue: " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "Aborted by user."
  exit 1
fi

backup_container="dump-${selected_volume//[^a-zA-Z0-9]/-}"
docker rm -f "$backup_container" >/dev/null 2>&1 || true
cleanup_dump() {
  docker rm -f "$backup_container" >/dev/null 2>&1 || true
}
trap cleanup_dump EXIT

docker run -d --name "$backup_container" -v "$selected_volume":/data/db mongo:7 >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$backup_container" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$backup_container" mongodump --db subscription_manager --archive=/tmp/subscription_manager.archive.gz --gzip
mkdir -p "$(dirname "$outfile")"
docker cp "$backup_container:/tmp/subscription_manager.archive.gz" "$outfile"

if [[ ! -s "$outfile" ]]; then
  echo "ERROR: dump failed; archive file was not created." >&2
  exit 1
fi

echo "Backup completed: $outfile"
echo "NOTE: legacy volume was not modified or deleted."
