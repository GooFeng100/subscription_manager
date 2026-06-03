# 最终验收报告

验收时间：2026-06-03  
项目目录：`/vol1/1000/docker/subscription_manager`

## 1. 验收时间

- 2026-06-03

## 2. 当前结论

- 可上线：**条件可上线**
- P0 数量：**0**
- P1 数量：**0**
- P2 数量：**4**

## 3. Docker 检查结果

- `docker compose config` 成功执行，当前实际使用的是 `compose.yaml`。
- `docker compose ps` 显示核心容器均处于 `Up` 状态：
  - `subscription-manager-app`
  - `subscription-manager-caddy`
  - `subscription-manager-mongodb`
  - `subscription-manager-redis`
  - `subscription_manager_subconverter`
- `compose.yaml` 为实际权威编排文件；仓库中仍存在 `docker-compose.yml`，但已在文档中标记为历史遗留，不作为部署依据。

## 4. 端口暴露检查结果

- `caddy` 对外暴露 `8084`。
- `app` 未直接暴露公网端口。
- `mongodb` 未直接暴露公网端口。
- `redis` 未直接暴露公网端口。
- `subconverter` 未配置 `ports`，仅 `expose: 25500`。
- `subconverter` 与 `app` 处于同一 Docker 网络中，可通过内网服务名访问。

## 5. smoke test 结果

- `GET /`：200
- `GET /health`：200，MongoDB / Redis 状态正常
- `GET /config`：200，返回 Turnstile 前端所需配置，未见敏感 secret 明文输出
- `GET /api/auth/me`：401（未登录时符合预期）

## 6. 前端 build 结果

- `npm run build --prefix frontend`：通过
- 构建产物成功生成，未见 TypeScript 或模块缺失错误

## 7. 后端 build 结果

- `npm run build --prefix backend`：通过
- 未见 TypeScript 编译错误

## 8. 权限路由检查结果

- `/login` 为统一登录入口
- 前端不存在独立 `/admin/login` 页面或路由
- 普通用户访问 `/admin/*` 会被路由守卫导向 `/dashboard`
- 未登录访问 `/admin/*` 会回 `/login`
- 普通用户访问 `/rotation` 会回 `/dashboard`
- 管理员访问 `/rotation` 会跳 `/admin/rotation`
- `/admin/rotation` 正式管理页仍保留正常

## 9. 订阅链路检查结果

- 使用本地 `subconverter`
- `converter_backend_url` 指向 `http://subconverter:25500/sub`
- `subconverter` 未暴露宿主机端口
- 上游测试代码支持 `base64_nodes` / `raw_nodes` 识别
- `/sub/:token` 具备用户状态校验、Redis 限流、`X-Subscription-Version` 输出
- `expired` 按当前策略返回 `200` 空订阅
- `inactive` 返回 `200` 空订阅
- `disabled` 返回 `200` 空订阅
- `mihomo` 已做目标别名归一到 `clash`，`clash` / `mihomo` / `sing-box` 实测可用
- `shadowrocket` 已改为直出：不再调用 subconverter，直接读取已发布节点池并返回 base64 文本；active / grace 通过，expired / inactive / disabled 返回空订阅
- 日志检查未在最终报告中输出完整订阅 URL、完整 token、完整密码或 secret
- 已用有效 token 完成端到端测试；`clash` / `mihomo` / `sing-box` / `shadowrocket` 均通过

## 10. 日志脱敏检查结果

- 已检查 `app`、`caddy`、`mongodb`、`redis`、`subconverter` 日志。
- 当前未在最终报告中输出以下敏感内容：
  - 完整订阅 token
  - 完整节点密码
  - 完整 Turnstile secret
  - 完整 `SESSION_SECRET`
  - 完整 `CONVERTER_SOURCE_SECRET`
  - 完整上游订阅 URL
- 观察到的日志信息主要为启动、健康、路由和转换过程信息。
- 存在少量历史性/重启期的 502 记录与 Caddy 重启日志，但当前 smoke test 已恢复正常，不构成当前阻塞。

## 11. 仍需用户人工确认项

- 正式域名是否已确定
- HTTPS 是否已配置
- Turnstile 正式 hostname 是否已配置
- `TURNSTILE_SITE_KEY` 是否已换成生产 key
- `TURNSTILE_SECRET_KEY` 是否已换成生产 secret
- 是否开放注册
- 管理员密码是否已修改
- 上游订阅 token 是否已重置
- 数据库是否已备份
- 是否已打 Git tag
- 是否完成 Clash / Mihomo 测试
- 是否完成 Shadowrocket 测试
- 是否完成 sing-box 测试，如支持
- Shadowrocket 兼容策略是否接受当前直出方案，或是否需要进一步微调导出格式

## 12. 上线前最后建议

- 当前代码与容器状态已通过大部分验收，`shadowrocket` 也已完成直出闭环，建议在补齐外部人工确认项后进入正式上线窗口。
- 上线前建议优先补齐：
  1. 生产域名与 HTTPS
  2. Turnstile 生产 key 与 hostname
  3. 管理员密码与上游 token 重置
  4. 数据备份与 Git tag
  5. 至少两款客户端的订阅导入验收
  6. 复核 `shadowrocket` 直出在常用客户端中的展示效果
- 若以上项全部确认通过，可进入正式上线窗口。
