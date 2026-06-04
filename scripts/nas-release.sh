#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/vol1/1000/docker/subscription_manager"
COMPOSE_FILE="$APP_DIR/compose.yaml"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIST="$FRONTEND_DIR/dist"
APP_URL="http://127.0.0.1:8084"

log() {
  echo
  echo "=============================="
  echo "$1"
  echo "=============================="
}

fail() {
  echo
  echo "❌ 发布失败：$1"
  echo
  echo "---- app logs ----"
  docker compose -f "$COMPOSE_FILE" logs --tail=120 app || true
  echo
  echo "---- caddy logs ----"
  docker compose -f "$COMPOSE_FILE" logs --tail=120 caddy || true
  exit 1
}

wait_url() {
  local name="$1"
  local url="$2"
  local max_attempts="${3:-36}"
  local sleep_seconds="${4:-5}"

  echo "等待 $name：$url"

  for i in $(seq 1 "$max_attempts"); do
    if curl -fsS "$url" >/dev/null; then
      echo "✅ $name 正常"
      return 0
    fi

    echo "[$i/$max_attempts] $name 暂未就绪，${sleep_seconds}s 后重试..."
    sleep "$sleep_seconds"
  done

  fail "$name 检查失败：$url"
}

install_deps() {
  local dir="$1"
  local name="$2"

  log "安装/同步 ${name} 依赖"

  cd "$dir"

  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
}

build_backend() {
  log "构建后端"
  cd "$BACKEND_DIR"
  npm run build
}

build_frontend() {
  log "构建前端"
  cd "$FRONTEND_DIR"
  rm -rf "$FRONTEND_DIST"
  npm run build

  if [ ! -d "$FRONTEND_DIST" ]; then
    fail "前端 dist 目录不存在：$FRONTEND_DIST"
  fi
}

fix_dist_permissions() {
  log "修复前端 dist 权限"

  find "$FRONTEND_DIST" -type d -exec chmod 755 {} \;
  find "$FRONTEND_DIST" -type f -exec chmod 644 {} \;

  echo "dist 权限已修复：$FRONTEND_DIST"
  ls -la "$FRONTEND_DIST" | head
}

rebuild_containers() {
  log "重建并启动 app / caddy"

  cd "$APP_DIR"

  docker compose -f "$COMPOSE_FILE" config >/dev/null

  # 只重建业务相关容器，不动数据库 volume，不清理系统。
  docker compose -f "$COMPOSE_FILE" up -d --build app caddy

  log "容器状态"
  docker compose -f "$COMPOSE_FILE" ps
}

smoke_test() {
  log "等待服务就绪"

  wait_url "首页" "$APP_URL/" 36 5
  wait_url "健康检查" "$APP_URL/health" 36 5
  wait_url "前端配置" "$APP_URL/config" 36 5

  log "接口检查结果"
  curl -i "$APP_URL/health"
  echo
  curl -i "$APP_URL/config"
  echo
}

main() {
  log "开始 NAS 本地发布"
  echo "项目目录：$APP_DIR"
  echo "Compose 文件：$COMPOSE_FILE"
  echo "访问地址：$APP_URL"

  if [ ! -d "$APP_DIR" ]; then
    echo "❌ 项目目录不存在：$APP_DIR"
    exit 1
  fi

  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ compose 文件不存在：$COMPOSE_FILE"
    exit 1
  fi

  if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ 后端目录不存在：$BACKEND_DIR"
    exit 1
  fi

  if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ 前端目录不存在：$FRONTEND_DIR"
    exit 1
  fi

  install_deps "$BACKEND_DIR" "backend"
  install_deps "$FRONTEND_DIR" "frontend"

  build_backend
  build_frontend
  fix_dist_permissions
  rebuild_containers
  smoke_test

  log "✅ NAS 本地发布完成"
  echo "入口：$APP_URL"
}

main "$@"
