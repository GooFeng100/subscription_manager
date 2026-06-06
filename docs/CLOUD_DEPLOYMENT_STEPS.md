# 云服务器部署步骤

适用场景：正式上线到云服务器，采用“外层生产部署文件 + 内层 repo 代码”的方式。

## 1. 最终目录结构

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

说明：

- `repo/` 由 GitHub 管理，里面是项目代码。
- 外层 `docker-compose.prod.yml`、`.env.prod`、`caddy/Caddyfile`、`deploy.sh` 不进入 Git。
- `git pull` 只更新 `repo/`，不会覆盖生产配置。
- 本项目的 Caddy 是 **Docker 容器**，不是宿主机 Caddy，也不是宿主机 Nginx。
- 宿主机只开放 `80/443`，由 Caddy 容器对外提供 Web 与反代。

## 2. 准备仓库与外层目录

在云服务器上先创建外层目录，然后把仓库 clone 到 `repo/`：

```bash
mkdir -p /opt/apps/subscription-manager
cd /opt/apps/subscription-manager
git clone https://github.com/GooFeng100/subscription_manager.git repo
```

如果后续更新代码，只需要：

```bash
cd /opt/apps/subscription-manager/repo
git pull
```

不会影响外层的生产配置文件。

## 3. 补齐外层生产文件

外层真实环境变量文件是：

```text
/opt/apps/subscription-manager/.env.prod
```

推荐从仓库模板生成一份再改：

```bash
cp /opt/apps/subscription-manager/repo/.env.production.example /opt/apps/subscription-manager/.env.prod
```

外层还需要手工创建：

- `/opt/apps/subscription-manager/docker-compose.prod.yml`
- `/opt/apps/subscription-manager/caddy/Caddyfile`
- `/opt/apps/subscription-manager/deploy.sh`

## 4. 补完整 `docker-compose.prod.yml` 示例

下面是推荐结构。它满足以下要求：

- `app` 只在 Docker 内网通信
- `caddy` 对外暴露 `80/443`
- `mongodb` 不暴露宿主机端口
- `redis` 不暴露宿主机端口
- `subconverter` 只 `expose 25500`
- `app` 使用 `env_file: ./.env.prod`
- `frontend` 产物挂载到 Caddy 容器

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

- 这里采用的是“前端先在 `repo/frontend/dist` 构建好，再交给 Caddy 挂载”的方式。
- `app` 仍然由 `backend/Dockerfile` 构建。
- 如果你后面想改回“Caddy 镜像内构建前端”的方式，也可以，但外层生产文件仍不进 Git。

## 5. 补完整 `Caddyfile` 示例

外层 Caddy 配置路径是：

```text
/opt/apps/subscription-manager/caddy/Caddyfile
```

推荐内容如下：

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

注意：

- 这里使用的是 **Caddy 容器**，不是宿主机 Caddy。
- 不要改成宿主机 Nginx。
- `handle /sub/*` 保留原始路径，不要换成会剥离前缀的写法。
- Cloudflare DNS 申请证书前可先灰云，证书稳定后再按需橙云。
- `handle { ... }` 放在最后，避免 SPA 的 `try_files` 先吞掉 `/api`、`/sub`、`/config`、`/health`。

## 6. 补完整 `.env.prod` 示例

真实生产文件路径：

```text
/opt/apps/subscription-manager/.env.prod
```

下面是推荐字段清单，真实值不要写进 Git：

```env
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://sub.889100.xyz

SESSION_SECRET=replace-with-long-random-secret
SESSION_COOKIE_NAME=sm_session
SESSION_COOKIE_SECURE=true

MONGODB_URI=mongodb://mongodb:27017/subscription_manager
REDIS_URL=redis://redis:6379
MONGO_ROOT_USERNAME=submgr
MONGO_ROOT_PASSWORD=replace-with-strong-mongo-password

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-this-admin-password

REGISTRATION_ENABLED=true
TURNSTILE_ENABLED=true
TURNSTILE_LOGIN_ENABLED=false
TURNSTILE_REGISTER_ENABLED=false
TURNSTILE_SITE_KEY=replace-with-production-site-key
TURNSTILE_SECRET_KEY=replace-with-production-secret-key

CONVERTER_BACKEND_URL=http://subconverter:25500/sub
CONVERTER_SOURCE_SECRET=replace-with-internal-source-secret

SUB_RATE_LIMIT_PER_MINUTE=60
UPSTREAM_POLL_INTERVAL_MINUTES=60
SUB_CONVERTER_TIMEOUT_MS=10000
```

