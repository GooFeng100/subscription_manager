# Subscription Manager 结题报告

生成日期：2026-06-03  
项目目录：`/vol1/1000/docker/subscription_manager`

> 说明：本文仅做外部复审与上线前检查参考，已对敏感值、完整 token、密码、密钥、内部 secret 做脱敏处理。

## 1. 项目基本信息

- 项目类型：订阅分发与管理系统
- 前端：Vue 3 + Vite + TypeScript
- 后端：Node.js + TypeScript + Express
- 数据库：MongoDB
- 缓存：Redis
- 订阅转换后端：本地 `subconverter`
- 防机器人：Cloudflare Turnstile
- 当前部署方式：Docker Compose
- 当前权威编排文件：`compose.yaml`
- 说明：仓库中仍存在 `docker-compose.yml`，但 `docker compose` 当前实际使用的是 `compose.yaml`

## 2. 已完成阶段总览

### 阶段 A：基础架构与容器化
- 搭建前后端基础工程与 Docker Compose 编排。
- 接入 MongoDB、Redis、本地 `subconverter`、Caddy。
- 建立健康检查、运行时配置、基础环境变量体系。

### 阶段 B：账号与授权体系
- 完成用户注册、登录、改密、登出、个人信息获取。
- 完成管理员登录与管理员侧基础鉴权。
- 完成授权码创建、撤销、兑换、使用记录与续费记录链路。

### 阶段 C：上游订阅与节点池
- 完成上游订阅管理、启用/禁用、测试、批量测试。
- 完成“全部测试”与自动轮询共用同一条批量刷新链路。
- 完成节点池写入、发布、版本递增、轮询日志。

### 阶段 D：订阅转换与客户端输出
- 完成 `/sub/:token` 订阅入口。
- 完成用户节点池到客户端订阅的转换链路。
- 接入本地 `subconverter`，不再依赖公网转换服务。
- 完成文件名版本化、过期空订阅返回、有效期头部输出。

### 阶段 E：Turnstile 与前端体验
- 登录、注册接入 Cloudflare Turnstile。
- 授权码兑换页不接 Turnstile。
- 将 Turnstile key 改为环境变量专管，管理端不再可编辑。
- 完成登录/注册页面尺寸、提示文案、错误收口、管理端按钮样式等 UI 优化。

### 阶段 F：可交付性与报告
- 完成运行状态验证、接口验证、构建验证、容器验证。
- 输出当前结题报告，供外部复审与上线前检查。

## 3. 完整 API 清单

> 说明：以下为当前代码中实际存在的路由清单，按模块分组。

### 3.1 认证与个人中心

文件：`backend/src/routes/auth.ts`

- `POST /api/auth/admin/login`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/change-password`
- `POST /api/auth/admin/change-password`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/admin/auth-logs`

### 3.2 用户、授权码、兑换

文件：`backend/src/routes/stage2.ts`

- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId/status`
- `POST /api/admin/users/:userId/renew`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `DELETE /api/admin/users/:userId`
- `POST /api/admin/users/:userId/reset-token`
- `GET /api/admin/renew-logs`
- `POST /api/admin/codes`
- `GET /api/admin/codes`
- `POST /api/admin/codes/:id/revoke`
- `DELETE /api/admin/codes/:id`
- `POST /api/redeem`

### 3.3 上游订阅管理

文件：`backend/src/routes/stage3.ts`

- `GET /api/admin/upstreams`
- `POST /api/admin/upstreams`
- `PATCH /api/admin/upstreams/:id`
- `POST /api/admin/upstreams/:id/enable`
- `POST /api/admin/upstreams/:id/disable`
- `DELETE /api/admin/upstreams/:id`
- `POST /api/admin/upstreams/:id/test`
- `POST /api/admin/upstreams/test-all`

### 3.4 订阅转换与内部源

文件：`backend/src/routes/stage4.ts`

- `GET /api/internal/converter-source/:cacheKey`
- `GET /sub/:token`

### 3.5 轮换与计划

文件：`backend/src/routes/stage6.ts`

- `GET /api/admin/rotation/status`
- `GET /api/admin/rotation/logs`
- `POST /api/admin/rotation/execute`
- `GET /api/admin/rotation/schedules`
- `POST /api/admin/rotation/schedules`
- `POST /api/admin/rotation/schedules/:id/toggle`
- `DELETE /api/admin/rotation/schedules/:id`

### 3.6 系统设置与日志

文件：`backend/src/routes/stage7.ts`

- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/logs/auth`
- `GET /api/admin/logs/code-usage`
- `GET /api/admin/logs/sub-access`

