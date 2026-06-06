# 生产上线清单

适用范围：`/vol1/1000/docker/subscription_manager`  
使用说明：本清单用于正式上线前人工核对。当前上线依据以 `docs/CLOUD_DEPLOYMENT_STEPS.md`、`docs/BACKUP_RESTORE.md`、`docs/RELEASE_TAG_POLICY.md`、`docs/DEPLOYMENT.md`、`docs/TASK_STATE.md` 为准；`docs/DEV_TASK.md` 仅保留为历史任务参考。

## 1. 基础信息

- 项目路径：`/vol1/1000/docker/subscription_manager`
- 正式访问域名：`sub.889100.xyz`
- 当前本地测试地址：`http://192.168.10.3:8084`
- 云端权威 compose 文件：`/opt/apps/subscription-manager/docker-compose.prod.yml`
- Git 仓库内 `compose.yaml` 仅用于 NAS 本地部署，不作为云端依据
- NAS 本地对外端口：`8084`
- 云端正式入口端口：`80/443`
- 当前容器列表：
  - `subscription-manager-app`
  - `subscription-manager-caddy`
  - `subscription-manager-mongodb`
  - `subscription-manager-redis`
  - `subscription_manager_subconverter`

## 2. 必填环境变量清单

> 说明：以下仅列字段名，不写真实值。  
> 标记：
> - **必须上线前配置**：正式上线前必须有有效值
> - **不能提交 Git**：敏感值不要写入仓库
> - **修改后需重建/重启**：修改后至少需要重启 `app`；若涉及前端构建变量，则还要重建/重启 `caddy`

### 2.1 核心运行变量

- `APP_BASE_URL`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`、`caddy`
- `MONGODB_URI`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `REDIS_URL`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `MONGO_ROOT_USERNAME`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`mongodb`、`app`
- `MONGO_ROOT_PASSWORD`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`mongodb`、`app`
- `SESSION_SECRET`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `SESSION_COOKIE_NAME`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `SESSION_COOKIE_SECURE`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`

### 2.2 账号与限流

- `ADMIN_USERNAME`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `ADMIN_PASSWORD`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `REGISTRATION_ENABLED`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `LOGIN_FAIL_LIMIT`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `LOGIN_LOCK_MINUTES`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `REGISTER_IP_LIMIT`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `REGISTER_IP_WINDOW_MINUTES`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `SUB_RATE_LIMIT_PER_MINUTE`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `UPSTREAM_POLL_INTERVAL_MINUTES`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `SUB_CONVERTER_TIMEOUT_MS`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `UPSTREAM_FETCH_PROXY_URL`
- `UPSTREAM_FETCH_PROXY_URL` 默认建议填 `http://100.69.223.58:17890`，也可由系统设置覆盖
  - 代理服务本身应由 NAS 上独立运行的 tinyproxy/HTTP 代理提供，项目名为 `TailscaleProxy`，路径为 `/vol1/1000/docker/TailscaleProxy`
  - `TailscaleProxy` 当前在 `tinyproxy.conf` 中写死放行 3 个 Tailscale IP，后续要增删设备直接改配置文件
  - 上线前需确认
  - 系统设置里的“上游拉取代理地址”会优先生效，环境变量仅作兜底
  - **仅在需要上游代理回退时配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`

### 2.3 Turnstile

- `TURNSTILE_ENABLED`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `TURNSTILE_LOGIN_ENABLED`
  - **必须上线前配置**
  - 生产建议为 `false`，由 Cloudflare WAF Managed Challenge 保护 `/login`
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `TURNSTILE_REGISTER_ENABLED`
  - **必须上线前配置**
  - 生产建议为 `false`，注册页默认不显示内嵌 Turnstile
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `TURNSTILE_SITE_KEY`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `TURNSTILE_SECRET_KEY`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`

### 2.4 订阅转换