注意：

- `.env.prod` 不进 Git。
- MongoDB 推荐生产启用认证；`MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD` 只用于容器初始化，`MONGODB_URI` 需使用带 `authSource=admin` 的连接串。
- 不要写真实密码到 Git。
- 如果 `MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD` 与 `MONGODB_URI` 不一致，会导致启动后认证失败，请保持三者一致。
- `.env.production.example` 仍保留在仓库里，作为模板。
- 生产环境变量改动后，至少需要重启 `app`，如果涉及前端构建变量，还要重新构建前端并更新 `caddy` 挂载目录。

## 6.1 Cloudflare 前置登录验证配置说明

生产建议使用 Cloudflare WAF Custom Rule 的 Managed Challenge 保护登录页面，并关闭登录页内嵌 Turnstile：

- DNS 记录需要开启 Cloudflare 橙云代理。
- `.env.prod` 推荐设置 `TURNSTILE_ENABLED=true`、`TURNSTILE_LOGIN_ENABLED=false`、`TURNSTILE_REGISTER_ENABLED=false`。
- `/login` 使用 Cloudflare Managed Challenge 做前置验证。
- 登录页内嵌 Turnstile 默认关闭，避免 Cloudflare Challenge 和页面 Turnstile 双重验证。
- 注册页内嵌 Turnstile 默认关闭；如后续需要再打开，可由 `TURNSTILE_REGISTER_ENABLED` 控制。
- `/sub/*` 必须跳过 Challenge；Clash、Mihomo、Shadowrocket 等客户端无法完成网页验证。
- `/api/auth/login` 不建议做 Cloudflare Challenge，避免前端 API 请求收到 Cloudflare HTML 验证页。
- 如果 Cloudflare Bot Fight Mode 误伤订阅接口，需关闭或调整 Cloudflare Bot 相关设置。

规则 1：Skip 订阅和静态接口。该规则放在 Challenge 规则前面。

```text
http.host eq "sub.889100.xyz" and (
  starts_with(http.request.uri.path, "/sub/")
  or http.request.uri.path eq "/health"
  or http.request.uri.path eq "/config"
  or starts_with(http.request.uri.path, "/assets/")
  or starts_with(http.request.uri.path, "/api/internal/")
  or http.request.uri.path eq "/favicon.ico"
)
```

动作：

```text
Skip
```

规则 2：Managed Challenge 登录页。

```text
http.host eq "sub.889100.xyz" and http.request.uri.path eq "/login"
```

动作：

```text
Managed Challenge
```

注意：只 Challenge `/login`，不要 Challenge `/sub/*`，也不要 Challenge `/api/auth/login`。

## 7. 补完整 `deploy.sh` 示例

外层部署脚本路径：

```text
/opt/apps/subscription-manager/deploy.sh
```

推荐脚本逻辑：

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
docker compose -f "$APP_DIR/docker-compose.prod.yml" ps

curl -I https://sub.889100.xyz
curl -i https://sub.889100.xyz/health
curl -i https://sub.889100.xyz/config
```

说明：

- 脚本只做部署，不做数据库恢复。
- 不要清空数据卷。
- 不要执行 `docker system prune`。
- 不要输出 `.env.prod` 内容。
- `git pull` 只更新 `repo/`，不会覆盖外层 `docker-compose.prod.yml`、`.env.prod` 或 `caddy/Caddyfile`。
- 允许通过参数指定部署分支或 tag，例如 `./deploy.sh main`、`./deploy.sh v2026.06.03`。

## 8. 上线前检查

上线前至少确认：

- 域名 `sub.889100.xyz` 已解析到云服务器
- `80/443` 已开放
- NAS 本地入口仍是 `http://192.168.10.3:8084`
- 云端生产入口是 `https://sub.889100.xyz`
- 证书可正常签发
- `caddy` 容器正常启动
- `app`、`mongodb`、`redis`、`subconverter` 都在同一 Docker 网络里
- `/health`、`/config` 可访问
- Turnstile 正式 key 已填入 `.env.prod`
- 管理员密码已修改
- MongoDB 认证参数已设置，且 `MONGODB_URI` 使用带认证的连接串
