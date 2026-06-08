#!/usr/bin/env bash
set -euo pipefail

docker compose -f compose.yaml down
echo "subscription-manager compose stopped."
echo "This does not remove shared-data data or any Docker volume."
