#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/vol1/1000/docker/subscription_manager"
BRANCH="${BRANCH:-master}"   # GitHub 默认分支为 master
COMMIT_MESSAGE="${1:-release: update subscription_manager}"
TAG_NAME="${2:-}"
YES="${YES:-false}"

BASE_URL="${BASE_URL:-http://127.0.0.1:8084}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"

# 可选：如需顺带测试订阅格式，可在执行前设置这些环境变量
# ACTIVE_TOKEN="xxx" EXPIRED_TOKEN="xxx" INACTIVE_TOKEN="xxx" DISABLED_TOKEN="xxx" scripts/nas-release.sh "commit message"
ACTIVE_TOKEN="${ACTIVE_TOKEN:-}"
EXPIRED_TOKEN="${EXPIRED_TOKEN:-}"
INACTIVE_TOKEN="${INACTIVE_TOKEN:-}"
DISABLED_TOKEN="${DISABLED_TOKEN:-}"

log() {
  echo
  echo "=============================="
  echo "$1"
  echo "=============================="
}

fail() {
  echo "❌ $1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

make_tag() {
  local base
  base="v$(date +%Y.%m.%d)"

  if ! git rev-parse "refs/tags/$base" >/dev/null 2>&1; then
    echo "$base"
    return
  fi

  local i=1
  while git rev-parse "refs/tags/$base-$i" >/dev/null 2>&1; do
    i=$((i + 1))
  done
  echo "$base-$i"
}

check_forbidden_tracked_files() {
  local forbidden_regex='(^|/)(\.env|\.env\.prod|.*\.local|docker-compose\.prod\.yml|deploy\.sh|backup-mongo\.sh|restore-mongo\.sh)$|(^|/)(backups|mongodb-data|redis-data|caddy-data|caddy-config|node_modules|dist)/'

  local tracked
  tracked="$(git ls-files | grep -E "$forbidden_regex" || true)"
  if [ -n "$tracked" ]; then
    echo "$tracked"
    fail "发现敏感文件或运行目录已被 Git 跟踪，请先从 Git 中移除。"
  fi
}

check_forbidden_staged_files() {
  local forbidden_regex='(^|/)(\.env|\.env\.prod|.*\.local|docker-compose\.prod\.yml|deploy\.sh|backup-mongo\.sh|restore-mongo\.sh)$|(^|/)(backups|mongodb-data|redis-data|caddy-data|caddy-config|node_modules|dist)/'

  local staged
  staged="$(git diff --cached --name-only | grep -E "$forbidden_regex" || true)"
  if [ -n "$staged" ]; then
    echo "$staged"
    git reset
    fail "暂存区包含禁止提交的敏感文件或运行目录，已取消暂存。"
  fi
}

stage_allowed_files() {
  local path
  local -a paths=()

  while IFS= read -r -d '' path; do
    case "$path" in
      .env|.env.prod|*.local|docker-compose.prod.yml|deploy.sh|backup-mongo.sh|restore-mongo.sh|caddy/Caddyfile|caddy/Caddyfile.prod)
        continue
        ;;
      backups/*|mongodb-data/*|redis-data/*|caddy-data/*|caddy-config/*|node_modules/*|dist/*)
        continue
        ;;
    esac
    paths+=("$path")
  done < <(git ls-files -m -o -d --exclude-standard -z)

  [ "${#paths[@]}" -eq 0 ] && return 0

  git add -- "${paths[@]}"
}

curl_expect_2xx() {
  local url="$1"
  local code
  code="$(curl -sS -o /tmp/nas-release-curl.out -w '%{http_code}' "$url" || true)"
  if [[ ! "$code" =~ ^2 ]]; then
    echo "--- response preview ---"
    head -c 500 /tmp/nas-release-curl.out || true
    echo
    fail "请求失败：$url，HTTP $code"
  fi
  echo "✅ $url -> HTTP $code"
}

curl_expect_401() {
  local url="$1"
  local code
  code="$(curl -sS -o /tmp/nas-release-curl.out -w '%{http_code}' "$url" || true)"
  if [ "$code" != "401" ]; then
    echo "--- response preview ---"
    head -c 500 /tmp/nas-release-curl.out || true
    echo
    fail "未登录接口预期 401，但得到 HTTP $code：$url"
  fi
  echo "✅ $url -> HTTP 401"
}

subscription_test() {
  local token="$1"
  local target="$2"
  local label="$3"

  [ -z "$token" ] && return 0

  local out="/tmp/submgr-${label}-${target}.out"
  local headers="/tmp/submgr-${label}-${target}.headers"
  local code

  code="$(curl -sS -D "$headers" -o "$out" -w '%{http_code}' "$BASE_URL/sub/$token?target=$target" || true)"
  if [ "$code" != "200" ]; then
    echo "--- headers ---"
    cat "$headers" || true
    echo "--- body preview ---"
    head -c 500 "$out" || true
    echo
    fail "订阅测试失败：$label target=$target HTTP $code"
  fi

  if grep -Eqi '<html|DOCTYPE html' "$out"; then
    fail "订阅测试失败：$label target=$target 返回 HTML，疑似错误页"
  fi

  echo "✅ 订阅测试通过：$label target=$target HTTP 200"
}

log "0. 基础命令检查"
require_cmd git
require_cmd npm
require_cmd docker
require_cmd curl

log "1. 进入项目目录"
cd "$APP_DIR"
pwd
[ -d .git ] || fail "当前目录不是 Git 仓库：$APP_DIR"

log "2. Git 分支和状态检查"
git status --short
git branch --show-current
git log --oneline -5

CURRENT_BRANCH="$(git branch --show-current || true)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  fail "当前分支是 $CURRENT_BRANCH，不是预期分支 $BRANCH。请先切换到 $BRANCH。"
fi

check_forbidden_tracked_files

log "3. Backend build"
npm run build --prefix backend

echo "✅ backend build 通过"

log "4. Frontend build"
npm run build --prefix frontend

echo "✅ frontend build 通过"

log "5. Docker Compose 状态检查"
docker compose -f "$COMPOSE_FILE" ps

log "6. 本地 smoke test"
curl_expect_2xx "$BASE_URL/"
curl_expect_2xx "$BASE_URL/health"
curl_expect_2xx "$BASE_URL/config"
curl_expect_401 "$BASE_URL/api/auth/me"

log "7. 可选订阅格式测试"
if [ -n "$ACTIVE_TOKEN" ]; then
  subscription_test "$ACTIVE_TOKEN" "clash" "active"
  subscription_test "$ACTIVE_TOKEN" "mihomo" "active"
  subscription_test "$ACTIVE_TOKEN" "sing-box" "active"
  subscription_test "$ACTIVE_TOKEN" "shadowrocket" "active"
else
  echo "ℹ️ 未设置 ACTIVE_TOKEN，跳过 active 订阅格式测试。"
fi

if [ -n "$EXPIRED_TOKEN" ]; then
  subscription_test "$EXPIRED_TOKEN" "clash" "expired"
else
  echo "ℹ️ 未设置 EXPIRED_TOKEN，跳过 expired 空订阅测试。"
fi

if [ -n "$INACTIVE_TOKEN" ]; then
  subscription_test "$INACTIVE_TOKEN" "clash" "inactive"
else
  echo "ℹ️ 未设置 INACTIVE_TOKEN，跳过 inactive 空订阅测试。"
fi

if [ -n "$DISABLED_TOKEN" ]; then
  subscription_test "$DISABLED_TOKEN" "clash" "disabled"
else
  echo "ℹ️ 未设置 DISABLED_TOKEN，跳过 disabled 空订阅测试。"
fi

log "8. 暂存并检查敏感文件"
stage_allowed_files
check_forbidden_staged_files

git diff --cached --stat

if git diff --cached --quiet; then
  fail "没有可提交的改动。"
fi

log "9. 发布确认"
echo "提交信息：$COMMIT_MESSAGE"
if [ -z "$TAG_NAME" ]; then
  TAG_NAME="$(make_tag)"
fi
echo "发布 tag：$TAG_NAME"

if [ "$YES" != "true" ]; then
  echo
  read -r -p "确认 commit、push master、创建并 push tag？输入 YES 继续：" CONFIRM
  [ "$CONFIRM" = "YES" ] || fail "已取消发布。"
fi

log "10. Commit"
git commit -m "$COMMIT_MESSAGE"

log "11. Push branch"
git push origin "$BRANCH"

log "12. Create annotated tag"
git tag -a "$TAG_NAME" -m "subscription_manager release $TAG_NAME"

log "13. Push tag"
git push origin "$TAG_NAME"

log "14. 完成"
echo "✅ 本地 NAS 发布完成"
echo "✅ 分支：$BRANCH"
echo "✅ Tag：$TAG_NAME"
echo "✅ 下一步：云服务器执行 /opt/apps/subscription-manager/deploy.sh $TAG_NAME"