### 3.7 公共配置

- `GET /config`
- `GET /health`

## 4. 完整前端路由 / 页面清单

文件：`frontend/src/router/index.ts`

- `/` → 自动重定向到 `/login`
- `/register` → 注册页
- `/login` → 登录页
- `/dashboard` → 用户仪表盘
- `/redeem` → 授权码兑换页
- `/password` → 修改密码页
- `/help` → 使用帮助页
- `/rotation` → 轮换页（当前更像历史遗留页，见第 11 节）
- `/admin/users` → 管理员用户管理页
- `/admin/codes` → 管理员授权码管理页
- `/admin/upstreams` → 管理员上游管理页
- `/admin/rotation` → 管理员轮换管理页
- `/admin/settings` → 管理员系统设置页
- `/admin/logs` → 管理员日志页

### 页面组件对应关系

- `frontend/src/pages/LoginPage.vue`
- `frontend/src/pages/RegisterPage.vue`
- `frontend/src/pages/DashboardPage.vue`
- `frontend/src/pages/RedeemPage.vue`
- `frontend/src/pages/PasswordPage.vue`
- `frontend/src/pages/HelpPage.vue`
- `frontend/src/pages/RotationPage.vue`
- `frontend/src/pages/AdminUsersPage.vue`
- `frontend/src/pages/AdminCodesPage.vue`
- `frontend/src/pages/AdminUpstreamsPage.vue`
- `frontend/src/pages/AdminRotationPage.vue`
- `frontend/src/pages/AdminSettingsPage.vue`
- `frontend/src/pages/AdminLogsPage.vue`

## 5. 数据模型与字段

文件：`backend/src/lib/db.ts`

### 5.1 用户 `UserDoc`

- `_id`
- `username`
- `password_hash`
- `contact`
- `note`
- `sub_token`
- `status`
- `expire_at`
- `disable_after`
- `created_at`
- `updated_at`
- `last_login_at`

状态枚举：
- `inactive`
- `active`
- `grace`
- `expired`
- `disabled`

### 5.2 管理员 `AdminDoc`

- `_id`
- `username`
- `password_hash`
- `created_at`
- `updated_at`

### 5.3 认证日志 `AuthLogDoc`

- `_id`
- `username`
- `role`
- `ip`
- `user_agent`
- `success`
- `message`
- `created_at`

### 5.4 授权码 `ActivationCodeDoc`

- `_id`
- `code`
- `status`
- `owner_username`
- `note`
- `created_at`
- `updated_at`
- `redeemed_at`
- `revoked_at`
- `expire_at`

### 5.5 续费日志 `RenewalLogDoc`

- `_id`
- `username`
- `code`
- `days`
- `ip`
- `created_at`

### 5.6 上游订阅 `UpstreamDoc`

- `_id`
- `name`
- `source_url`
- `source_type`
- `enabled`
- `last_test_ok`
- `last_test_status`
- `last_test_type`
- `last_test_node_count`
- `last_test_message`
- `last_test_error`
- `last_test_at`
- `created_at`
- `updated_at`

### 5.7 订阅访问日志 `SubAccessLogDoc`

- `_id`
- `username`
- `token`
- `target`
- `ip`
- `status_code`
- `result`
- `message`
- `created_at`

### 5.8 轮换日志 `RotationLogDoc`

- `_id`
- `action`
- `version`
- `summary`
- `created_at`

### 5.9 系统状态 `SystemStateDoc`

- `_id`
- `rotation_schedules`
- `rotation_state`
- `subscription_version`
- `batch_test_state`
- `upstream_batch_state`
- `updated_at`

