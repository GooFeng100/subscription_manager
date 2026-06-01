#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:8084}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123456}"

TMP_DIR="${TMP_DIR:-/tmp/subscription-manager-stage1}"
mkdir -p "$TMP_DIR"
ADMIN_COOKIE_FILE="$TMP_DIR/admin.cookies"
USER_COOKIE_FILE="$TMP_DIR/user.cookies"

echo "[1/8] health check..."
READY=0
TRY=0
while [ "$TRY" -lt 30 ]; do
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  TRY=$((TRY + 1))
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "health check failed after retries, backend may not be ready" >&2
  exit 1
fi

echo "[2/8] admin login..."
curl -fsS -c "$ADMIN_COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  "$BASE_URL/api/auth/admin/login" >/dev/null

echo "[3/8] admin me..."
ADMIN_ME="$(curl -fsS -b "$ADMIN_COOKIE_FILE" "$BASE_URL/api/auth/me")"
echo "$ADMIN_ME" | grep -q '"userType":"admin"'

echo "[4/8] admin auth logs endpoint..."
curl -fsS -b "$ADMIN_COOKIE_FILE" "$BASE_URL/api/auth/admin/auth-logs?limit=5" | grep -q '"items"'

UNIQ="$(date +%s)"
USER_NAME="stage1_u_${UNIQ}"
OLD_PASS="stage1pass123"
NEW_PASS="stage1pass456"

echo "[5/8] user register..."
curl -fsS -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_NAME\",\"password\":\"$OLD_PASS\"}" \
  "$BASE_URL/api/auth/register" >/dev/null

echo "[6/8] user login + me..."
curl -fsS -c "$USER_COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_NAME\",\"password\":\"$OLD_PASS\"}" \
  "$BASE_URL/api/auth/login" >/dev/null
curl -fsS -b "$USER_COOKIE_FILE" "$BASE_URL/api/auth/me" | grep -q '"userType":"user"'

echo "[7/8] user change password + relogin..."
curl -fsS -b "$USER_COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d "{\"oldPassword\":\"$OLD_PASS\",\"newPassword\":\"$NEW_PASS\"}" \
  "$BASE_URL/api/auth/change-password" >/dev/null
curl -fsS -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_NAME\",\"password\":\"$NEW_PASS\"}" \
  "$BASE_URL/api/auth/login" >/dev/null

echo "[8/8] register burst limit..."
LIMIT_HIT=0
i=0
while [ "$i" -lt 12 ]; do
  BURST_USER="burst_stage1_${UNIQ}_${i}"
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$BURST_USER\",\"password\":\"burstpass123\"}" \
    "$BASE_URL/api/auth/register")"
  if [ "$STATUS" = "429" ]; then
    LIMIT_HIT=1
    break
  fi
  i=$((i + 1))
done

if [ "$LIMIT_HIT" -ne 1 ]; then
  echo "register burst limit was not triggered (expected at least one 429)" >&2
  exit 1
fi

echo "Stage 1 test passed."
