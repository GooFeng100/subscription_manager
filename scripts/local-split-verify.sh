#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/local-split-verify.sh [token]

Without a token, the script verifies container status, network presence, port mapping,
/health, and /config.

With a token, it also verifies:
  /sub/<token>?target=clash
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

token="${1:-}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

echo "== docker ps =="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

require_running() {
  local name="$1"
  local state
  state="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || true)"
  [[ "$state" == "true" ]] || fail "container not running: $name"
  pass "container running: $name"
}

require_network() {
  local name="$1"
  docker network inspect "$name" >/dev/null 2>&1 || fail "network missing: $name"
  pass "network present: $name"
}

require_running shared-mongo
require_running shared-redis
require_running gateway-caddy
require_running subscription-manager-web
require_running subscription-manager-app
require_running subscription-manager-subconverter

require_network gateway_net
require_network data_net

if docker port gateway-caddy 80/tcp 2>/dev/null | grep -q '8084'; then
  pass "gateway-caddy exposes 8084:80"
else
  fail "gateway-caddy does not expose 8084:80"
fi

echo "== health =="
curl -fsS http://localhost:8084/health >/dev/null
pass "GET /health"

echo "== config =="
curl -fsS http://localhost:8084/config >/dev/null
pass "GET /config"

if [[ -n "$token" ]]; then
  echo "== subscription =="
  curl -fsS "http://localhost:8084/sub/${token}?target=clash" >/dev/null
  pass "GET /sub/<token>?target=clash"
else
  echo "SKIP: token not provided, skipping /sub/<token> check"
fi

echo "All requested split verification checks passed."