> 说明：当前代码中没有独立的“代码使用日志”独立模型名称；相关行为主要由授权码、续费日志、认证日志和订阅访问日志共同记录。

## 6. 系统设置字段

文件：`backend/src/lib/runtime-settings.ts`

### 当前仍在使用的运行时设置

- `registration_enabled`
- `converter_backend_url`
- `converter_default_target`
- `converter_default_config_url`
- `subscription_filename_template`
- `upstream_poll_interval_minutes`
- `sub_rate_limit_per_minute`
- `login_fail_limit`
- `login_lock_minutes`
- `register_ip_limit`
- `register_ip_window_minutes`
- `turnstile_enabled`
- `login_turnstile_enabled`
- `register_turnstile_enabled`
- `site_domain`

### 仅由环境变量提供，不再允许后台修改

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

### 已移除或不再使用的旧项

- `upstream_fetch_user_agent`
- `sub_cache_seconds`
- `redeem_turnstile_enabled`

### 运行时配置当前表现

- `GET /config` 返回 `turnstileEnabled` 与 `turnstileSiteKey`
- `turnstileSiteKey` 直接来自环境变量
- 修改 Turnstile key 需要改环境变量并重建/重启容器，不再通过后台 UI 修改

## 7. Docker / 部署状态

### 当前服务

- `app`
  - 后端服务
  - 内网暴露
  - 与 MongoDB、Redis、subconverter 同网络
- `caddy`
  - 对外服务入口
  - 当前映射宿主机 `8084 -> 80`
- `mongodb`
  - 数据持久化
  - 当前健康检查通过
- `redis`
  - 当前健康检查通过
  - 启用 AOF 持久化
- `subconverter`
  - 本地转换后端
  - 仅 `expose: 25500`
  - 不对宿主机直接暴露端口

### 当前部署状态

- `docker compose ps` 显示所有核心容器为 `Up`
- `GET /health` 返回正常
- `GET /config` 返回正常

### 需要关注的部署问题

- 仓库中同时存在 `compose.yaml` 与 `docker-compose.yml`
- `docker compose` 当前使用 `compose.yaml`
- 运行时会出现文件重复警告，容易让运维误判

## 8. 订阅转换链路

### 8.1 手动“全部测试”与自动轮询共用的链路

1. 触发批量测试
2. 后端锁住本轮批量任务，避免重复触发
3. 读取所有启用的上游
4. 逐条拉取上游订阅
5. 按 `source_type` 选择抓取策略与 UA
6. 识别内容类型：
   - 直接节点
   - Base64 节点
   - Clash YAML
   - 坏链接 / HTML
7. 成功的节点写入节点池
8. 批量结束后一次性发布节点池
9. 版本号递增
10. 写入轮换日志 / 批量测试状态
11. 释放任务锁

### 8.2 用户订阅输出链路

1. 用户访问 `/sub/:token`
2. 后端鉴权并同步生命周期
3. 检查状态、禁用、过期、限流
4. 读取已发布的节点池
5. 写入临时内部源
6. 通过本地 `subconverter` 转换
7. 输出最终客户端订阅

### 8.3 关键输出特性

- 使用本地 `subconverter`
- 订阅文件名支持版本化
- 节点名保留 emoji / 国旗前缀
- 过期用户返回 200 空订阅
- `Subscription-Userinfo` 只保留到期信息，不再写流量三元组
- 返回头含 `X-Subscription-Version`

## 9. 已执行测试与验证

### 9.1 构建验证

- `npm run build --prefix backend`
- `npm run build --prefix frontend`

### 9.2 Docker / 运行验证

- `docker compose config`
- `docker compose ps`
- `docker compose up -d --build`
- `docker compose restart app caddy`
- `docker compose up -d --force-recreate app`

### 9.3 接口验证

- `GET /health`
- `GET /config`
- `GET /api/admin/settings`
- `GET /api/admin/upstreams`
- `POST /api/admin/upstreams/test-all`
- `POST /api/admin/upstreams/:id/test`
- `GET /sub/:token?target=clash`
- `GET /api/internal/converter-source/:cacheKey`

### 9.4 功能验证结论

