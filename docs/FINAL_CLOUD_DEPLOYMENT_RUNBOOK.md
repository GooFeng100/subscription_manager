# subscription_manager 云服务器部署与维护总流程

适用范围：从本地 NAS 开发目录推送代码到 GitHub，再由云服务器拉取部署；生产环境使用外层部署文件 + 内层 repo 代码；Caddy 为容器；NAS 每日拉取 MongoDB 备份。

## 0. 统一约定

- 本地 NAS 开发目录：`/vol1/1000/docker/subscription_manager`
- 云服务器生产目录：`/opt/apps/subscription-manager/`
- NAS 本地部署入口：`http://192.168.10.3:8084`
- 云服务器生产入口：`https://sub.889100.xyz`
- NAS 本地部署使用仓库内 `compose.yaml`
- 云端生产部署使用外层 `docker-compose.prod.yml`
- Git 仓库内不提交真实 `.env`
- Git 仓库内不提交生产 `.env.prod`
- Git 仓库内不提交云端生产 `docker-compose.prod.yml`
- Git 仓库内不提交云端生产 `caddy/Caddyfile`
- Git 仓库内不提交云端生产 `deploy.sh`
- 云端 Caddy 是 Docker 容器，不是宿主机 Caddy，也不是宿主机 Nginx
- 宿主机只开放 `80/443`
- Docker Compose 把 `80/443` 映射到 caddy 容器，由 caddy 容器负责前端静态文件和后端 API 反代

---

## 1. 本地 NAS 开发目录

本地开发 / 测试目录：

```text
/vol1/1000/docker/subscription_manager
```

### 1.1 本地 NAS 架构

```text
用户 / 浏览器
  ↓
NAS 本地 80/443 之外的测试入口
  ↓
http://192.168.10.3:8084
  ↓
compose.yaml
  ├─ app
  ├─ caddy
  ├─ mongodb
  ├─ redis
  └─ subconverter
```

### 1.2 本地目录原则

- 这是本地开发 / 测试目录。
- NAS 本地部署使用仓库内 `compose.yaml`。
- Git 仓库内 `compose.yaml` 只作为 NAS 本地部署依据。
- Git 仓库内不要提交真实 `.env`。
- Git 仓库内不要提交生产 `.env.prod`。
- Git 仓库内不要提交云端生产 `docker-compose.prod.yml`。
- Git 仓库内不要提交云端生产 `caddy/Caddyfile`。
- Git 仓库内不要提交云端生产 `deploy.sh`。

---

## 2. 云服务器生产目录

云服务器生产目录结构：

```text
/opt/apps/subscription-manager/
├─ repo/                         # GitHub clone 的项目代码
│  ├─ backend/
│  ├─ frontend/
│  ├─ docs/
│  └─ README.md
├─ docker-compose.prod.yml        # 云端专用 Compose，不进 Git
├─ .env.prod                      # 云端真实环境变量，不进 Git
├─ deploy.sh                      # 云端一键部署脚本，不进 Git
├─ caddy/
│  └─ Caddyfile                   # 云端 Caddy 容器配置，不进 Git
├─ mongodb-data/
├─ redis-data/
├─ caddy-data/
├─ caddy-config/
└─ backups/
```

### 2.1 生产目录原则

- `repo/` 由 GitHub 管理。
- 外层生产文件不进入 Git。
- `git pull` 只更新 `repo/`，不会覆盖生产配置。
- 生产入口是 `https://sub.889100.xyz`。
- 云端正式入口端口是 `80 / 443`。

### 2.2 生产部署文件职责

- `docker-compose.prod.yml`：生产编排文件。
- `.env.prod`：生产环境变量。
- `caddy/Caddyfile`：Caddy 容器配置。
- `deploy.sh`：一键部署脚本。
- `backups/`：备份文件目录。

---

## 3. Caddy 架构

```text
Caddy 是 Docker 容器，不是宿主机 Caddy，也不是宿主机 Nginx。
宿主机只开放 80/443。
Docker Compose 把 80/443 映射到 caddy 容器。
caddy 容器负责前端静态文件和后端 API 反代。
```

结构图：

```text
用户 / Cloudflare
  ↓
云服务器公网 80/443
  ↓
caddy 容器
  ├─ 前端静态文件 /srv/frontend
  ├─ /api/*  → app:3000
  ├─ /config → app:3000
  ├─ /health → app:3000
  └─ /sub/*  → app:3000
```

---

## 4. 本地 NAS 上传仓库流程

### 4.1 检查本地状态

```bash
cd /vol1/1000/docker/subscription_manager

git status
git diff --stat
git branch --show-current
git log --oneline -5
```

### 4.2 本地构建检查