- `CONVERTER_BACKEND_URL`
  - **必须上线前配置**（若未使用代码默认值时）
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`
- `CONVERTER_SOURCE_SECRET`
  - **必须上线前配置**
  - **不能提交 Git**
  - **修改后需重建/重启**：`app`

### 2.5 其他实际读取的环境变量

- `NODE_ENV`
  - 上线前需确认
  - **修改后需重建/重启**：`app`
- `PORT`
  - 上线前需确认
  - **修改后需重建/重启**：`app`

## 3. Cloudflare Turnstile 上线检查

- 正式域名 `sub.889100.xyz` 是否已加入 Turnstile hostname
- `TURNSTILE_SITE_KEY` 是否为正式 key
- `TURNSTILE_SECRET_KEY` 是否为正式 secret
- 登录页是否启用 Turnstile
- 注册页是否启用 Turnstile；当前生产建议关闭
- 授权码兑换页不启用 Turnstile
- `/sub/:token` 不启用 Turnstile

## 4. Docker / 端口检查

- `caddy` 对外暴露 `80/443`
- `app` 不直接暴露公网
- `mongodb` 不暴露公网
- `redis` 不暴露公网
- `subconverter` 不暴露宿主机端口
- `subconverter` 只通过 Docker 内网访问

## 5. 订阅转换检查

- 使用本地 `subconverter`
- `converter_backend_url` 指向 `http://subconverter:25500/sub`
- 上游订阅已重新鉴权
- 曾经泄露过的上游订阅 token 已重置
- 上游测试能识别 `base64_nodes` / `raw_nodes`
- 有效用户 / 宽限期用户 / 过期用户 / 禁用用户订阅表现符合预期
- 输出包含 `X-Subscription-Version`
- 输出不泄露上游 URL
- `shadowrocket` 走直出链路，返回可 Base64 解码的原始节点文本

## 6. 客户端验收

至少测试：

- Clash / Mihomo
- Shadowrocket
- sing-box，如支持

每个客户端确认：

- 能添加订阅
- 能手动更新订阅
- 有效用户有节点
- 过期 / 宽限期 / 停用用户表现符合预期
- 轮换后更新订阅能生效
- `shadowrocket` 导入后能正确识别 `ss://` / `trojan://` / `vmess://` / `vless://` / `ssr://`

## 7. 账号与权限检查

- 统一登录页 `/login`
- 普通用户登录后进入 `/dashboard`
- 管理员登录后进入 `/admin/users`
- 普通用户不能访问 `/admin/*`
- 普通用户访问 `/rotation` 会回 `/dashboard`
- 管理员访问 `/rotation` 会跳 `/admin/rotation`
- `disabled` 用户不能获取订阅
- `expired` 用户按当前策略返回空订阅
- `inactive` 用户按当前策略返回空订阅

## 8. 备份与回滚

上线前需要确认：

- MongoDB 数据备份路径
- 是否有一键备份脚本
- 是否有一键恢复脚本
- `docker-compose.prod.yml` 是否已备份但不提交 Git
- `.env.prod` 是否已备份但不提交 Git
- `caddy/Caddyfile` 是否已备份但不提交 Git
- 上线前是否打 Git tag
- 回滚步骤

## 9. 最终 smoke test 命令

> 仅列命令，不在此文档里执行。

```bash
docker compose config
docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 caddy
docker compose logs --tail=100 mongodb
docker compose logs --tail=100 redis
docker compose logs --tail=100 subconverter

curl -i http://127.0.0.1:8084/
curl -i http://127.0.0.1:8084/health
curl -i http://127.0.0.1:8084/config
```

## 10. 上线前人工确认项

- 正式域名
- HTTPS
- Turnstile 正式 key
- 是否开放注册
- 管理员密码是否已修改
- 上游订阅 token 是否已重置
- 客户端测试是否通过
- 是否备份数据库
- 是否打 Git tag

## 11. 历史文档说明

- `docs/DEV_TASK.md` 保留为历史任务书参考。
- 当前上线依据以本清单、`docs/DEPLOYMENT.md`、`docs/TASK_STATE.md` 为准。
- 仓库内如存在旧逻辑描述，请以当前实现与本清单为准，不要再按旧任务书执行。

## 12. 老管理员接口说明

- `POST /api/auth/admin/login` 与 `POST /api/auth/admin/change-password` 已下线。
- 当前主入口为统一登录页 `/login`。
- 文档与前端不再把上述接口作为上线保留接口。

## 13. 过期空订阅策略

- `expired`：返回 `200` 空订阅，减少客户端报错。
- `inactive`：返回 `200` 空订阅，减少客户端报错。
- `disabled`：返回 `200` 空订阅，减少客户端报错。
- 如需统一改为空订阅，需要用户确认后再调整。
  
> 说明：`shadowrocket` 现在不再经过 `subconverter`，而是直接输出已发布节点池中的原始节点并 Base64 编码；`clash / mihomo / sing-box` 仍走本地 `subconverter`。