- 后端健康检查正常
- Turnstile 前端可正确取到站点配置
- 登录 / 注册页面已接入 Turnstile
- 授权码兑换页不再启用 Turnstile
- 订阅转换链路可正常输出客户端配置
- 上游批量测试与自动轮询共用同一路径
- 过期用户可返回空订阅

## 10. 已知问题与风险

### 风险分级汇总

- **P0：0**
- **P1：1**
- **P2：4**

### P1

1. `frontend/src/pages/RotationPage.vue` 路由与权限语义不够一致  
   - 这是一个用户可达页面，但内部调用的是管理员轮换接口。
   - 对普通用户来说属于明显的路由/权限语义错位，建议在上线前确认是否要改为管理员专用或下线。

### P2

1. 仓库中同时存在 `compose.yaml` 与 `docker-compose.yml`  
   - 当前实际使用 `compose.yaml`，但重复文件会造成维护噪音。

2. 文档存在历史漂移  
   - `docs/DEV_TASK.md` 等文档仍保留部分旧逻辑描述，例如旧的 Turnstile 兑换页、旧的上游 UA / 缓存说明。

3. 老的管理员认证接口仍保留  
   - `POST /api/auth/admin/login`
   - `POST /api/auth/admin/change-password`
   - 前端当前不再使用这些入口，是否保留作为兼容需确认。

4. 过期空订阅的客户端兼容性仍需更广泛验证  
   - 当前代码返回合法空订阅，但不同客户端的表现仍可能不同。

## 11. 可能冗余的字段 / 接口 / 页面

### 可能冗余字段

- `upstream_fetch_user_agent`：已不再使用
- `sub_cache_seconds`：已不再使用
- `redeem_turnstile_enabled`：已不再使用

### 可能冗余或待确认接口

- `POST /api/auth/admin/login`
- `POST /api/auth/admin/change-password`
- `GET /api/admin/rotation/status` 与 `/admin/rotation` 页面之间的职责分层仍需再确认

### 可能冗余或待确认页面

- `frontend/src/pages/RotationPage.vue`
  - 它更像历史遗留或调试页，不建议直接对普通用户开放。

### 可能冗余的部署文件

- `docker-compose.yml`
  - 已被 `compose.yaml` 取代，但仍存在于仓库中。

### 参考文档缺口

- `docs/UI_REPLICATION_PLAN.md` 当前未找到。
  - 若这是历史上曾引用过的文件，建议后续统一清理引用或补齐文档来源。

## 12. 上线前需用户确认的事项

1. **Turnstile 真实域名与 Hostname**
   - 本地测试可以先用测试 key。
   - 正式上线前要确认真实域名已经加入 Cloudflare Turnstile hostname。

2. **Turnstile 生产 key 切换方式**
   - 当前 key 已改为环境变量专管。
   - 上线前需确认正式 key 已写入部署环境，并通过重建/重启容器生效。

3. **过期空订阅策略是否保留**
   - 当前实现是 200 空订阅 + 过期提示标题。
   - 需要确认客户端体验是否符合预期。

4. **订阅文件名版本格式**
   - 当前默认采用 `用户名_V版本号` 风格。
   - 是否需要继续保留这个展示风格需要用户确认。

5. **自动轮询间隔**
   - 当前使用系统设置中的轮询间隔。
   - 上线前需要确认是否保持默认值或改为更合适的频率。

6. **`/rotation` 页面是否继续保留**
   - 该页面的权限与用途目前不够清晰。
   - 建议在上线前确认是否改造或隐藏。

## 13. 建议的后续检查

1. 用真实域名做一次 Turnstile 登录 / 注册联调。
2. 用至少两款常用客户端验证：
   - 版本化文件名
   - 到期显示
   - 过期空订阅
3. 再次验证批量测试按钮与自动轮询日志是否一致。
4. 检查 `docker-compose.yml` 是否可以删除或改为纯兼容文档。
5. 对 `docs/DEV_TASK.md` 做一次文档去旧化，避免后续误读。
6. 评估是否保留 `frontend/src/pages/RotationPage.vue`。
7. 将最终上线所需环境变量整理成一份独立部署清单。