```bash
npm run build --prefix backend
npm run build --prefix frontend
```

### 4.3 本地 smoke test

```bash
docker compose -f compose.yaml ps

curl -i http://127.0.0.1:8084/
curl -i http://127.0.0.1:8084/health
curl -i http://127.0.0.1:8084/config
```

### 4.4 确认不要提交敏感文件

检查：

```bash
git status --short
```

不得提交：

```text
.env
.env.prod
*.local
docker-compose.prod.yml
caddy/Caddyfile
deploy.sh
backups/
mongodb-data/
redis-data/
caddy-data/
caddy-config/
```

可以提交：

```text
.env.production.example
docs/*.md
backend/.env.example
frontend/.env.example
业务代码
```

### 4.5 提交并推送

```bash
git add .
git commit -m "release: prepare production deployment runbook"
git push origin main
```

### 4.6 打发布 tag

只有在以下条件都满足后才能 tag：

- backend build 通过
- frontend build 通过
- smoke test 通过
- `shadowrocket` / `clash` / `mihomo` / `sing-box` 测试结论已记录
- `git status` 已检查

示例：

```bash
git status
git tag -a v2026.06.03 -m "subscription_manager release 2026-06-03"
git push origin v2026.06.03
```

如果同一天多次发布：

```bash
git tag -a v2026.06.03-1 -m "subscription_manager release 2026-06-03 patch 1"
git push origin v2026.06.03-1
```

---

## 5. 云服务器初始化流程

适用系统：

```text
Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
```

### 5.1 推荐配置

```text
CPU：2 核
内存：2GB 起，推荐 4GB
硬盘：40GB 起，推荐 60GB+
地区：美国服务器
```

### 5.2 安装基础工具

```bash
apt update && apt upgrade -y

apt install -y \
  curl wget git unzip vim nano htop ca-certificates gnupg lsb-release \
  ufw fail2ban jq tar zip dnsutils
```

### 5.3 安装 Docker

```bash
install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker version
docker compose version
docker run hello-world
```

### 5.4 设置 Docker 日志大小

```bash
mkdir -p /etc/docker

cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
EOF

systemctl restart docker
```

### 5.5 防火墙

公网只开放：

```text
80
443
```

SSH 建议只允许固定 IP / VPN / Tailscale。

不要开放：

```text
3000
27017
6379
25500
```

---

## 6. 云服务器拉取仓库与创建外层文件

### 6.1 创建目录并 clone 仓库

```bash
mkdir -p /opt/apps/subscription-manager
cd /opt/apps/subscription-manager

git clone https://github.com/GooFeng100/subscription_manager.git repo
```

如果最终仓库地址不同，请替换为实际地址。

### 6.2 复制 `.env.prod`

```bash
cd /opt/apps/subscription-manager

cp repo/.env.production.example .env.prod
nano .env.prod
```

### 6.3 创建外层 Caddyfile

```bash
mkdir -p /opt/apps/subscription-manager/caddy
nano /opt/apps/subscription-manager/caddy/Caddyfile
```

推荐内容：

```caddyfile
sub.889100.xyz {
    encode zstd gzip

    handle /api/* {
        reverse_proxy app:3000
    }

    handle /config {
        reverse_proxy app:3000
    }

    handle /health {
        reverse_proxy app:3000
    }

    handle /sub/* {
        reverse_proxy app:3000
    }

    handle {
        root * /srv/frontend
        try_files {path} /index.html
        file_server
    }
}
```

说明：

```text
不要使用 handle_path /sub/*，避免剥离 /sub 前缀。
handle { ... } 必须放在最后，避免 SPA 的 try_files 先吞掉 /api、/sub、/config、/health。
Caddy 是容器，不是宿主机 Caddy，也不是宿主机 Nginx。
Cloudflare DNS 申请证书前可先灰云，证书稳定后再按需橙云。
```

### 6.4 创建外层 docker-compose.prod.yml

```bash
nano /opt/apps/subscription-manager/docker-compose.prod.yml
```

完整示例：

```yaml
services:
  app:
    build:
      context: ./repo
      dockerfile: backend/Dockerfile
    image: subscription-manager-app:latest
    container_name: subscription-manager-app
    restart: unless-stopped
    env_file:
      - ./.env.prod
    expose:
      - "3000"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - subscription-manager

  caddy:
    image: caddy:2-alpine
    container_name: subscription-manager-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./repo/frontend/dist:/srv/frontend:ro
      - ./caddy-data:/data
      - ./caddy-config:/config
    depends_on:
      - app
    networks:
      - subscription-manager

  mongodb:
    image: mongo:7
    container_name: subscription-manager-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - ./mongodb-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - subscription-manager

  redis:
    image: redis:7-alpine
    container_name: subscription-manager-redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - ./redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - subscription-manager

  subconverter:
    image: tindy2013/subconverter:latest
    container_name: subscription-manager-subconverter
    restart: unless-stopped
    expose:
      - "25500"
    networks:
      - subscription-manager

networks:
  subscription-manager:
    driver: bridge
```

