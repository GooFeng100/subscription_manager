# 备份 / 恢复说明

本项目生产推荐主方案是 **MongoDB 逻辑备份**，也就是使用 `mongodump` / `mongorestore`。

## 1. 生产推荐主方案：MongoDB 逻辑备份

推荐备份脚本路径：

```text
/opt/apps/subscription-manager/backup-mongo.sh
```

推荐备份目录：

```text
/opt/apps/subscription-manager/backups
```

建议只备份业务库，不备份 `admin`、`config`、`local`。

推荐脚本思路如下：

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
```

恢复示例：

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

建议逻辑：

1. 先停相关应用容器或进入维护窗口。
2. 先恢复 MongoDB。
3. 再恢复 Redis（如果你确实做了 Redis 备份）。
4. 最后启动应用容器。

## 2. 必须单独备份的生产文件

以下文件不属于数据库内容，必须单独备份：

- `/opt/apps/subscription-manager/.env.prod`
- `/opt/apps/subscription-manager/docker-compose.prod.yml`
- `/opt/apps/subscription-manager/caddy/Caddyfile`

这些文件决定生产环境的真实运行方式，不要只依赖数据库备份。

## 3. Redis 备份策略

Redis 主要用于缓存和限流，通常不是核心业务恢复依赖。

如果你确实需要备份 Redis，可以备份：

- `redis-data` 目录
- 或 Redis AOF / RDB 文件

但生产恢复时，Redis 一般可接受重建后重新生成缓存。

## 4. 冷备选项

仓库里原有的卷级 tar 备份方式可以作为**冷备选项**保留：

- 恢复前必须停止相关容器
- 不作为日常首选 MongoDB 备份方式
- 更适合整机迁移或离线恢复

如果要使用冷备，建议先把它标记为“补充方案”，不要和 `mongodump` 主方案混淆。

## 5. NAS 拉取备份

NAS 可以通过 SSH 调用云端 `backup-mongo.sh`，再使用 `scp` 拉取备份文件。

建议流程：

1. NAS 发起 SSH 到云服务器。
2. 云服务器执行 `backup-mongo.sh` 生成备份。
3. NAS 再通过 `scp` 把备份文件拉回本地。

注意不要在文档里写真实 IP、真实密钥、真实账号。

## 6. 恢复前确认项

- 备份文件是否完整
- `.env.prod` 是否也有副本
- `docker-compose.prod.yml` 是否与当前上线版本一致
- `caddy/Caddyfile` 是否与当前上线版本一致
- 是否保留最近 2~3 份历史备份