说明：

- `app` 只 expose 3000，不写 `ports`
- `caddy` 只映射 `80:80` 和 `443:443`
- `mongodb` 不写 `ports`
- `redis` 不写 `ports`
- `subconverter` 只 expose `25500`
- `caddy` 挂载 `./repo/frontend/dist:/srv/frontend:ro`
- `caddy` 挂载 `./caddy/Caddyfile:/etc/caddy/Caddyfile:ro`
- `caddy` 持久化 `./caddy-data:/data` 和 `./caddy-config:/config`
- `mongodb` 使用 `MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD`
- `app` 使用 `env_file: ./.env.prod`

### 6.5 创建外层 deploy.sh

```bash
nano /opt/apps/subscription-manager/deploy.sh
chmod +x /opt/apps/subscription-manager/deploy.sh
```

推荐脚本：

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apps/subscription-manager"
REPO_DIR="$APP_DIR/repo"
DEPLOY_REF="${1:-main}"

test -d "$REPO_DIR/.git"
test -f "$APP_DIR/docker-compose.prod.yml"
test -f "$APP_DIR/.env.prod"
test -f "$APP_DIR/caddy/Caddyfile"

cd "$REPO_DIR"
git fetch --all --tags

if git rev-parse "refs/tags/$DEPLOY_REF" >/dev/null 2>&1; then
  git checkout -f "$DEPLOY_REF"
else
  git checkout -B "$DEPLOY_REF" "origin/$DEPLOY_REF"
  git pull --ff-only origin "$DEPLOY_REF"
fi

echo "Deploying commit: $(git rev-parse --short HEAD)"

cd "$REPO_DIR/frontend"
npm ci
npm run build

docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env.prod" up -d --build
docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$APP_DIR/.env.prod" ps

curl -I https://sub.889100.xyz
curl -i https://sub.889100.xyz/health
curl -i https://sub.889100.xyz/config
```

说明：

- 支持部署 `main`。
- 支持部署 tag，例如 `v2026.06.03`。
- 输出当前 commit。
- 不自动打 tag。
- 不修改 `.env.prod`。
- 不做数据库恢复。
- 不清空数据卷。
- 不执行 `docker system prune`。

---

## 7. 生产 `.env.prod` 必填项

`/opt/apps/subscription-manager/.env.prod` 真实示例：

```env
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://sub.889100.xyz

SESSION_SECRET=replace-with-long-random-secret
SESSION_COOKIE_NAME=sm_session
SESSION_COOKIE_SECURE=true

MONGO_ROOT_USERNAME=submgr
MONGO_ROOT_PASSWORD=replace-with-strong-mongo-password
MONGODB_URI=mongodb://submgr:replace-with-strong-mongo-password@mongodb:27017/subscription_manager?authSource=admin

REDIS_URL=redis://redis:6379

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-this-admin-password

REGISTRATION_ENABLED=true

TURNSTILE_ENABLED=true
LOGIN_TURNSTILE_ENABLED=true
REGISTER_TURNSTILE_ENABLED=true
TURNSTILE_SITE_KEY=replace-with-production-site-key
TURNSTILE_SECRET_KEY=replace-with-production-secret-key

CONVERTER_BACKEND_URL=http://subconverter:25500/sub
CONVERTER_SOURCE_SECRET=replace-with-internal-source-secret

SUB_RATE_LIMIT_PER_MINUTE=60
UPSTREAM_POLL_INTERVAL_MINUTES=60
SUB_CONVERTER_TIMEOUT_MS=10000
```

注意：

- `MONGO_ROOT_USERNAME / MONGO_ROOT_PASSWORD / MONGODB_URI` 必须保持一致。
- `.env.prod` 不进入 Git。
- 生产 `ADMIN_PASSWORD` 不能使用开发密码。
- `SESSION_SECRET / CONVERTER_SOURCE_SECRET` 必须使用强随机值。
- `TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY` 使用生产 key。

---

## 8. 云端备份与 NAS 每日拉取

### 8.1 MongoDB 逻辑备份主方案

生产推荐主方案是 MongoDB 逻辑备份，使用 `mongodump` / `mongorestore`。

推荐脚本路径：

```text
/opt/apps/subscription-manager/backup-mongo.sh
```

示例备份脚本：

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apps/subscription-manager"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.prod"
BACKUP_DIR="$APP_DIR/backups"
DATE="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/mongodb-$DATE.archive.gz"

mkdir -p "$BACKUP_DIR"

set -a
source "$ENV_FILE"
set +a

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongodb \
  mongodump \
  --uri="$MONGODB_URI" \
  --archive \
  --gzip > "$BACKUP_FILE"

echo "$BACKUP_FILE"
```

示例恢复脚本：

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apps/subscription-manager"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.prod"
BACKUP_FILE="$1"

set -a
source "$ENV_FILE"
set +a

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongodb \
  mongorestore \
  --uri="$MONGODB_URI" \
  --drop \
  --archive \
  --gzip < "$BACKUP_FILE"
```

### 8.2 备份范围

必须单独备份的生产文件：

- `/opt/apps/subscription-manager/.env.prod`
- `/opt/apps/subscription-manager/docker-compose.prod.yml`
- `/opt/apps/subscription-manager/caddy/Caddyfile`

Redis 主要用于缓存和限流，通常不是核心业务恢复依赖；如果要备份 Redis，可备份 `redis-data` 或 AOF / RDB 文件。

### 8.3 冷备选项

仓库里原有的卷级 tar 备份方式可以作为冷备选项保留：

- 恢复前必须停止相关容器
- 不作为日常首选 MongoDB 备份方式
- 更适合整机迁移或离线恢复

### 8.4 NAS 每日拉取备份

NAS 可以通过 SSH 调用云端 `backup-mongo.sh`，再使用 `scp` 拉取备份文件。

建议流程：

1. NAS 发起 SSH 到云服务器。
2. 云服务器执行 `backup-mongo.sh` 生成备份。
3. NAS 再通过 `scp` 把备份文件拉回本地。

---

## 9. 最终验收与 smoke test

### 9.1 NAS 本地

```bash
cd /vol1/1000/docker/subscription_manager

npm run build --prefix backend
npm run build --prefix frontend

docker compose -f compose.yaml ps

curl -i http://127.0.0.1:8084/
curl -i http://127.0.0.1:8084/health
curl -i http://127.0.0.1:8084/config
```

### 9.2 云端生产

```bash
docker compose -f /opt/apps/subscription-manager/docker-compose.prod.yml --env-file /opt/apps/subscription-manager/.env.prod ps

curl -I https://sub.889100.xyz
curl -i https://sub.889100.xyz/health
curl -i https://sub.889100.xyz/config
```

### 9.3 日志检查

```bash
docker compose -f /opt/apps/subscription-manager/docker-compose.prod.yml --env-file /opt/apps/subscription-manager/.env.prod logs --tail=100 app
docker compose -f /opt/apps/subscription-manager/docker-compose.prod.yml --env-file /opt/apps/subscription-manager/.env.prod logs --tail=100 caddy
docker compose -f /opt/apps/subscription-manager/docker-compose.prod.yml --env-file /opt/apps/subscription-manager/.env.prod logs --tail=100 mongodb
docker compose -f /opt/apps/subscription-manager/docker-compose.prod.yml --env-file /opt/apps/subscription-manager/.env.prod logs --tail=100 redis
docker compose -f /opt/apps/subscription-manager/docker-compose.prod.yml --env-file /opt/apps/subscription-manager/.env.prod logs --tail=100 subconverter
```

### 9.4 订阅与客户端验证

至少确认：

- Clash / Mihomo
- Shadowrocket
- sing-box

并确认：

- 能添加订阅
- 能手动更新订阅
- 有效用户有节点
- 过期 / 宽限期 / 停用用户表现符合预期
- `shadowrocket` 可正确识别 `ss://` / `trojan://` / `vmess://` / `vless://` / `ssr://`

---

## 10. Tag 与发布策略

- 只有 build、smoke test、订阅格式测试通过后才能 tag。
- 先 commit，再 tag。
- 不要在未提交改动上直接打 tag。

示例：

```bash
git status
git add .
git commit -m "release: prepare production deployment"
git tag -a v2026.06.03 -m "subscription_manager release 2026-06-03"
git push origin main
git push origin v2026.06.03
```

如果同一天多次发布：

```bash
git tag -a v2026.06.03-1 -m "subscription_manager release 2026-06-03 patch 1"
git push origin v2026.06.03-1
```

---

## 11. 常见回滚步骤

1. 保留当前生产数据目录和备份文件。
2. 切回上一个稳定 tag。
3. 恢复 `.env.prod` 到上一版已知可用配置。
4. 重新执行 `deploy.sh`。
5. 重新执行 `/health`、`/config`、客户端订阅验证。

不要在回滚过程中清空数据卷，不要执行 `docker system prune`。

