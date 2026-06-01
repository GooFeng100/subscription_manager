# 订阅聚合授权分发系统开发任务书

版本：v1.3  
更新日期：2026-06-01  
项目类型：全新独立系统  
部署位置：本地开发部署在 NAS 192.168.10.3，正式上线部署在美国服务器  
适用阶段：MVP 至小规模正式使用  
目标用户规模：第一阶段 10 人以内，后续可扩展  
核心原则：不自建代理中转，不承担用户代理流量，仅管理用户、授权码、订阅聚合、上游轮换和订阅分发。

---

## 0. 本次更新要点

相较上一版，当前版本累计明确以下调整：

1. 授权码明确改为一次性使用，不支持同一个授权码多用户或多次兑换。
2. 本地开发部署目标为 NAS `192.168.10.3`，通过 Docker Compose 启动容器。
3. 本地开发阶段不强制使用域名和 HTTPS，可通过 `http://192.168.10.3:8084` 访问。
4. 因 NAS 端 `8080-8083` 已占用，本项目本地映射端口从 `8084` 开始。
5. 正式上线阶段再配置真实域名、HTTPS 和生产反向代理。
6. 第一版认证方式优先采用 Cookie Session，避免 JWT 撤销和会话失效复杂度。
7. 第一版继续取消在线支付，仅采用人工收款 + 一次性授权码模式。
8. 订阅转换第一版可调用公共 subconverter 后端，后续可切换为自建 subconverter 容器。
9. 项目根目录新增项目级 Codex skill，后续编程必须遵循该 skill 与本任务书。
10. 增加里程碑交付规则：每个里程碑测试通过后，上传到 GitHub 仓库 `GooFeng100/subscription_manager`。

---

## 1. 项目背景

本项目用于聚合多个上游机场订阅，例如 A、B、C 三个上游订阅源，并通过本系统向用户分发专属订阅链接。

用户自行注册账号后，需要使用管理员发放的一次性授权码进行激活或续期。授权成功后，用户在指定有效期内可以访问系统生成的专属订阅链接。用户到期后，系统不再返回最新订阅内容。

系统采用“订阅轮换失效”策略：管理员在固定轮换窗口对上游机场执行重新鉴权，使旧节点配置失效。有效用户通过手动或自动更新订阅重新获得最新节点，过期用户因为无法访问最新订阅而失效。

本系统不建设自有代理中转服务器，用户代理流量不经过本系统服务器。系统服务器只承担后台管理、用户鉴权、订阅聚合、订阅文本分发和日志记录。

---

## 2. 项目目标

### 2.1 核心目标

1. 管理多个上游机场订阅源。
2. 支持用户自行注册、登录、修改密码。
3. 支持管理员创建、禁用、删除、续期用户。
4. 支持一次性授权码生成、作废、兑换、续期。
5. 为每个用户生成唯一专属订阅 token 和订阅链接。
6. 根据用户有效期、实际失效时间、账号状态控制订阅是否返回。
7. 支持 A/B/C 上游订阅的新增、编辑、启用、停用、测试拉取。
8. 支持管理员手动轮换上游订阅版本。
9. 支持调用现成订阅转换服务，例如公共 subconverter 后端或自建 subconverter 后端。
10. 支持 Clash/Mihomo、sing-box、V2Ray、Shadowrocket 等常见客户端订阅格式。
11. 支持 Cloudflare Turnstile 防自动化注册、登录、授权码兑换。
12. 支持登录失败限制、IP 限流、订阅接口限流。
13. 支持订阅访问日志、轮换日志、授权码使用日志、登录日志。

### 2.2 非目标范围

第一版不实现以下功能：

1. 不接入在线支付系统。
2. 不接入微信支付、支付宝、Stripe、PayPal。
3. 不自建代理中转服务器。
4. 不统计用户真实代理流量。
5. 不保证用户到期后立即断流。
6. 不防止有效用户私下分享最新节点。
7. 不做复杂多管理员权限系统。
8. 不做完整商业机场面板。
9. 不做复杂仪表盘、图表、工单系统、在线客服。
10. 不在第一版实现 Playwright 自动重新鉴权。
11. 不在第一版强制自建 subconverter。

---

## 3. 系统总体架构

### 3.1 业务链路

```text
A/B/C 上游机场订阅
        ↓
管理员手动更新 / 后续自动化获取
        ↓
系统保存当前有效上游订阅链接
        ↓
用户访问专属订阅链接
        ↓
后端验证用户状态、有效期、限流
        ↓
调用 subconverter 后端聚合转换
        ↓
返回适配客户端的订阅内容
        ↓
用户客户端更新订阅
```

### 3.2 流量链路

```text
用户客户端 → A/B/C 上游机场节点 → 目标网站
```

本系统服务器不在代理链路中，不承担用户代理流量。

### 3.3 订阅失效逻辑

```text
用户到期 → 进入 grace 宽限状态
固定轮换窗口 → 管理员重置上游鉴权
有效用户更新订阅 → 获得新节点
过期用户无法获取新订阅 → 旧节点失效
```

---

## 4. 推荐技术栈

### 4.1 前端

统一使用一套前端工程，兼容管理端、用户端、PC Web 和 Mobile 浏览器。

推荐：

```text
语言：TypeScript
框架：Vue 3
构建：Vite
路由：Vue Router
状态：Pinia
请求：Axios
UI：Element Plus / Naive UI / 自定义简洁组件
样式：CSS Flex/Grid + 响应式媒体查询
```

说明：

1. 不使用两套用户端代码。
2. 不优先使用 uni-app，因为当前目标是 Web + Mobile 浏览器兼容，不是原生 App。
3. 后续如需打包 App，可考虑 PWA 或 Capacitor。
4. 管理端以表格和弹窗为主，用户端以移动优先设计。

### 4.2 后端

推荐：

```text
语言：TypeScript
运行时：Node.js
框架：Express
接口风格：REST API
认证方式：Cookie Session
```

第一版建议 Express，开发速度快、结构简单。认证优先使用 Cookie Session，Cookie 必须设置 `HttpOnly`，生产环境必须设置 `Secure`，并根据部署域名配置合适的 `SameSite` 策略。

### 4.3 数据库

推荐：

```text
MongoDB
```

理由：

1. 字段迭代灵活。
2. 适合保存用户、授权码、上游订阅、日志、系统配置。
3. 与现有项目部署经验接近。

### 4.4 Redis

新增 Redis，用于：

1. 登录失败次数计数。
2. 注册 IP 频率限制。
3. 订阅接口 token/IP 限流。
4. 授权码兑换限流。
5. Turnstile 校验结果短期缓存，可选。
6. 短期订阅转换缓存，可选。

### 4.5 Cloudflare Turnstile

用于防自动化注册、登录、授权码兑换。

使用位置：

```text
注册页：必须启用
登录页：建议启用
授权码兑换页：建议启用
/sub/:token 订阅接口：不启用 Turnstile，只使用 Redis 限流
```

原因：订阅接口需要被 Clash、Mihomo、Shadowrocket、sing-box 等客户端自动请求，不能加入人机验证。

### 4.6 订阅转换

第一版：

```text
调用公共 subconverter 后端
```

后续可选：

```text
自建 subconverter 容器
Sub-Store
```

要求：

1. 用户不能直接看到 subconverter 的最终长链接。
2. 用户只能访问本系统生成的专属订阅链接。
3. 后端服务端请求转换结果，再将结果返回给用户。
4. 上游订阅链接不能直接暴露给用户。

### 4.7 上游重新鉴权

第一版：

```text
人工登录上游机场后台
人工点击重新鉴权
人工复制最新订阅链接
粘贴到本系统上游管理页面
```

后续可选：

```text
Playwright 自动化 + 人工兜底
```

---

## 5. 部署要求

### 5.1 本地开发部署

本地开发阶段部署在 NAS `192.168.10.3`，采用 Docker Compose 启动容器。当前 NAS 的 `8080-8083` 端口已占用，因此本项目本地访问端口固定从 `8084` 开始。

本地开发推荐访问地址：

```text
http://192.168.10.3:8084
```

本地开发阶段不强制使用域名，也不强制 HTTPS。系统配置中仍保留 `SITE_DOMAIN` / `PUBLIC_BASE_URL` 等配置项，默认填写 `http://192.168.10.3:8084`，用于生成用户订阅链接。

本地开发阶段 Turnstile 可按以下策略处理：

1. 开发调试时允许通过环境变量关闭 Turnstile 校验。
2. 需要完整验证 Turnstile 流程时，再配置可用于测试环境的站点 key 和 secret。
3. `/sub/:token` 订阅接口始终不接入 Turnstile，只使用 Redis 限流。

本地 Docker Compose 要求：

```text
对外暴露端口：8084
内部服务：app、mongodb、redis、caddy 或 nginx
MongoDB 和 Redis 默认不暴露到 NAS 宿主机端口
使用 Docker volume 持久化 MongoDB 数据
```

### 5.2 正式上线服务器

正式上线部署在美国服务器。

推荐配置：

```text
CPU：1 核起步，推荐 1-2 核
内存：2GB 推荐
硬盘：30GB 起步
系统：Ubuntu 22.04 / 24.04 LTS
```

因为系统不跑代理中转流量，所以服务器不需要大带宽代理能力。

### 5.3 域名与 HTTPS

本地开发阶段不需要域名，可以直接使用 NAS IP 和端口访问。正式上线阶段必须配置 HTTPS 域名。

原因：

1. 用户注册、登录需要传输账号密码。
2. 授权码和订阅 token 属于敏感信息。
3. 管理端后台必须加密访问。
4. 客户端订阅链接使用 HTTPS 更稳定。

推荐域名结构：

```text
https://sub.example.com
```

路由示例：

```text
https://sub.example.com/admin
https://sub.example.com/login
https://sub.example.com/register
https://sub.example.com/dashboard
https://sub.example.com/sub/{token}?target=clash
```

### 5.4 容器组成

第一版推荐容器：

```text
1. app
   - Node.js 后端 API
   - 负责用户、授权码、上游订阅、订阅分发、Turnstile 校验、限流

2. mongodb
   - 保存业务数据和日志

3. redis
   - 登录失败计数、限流、短期缓存

4. caddy 或 nginx
   - HTTPS 入口
   - 静态前端托管
   - API 反向代理
```

可选后续容器：

```text
5. subconverter
   - 自建订阅转换后端

6. worker
   - 定时任务、轮换提醒、日志清理、状态更新

7. playwright-worker
   - 上游自动重新鉴权

8. backup
   - MongoDB 定时备份
```

第一版不要求单独 web 容器，前端打包后可由 caddy/nginx 托管。本地开发 NAS 部署可先使用 HTTP，正式上线再启用 HTTPS。

---

## 6. 功能模块设计

## 6.1 管理端模块

### 6.1.1 管理员登录

功能：

1. 管理员账号密码登录。
2. 登录页接入 Cloudflare Turnstile。
3. 登录失败次数限制。
4. 登录成功后进入管理端。

验收标准：

1. 输入正确账号密码和 Turnstile 验证后可以登录。
2. 密码错误时提示明确，不泄露账号是否存在。
3. 连续失败超过阈值后，账号或 IP 被短时间限制。
4. 管理端未登录时访问任意后台页面会跳转登录页。

---

### 6.1.2 用户管理

字段：

```text
用户名
订阅 token
理论到期时间 expire_at
实际失效时间 disable_after
状态 inactive / active / grace / expired / disabled
注册时间
最后登录时间
最后订阅请求时间
备注
```

功能：

1. 用户列表。
2. 搜索用户名。
3. 新增用户。
4. 编辑用户备注。
5. 管理员手动续期。
6. 禁用 / 启用用户。
7. 删除用户。
8. 重置订阅 token。
9. 复制用户订阅链接。

用户状态规则：

```text
inactive：已注册但未授权
active：正常有效
grace：理论到期，但未到实际失效窗口
expired：已超过实际失效时间
disabled：管理员手动禁用
```

验收标准：

1. 管理员可以查看所有用户。
2. 用户注册后默认为 inactive。
3. 用户兑换授权码后变为 active。
4. 到达 expire_at 后，系统可标记为 grace。
5. 到达 disable_after 后，系统可标记为 expired。
6. disabled 用户无法登录或获取订阅。
7. 重置 token 后旧订阅链接不可继续获取内容。

---

### 6.1.3 授权码管理

字段：

```text
授权码 code
授权天数 days
状态 unused / used / disabled / expired
使用用户 used_by
使用时间 used_at
授权码过期时间 expire_at，可选
创建时间 created_at
备注 remark
```

说明：

1. 第一版授权码只能使用一次。
2. 不支持同一个授权码被多个用户共享兑换。
3. 不设计 `max_use_count` 和 `used_count`，避免一次性授权码与多次使用授权码逻辑混杂。
4. 兑换成功后，授权码状态立即从 `unused` 更新为 `used`，并写入 `used_by` 和 `used_at`。

功能：

1. 批量生成授权码。
2. 设置授权天数。
3. 复制授权码。
4. 作废授权码。
5. 删除授权码。
6. 查看授权码使用记录。

验收标准：

1. 管理员可以批量生成指定数量和天数的授权码。
2. 未使用授权码可被用户兑换。
3. 已使用或作废授权码不能再次兑换。
4. 兑换成功后自动为用户增加有效期。
5. 授权码使用记录必须可追溯。
6. 并发兑换同一个授权码时，只允许一个请求成功，其他请求必须失败。

---

### 6.1.4 上游订阅管理

字段：

```text
上游名称 name
订阅链接 subscribe_url
状态 active / disabled / failed / expired
是否启用 enabled
最后同步时间 last_sync_at
最后更新链接时间 last_update_at
备注 remark
```

功能：

1. 新增上游订阅。
2. 编辑订阅链接。
3. 启用 / 停用上游。
4. 测试拉取订阅。
5. 删除上游。
6. 手动标记上游到期或恢复。

验收标准：

1. 启用的上游会参与订阅聚合。
2. 停用的上游不会参与订阅聚合。
3. 测试拉取失败时显示错误原因。
4. A 上游失效时，不影响 B/C 上游继续输出。
5. A 上游恢复后，用户更新订阅即可重新获得 A 节点。

---

### 6.1.5 轮换管理

字段：

```text
当前订阅版本 version
上次轮换时间 last_rotated_at
本月轮换次数 monthly_rotation_count
轮换原因 reason
影响用户列表 affected_users
```

功能：

1. 查看当前订阅版本。
2. 查看上次轮换时间。
3. 手动执行轮换。
4. 记录轮换日志。
5. 查看轮换历史。
6. 配置推荐轮换窗口。

第一版不要求自动定时轮换，采用手动轮换。

手动轮换流程：

```text
1. 管理员在 A/B/C 上游后台人工重新鉴权。
2. 管理员将新订阅链接粘贴到上游订阅管理页面。
3. 管理员进入轮换管理页面点击“手动轮换”。
4. 系统拉取所有启用上游订阅。
5. 系统生成新的订阅版本。
6. 系统记录轮换日志。
7. 管理员通知有效用户手动更新订阅。
```

验收标准：

1. 管理员可以手动执行轮换。
2. 轮换前需要二次确认。
3. 轮换成功后生成新的版本号。
4. 轮换失败时不覆盖旧版本。
5. 轮换日志记录完整。

---

### 6.1.6 安全设置

字段：

```text
是否开放注册
Turnstile site key
Turnstile secret key
登录验证码开关
注册验证码开关
授权码兑换验证码开关
登录失败锁定次数
登录失败锁定时间
注册 IP 限流规则
订阅 token 限流规则
```

功能：

1. 开启 / 关闭用户注册。
2. 配置 Turnstile。
3. 配置登录失败限制。
4. 配置 IP 注册频率限制。
5. 配置订阅接口限流。

验收标准：

1. 关闭注册后，用户不能注册新账号。
2. Turnstile 未通过时，注册、登录、授权码兑换不能继续。
3. 同一 IP 短时间大量注册会被限制。
4. 同一账号连续登录失败会被短时间限制。
5. 订阅接口频繁请求会被限流，但正常客户端更新不受影响。

---

### 6.1.7 系统设置

字段：

```text
系统名称
站点域名
subconverter 后端地址
默认订阅格式
默认授权天数
管理员密码修改
```

功能：

1. 设置系统名称。
2. 设置 HTTPS 域名。
3. 设置订阅转换后端。
4. 设置默认输出格式。
5. 修改管理员密码。

验收标准：

1. 修改设置后立即生效或明确提示需要重启。
2. subconverter 后端地址错误时，订阅接口返回明确错误。
3. 管理员密码修改后，旧密码不能继续登录。

---

## 6.2 用户端模块

### 6.2.1 用户注册

字段：

```text
用户名
密码
确认密码
Cloudflare Turnstile token
```

功能：

1. 用户自行注册。
2. 注册时必须通过 Turnstile。
3. 注册成功后状态为 inactive。
4. 注册成功后可登录，但不能获取有效订阅，需兑换授权码。

验收标准：

1. 用户名重复时提示。
2. 密码不符合规则时提示。
3. Turnstile 校验失败时无法注册。
4. 注册成功后数据库生成用户记录和订阅 token。
5. 新用户默认 inactive。

---

### 6.2.2 用户登录

字段：

```text
用户名
密码
Cloudflare Turnstile token
```

功能：

1. 用户登录。
2. 登录时通过 Turnstile。
3. 登录成功进入我的订阅页面。
4. 登录失败写入失败计数。

验收标准：

1. 正确账号密码可登录。
2. 错误密码不可登录。
3. disabled 用户不可登录。
4. Turnstile 校验失败不可登录。
5. 连续失败超过阈值后短时间限制登录。

---

### 6.2.3 我的订阅

显示内容：

```text
用户名
账号状态
理论到期时间
实际失效时间
订阅链接
复制订阅链接按钮
更新订阅说明入口
```

功能：

1. 显示当前账号状态。
2. 显示到期时间。
3. 显示用户专属订阅链接。
4. 支持复制订阅链接。
5. 支持选择客户端格式。

订阅格式：

```text
Clash / Mihomo
sing-box
V2Ray
Shadowrocket
```

验收标准：

1. active 和 grace 用户可以看到订阅链接。
2. inactive 用户提示需要兑换授权码。
3. expired 用户提示已过期。
4. disabled 用户提示账号不可用。
5. 点击复制后能复制正确链接。

---

### 6.2.4 授权码兑换

字段：

```text
授权码
Cloudflare Turnstile token
```

功能：

1. 用户输入授权码兑换有效期。
2. 兑换成功后更新用户 expire_at 和 disable_after。
3. 记录兑换日志。

续期规则：

```text
如果用户当前未过期：
新到期时间 = 当前 expire_at + 授权天数

如果用户当前已过期或未授权：
新到期时间 = 当前时间 + 授权天数
```

验收标准：

1. 有效授权码可兑换成功。
2. 已使用授权码不可重复兑换。
3. 作废授权码不可兑换。
4. Turnstile 未通过不可兑换。
5. 兑换成功后用户状态变为 active。
6. 续期记录写入日志。

---

### 6.2.5 使用说明

页面内容：

1. Clash / Mihomo 使用说明。
2. Shadowrocket 使用说明。
3. sing-box 使用说明。
4. V2RayN 使用说明。
5. 轮换后如何手动更新订阅。
6. 常见问题。

验收标准：

1. 用户可以在移动端清晰阅读。
2. 说明页不需要登录也可访问，可选。
3. 至少包含 Clash / Mihomo 的导入步骤。

---

### 6.2.6 修改密码

功能：

1. 输入旧密码。
2. 输入新密码。
3. 确认新密码。
4. 修改成功后需要重新登录或刷新登录状态。

验收标准：

1. 旧密码错误不可修改。
2. 新密码必须符合强度要求。
3. 修改成功后旧密码不能登录。

---

## 7. 订阅接口设计

### 7.1 用户订阅接口

```text
GET /sub/:token?target=clash
GET /sub/:token?target=singbox
GET /sub/:token?target=v2ray
GET /sub/:token?target=shadowrocket
```

处理逻辑：

```text
1. 根据 token 查询用户。
2. token 不存在，返回过期提示订阅或 404。
3. 用户 inactive，返回未授权提示订阅。
4. 用户 disabled，返回禁用提示订阅。
5. 当前时间超过 disable_after，返回过期提示订阅。
6. 用户有效，查询启用的上游订阅。
7. 组合上游订阅地址。
8. 服务端调用 subconverter 后端。
9. 返回转换后的订阅内容。
10. 写入订阅访问日志。
```

要求：

1. 不暴露上游订阅链接。
2. 不 302 跳转到 subconverter 长链接。
3. 订阅接口不启用 Turnstile。
4. 订阅接口必须启用 Redis 限流。
5. 可缓存同一用户同一 target 的转换结果 1-5 分钟，避免频繁调用公共后端。

验收标准：

1. 有效用户可以获取订阅内容。
2. 过期用户不能获取有效节点。
3. 停用上游不会出现在订阅内容中。
4. subconverter 失败时返回明确错误，不泄露上游敏感链接。
5. 访问日志记录 token、用户、IP、User-Agent、target、成功状态。

---

## 8. 数据模型建议

### 8.1 users

```text
_id
username
password_hash
sub_token
status
expire_at
disable_after
remark
last_login_at
last_sub_request_at
created_at
updated_at
```

### 8.2 admins

```text
_id
username
password_hash
status
last_login_at
created_at
updated_at
```

第一版可只支持一个超级管理员。

### 8.3 activation_codes

```text
_id
code
days
status
used_by
used_at
expire_at
remark
created_at
updated_at
```

说明：授权码为一次性使用，`code` 必须建立唯一索引。兑换时必须使用原子更新条件，例如仅当 `status = unused` 时才能更新为 `used`，防止并发重复兑换。

### 8.4 renewals

```text
_id
user_id
activation_code_id
before_expire_at
after_expire_at
days_added
renew_type
created_at
```

### 8.5 upstream_providers

```text
_id
name
subscribe_url
status
enabled
last_sync_at
last_update_at
remark
created_at
updated_at
```

### 8.6 subscription_versions

```text
_id
version
upstream_snapshot
created_by
reason
created_at
```

### 8.7 rotation_logs

```text
_id
version_before
version_after
reason
affected_users
status
message
created_at
```

### 8.8 subscription_access_logs

```text
_id
user_id
token_hash
target
ip
user_agent
success
message
created_at
```

### 8.9 auth_logs

```text
_id
user_id
username
ip
user_agent
action
success
message
created_at
```

### 8.10 system_settings

```text
_id
site_name
site_domain
converter_backend_url
default_target
registration_enabled
turnstile_site_key
turnstile_secret_key_encrypted
login_turnstile_enabled
register_turnstile_enabled
redeem_turnstile_enabled
login_fail_limit
login_lock_minutes
sub_rate_limit_per_token
sub_rate_limit_per_ip
created_at
updated_at
```

### 8.11 索引与约束

```text
users.username 唯一索引
users.sub_token 唯一索引
admins.username 唯一索引
activation_codes.code 唯一索引
auth_logs.created_at 普通索引
renewals.user_id + created_at 复合索引
subscription_access_logs.user_id + created_at 复合索引
subscription_access_logs.created_at 普通索引
rotation_logs.created_at 普通索引
```

---

## 8.12 项目级 Skill 与开发约束

项目根目录包含项目级 Codex skill：

```text
.codex/skills/subscription-manager-project/SKILL.md
```

后续编程、测试、部署、文档维护、里程碑交付都必须先遵循该 skill，再结合本任务书执行。若 skill 与任务书不一致，以任务书为准，并在需要时更新 skill。

---

## 9. 页面清单

### 9.1 管理端页面

```text
/admin/login
/admin/users
/admin/codes
/admin/upstreams
/admin/rotation
/admin/security
/admin/settings
/admin/logs
```

第一版可以将 security 合并到 settings，将 logs 作为简单日志页面。

### 9.2 用户端页面

```text
/register
/login
/dashboard
/redeem
/tutorial
/change-password
```

### 9.3 订阅接口

```text
/sub/:token
```

---

## 10. UI 要求

### 10.1 总体风格

1. 简洁、清晰、轻量。
2. 不做复杂仪表盘和图表。
3. 管理端以左侧菜单 + 顶部栏 + 表格 + 弹窗为主。
4. 用户端以移动优先，兼容 PC Web。
5. 中文界面。
6. 按钮状态明确。
7. 状态颜色清晰。

### 10.2 管理端菜单

```text
用户管理
授权码管理
上游订阅
轮换管理
系统设置
日志记录
```

### 10.3 用户端底部导航，移动端

```text
我的订阅
兑换授权码
使用说明
我的
```

### 10.4 响应式要求

1. PC 宽屏显示左侧菜单。
2. 平板和手机隐藏左侧菜单，使用顶部或底部导航。
3. 表格在窄屏使用卡片式布局或横向滚动。
4. 表单按钮适合手机点击。
5. 订阅链接输入框支持一键复制。

---

## 11. 安全要求

1. 正式上线必须使用 HTTPS；本地 NAS 开发环境可使用 HTTP。
2. 用户密码必须 bcrypt 或 argon2 哈希保存。
3. 管理员密码不得明文保存。
4. Turnstile secret key 不得暴露到前端。
5. 上游订阅链接不得暴露给用户。
6. 用户专属订阅 token 应使用足够长度随机字符串。
7. 订阅 token 被重置后旧 token 立即失效。
8. 管理后台接口必须鉴权。
9. 管理员登录失败必须限流。
10. 用户注册、登录、授权码兑换必须校验 Turnstile。
11. 订阅接口不能启用 Turnstile，但必须限流。
12. 日志中不要明文记录完整上游订阅链接。
13. 数据库定期备份。

---

## 12. 阶段性开发任务

### 里程碑通用交付规则

每个阶段作为一个里程碑管理。每个里程碑完成后必须执行以下检查：

1. 对照本阶段验收标准逐项确认。
2. 执行相关测试，包括后端测试、前端测试、类型检查、构建检查或 Docker 配置检查。
3. 测试通过后提交 Git commit。
4. 测试通过并完成提交后，上传到 GitHub 仓库：

```text
https://github.com/GooFeng100/subscription_manager
```

5. 如果测试失败、未初始化 Git、未配置 remote、缺少 GitHub 凭据或网络不可用，则不得声称已上传，必须记录阻塞原因。

## 阶段 0：项目初始化

任务：

1. 创建全新 Git 仓库。
2. 建立 frontend、backend、docker、nginx/caddy 配置目录。
3. 配置 TypeScript、ESLint、Prettier。
4. 配置 Docker Compose。
5. 配置环境变量模板 `.env.example`。
6. 生成 NAS 本地部署用 `docker-compose.nas.yml`，对外端口使用 `8084`。

验收标准：

1. 本地可以启动前端开发服务。
2. 本地可以启动后端 API。
3. Docker Compose 可以启动 app、mongodb、redis、nginx/caddy。
4. `.env.example` 包含必要配置项。
5. NAS 上可通过 `http://192.168.10.3:8084` 访问本地开发环境。

---

## 阶段 1：基础认证与安全

任务：

1. 实现管理员登录。
2. 实现用户注册。
3. 实现用户登录。
4. 接入 Cloudflare Turnstile。
5. 接入 Redis 登录失败限制。
6. 实现 Cookie Session。
7. 实现修改密码。

验收标准：

1. 管理员可以登录管理端。
2. 用户可以注册和登录。
3. 注册、登录必须通过 Turnstile。
4. 登录失败超过阈值后被限制。
5. disabled 用户无法登录。
6. 用户密码哈希保存。

---

## 阶段 2：用户与授权码

任务：

1. 实现用户管理页面。
2. 实现用户状态管理。
3. 实现授权码生成、列表、复制、作废、删除。
4. 实现用户端授权码兑换。
5. 实现续期记录。
6. 实现 expire_at 和 disable_after 计算。

验收标准：

1. 新注册用户默认为 inactive。
2. 用户兑换授权码后变为 active。
3. 授权码不可重复使用。
4. 管理员可以手动续期用户。
5. 续期时间计算正确。
6. 续期记录完整可查。
7. 同一个授权码并发兑换时只能成功一次。

---

## 阶段 3：上游订阅管理

任务：

1. 实现上游订阅新增、编辑、启用、停用、删除。
2. 实现测试拉取功能。
3. 实现上游状态展示。
4. 实现上游订阅敏感信息隐藏。

验收标准：

1. 管理员可以维护 A/B/C 上游。
2. 停用上游不参与聚合。
3. 测试拉取失败时显示错误。
4. 普通用户看不到上游真实订阅链接。

---

## 阶段 4：订阅分发接口

任务：

1. 实现 `/sub/:token` 接口。
2. 实现用户状态和有效期判断。
3. 实现 target 参数支持。
4. 实现服务端调用 subconverter。
5. 实现订阅访问日志。
6. 实现订阅接口 Redis 限流。
7. 实现短期缓存。

验收标准：

1. active 用户可以获取订阅。
2. inactive 用户返回未授权提示。
3. expired 用户返回过期提示。
4. disabled 用户返回禁用提示。
5. 停用上游不会出现在订阅中。
6. 用户无法看到上游原始订阅链接。
7. 订阅接口不会因为 Turnstile 导致客户端更新失败。

---

## 阶段 5：用户端页面

任务：

1. 实现用户注册页。
2. 实现用户登录页。
3. 实现我的订阅页。
4. 实现授权码兑换页。
5. 实现使用说明页。
6. 实现修改密码页。
7. 实现响应式适配。

验收标准：

1. 手机浏览器可完整使用注册、登录、兑换、复制订阅链接。
2. PC 浏览器布局正常。
3. 我的订阅页状态显示正确。
4. 复制订阅链接可用。
5. 教程页面可读性良好。

---

## 阶段 6：轮换管理

任务：

1. 实现手动轮换页面。
2. 实现轮换二次确认。
3. 实现订阅版本号。
4. 实现轮换日志。
5. 实现影响用户统计。

验收标准：

1. 管理员可以手动执行轮换。
2. 轮换成功后版本号更新。
3. 轮换失败不覆盖旧版本。
4. 日志记录轮换原因、时间、结果。
5. 有效用户可在轮换后更新订阅获得最新节点。

---

## 阶段 7：系统设置与日志

任务：

1. 实现系统设置页面。
2. 实现安全设置页面。
3. 实现登录日志。
4. 实现授权码使用日志。
5. 实现订阅访问日志。
6. 实现日志筛选。

验收标准：

1. 管理员可配置站点域名、转换后端、Turnstile key。
2. 管理员可配置注册开关和限流规则。
3. 日志可用于排查用户无法登录、无法兑换、无法获取订阅的问题。

---

## 阶段 8：部署上线

任务：

1. 编写生产 docker-compose.yml。
2. 编写 NAS 本地部署 docker-compose 文件。
3. 配置 HTTPS 域名。
4. 配置 Caddy/Nginx 反向代理。
5. 配置 MongoDB 数据卷。
6. 配置 Redis 数据卷或内存模式。
7. 配置自动重启。
8. 配置备份脚本。
9. 编写部署文档。

验收标准：

1. NAS 本地环境可通过 `http://192.168.10.3:8084` 访问。
2. 美国服务器可以正常部署系统。
3. 正式环境 HTTPS 可访问。
4. 管理端可登录。
5. 用户端可注册、登录、兑换授权码。
6. 订阅链接可被 Clash/Mihomo 正常拉取。
7. 服务器重启后服务自动恢复。
8. MongoDB 数据不会因容器重建丢失。

---

## 13. 第一版最终验收清单

### 13.1 管理端

- [ ] 管理员可登录。
- [ ] 管理员可管理用户。
- [ ] 管理员可生成授权码。
- [ ] 管理员可维护上游订阅。
- [ ] 管理员可手动轮换。
- [ ] 管理员可查看基础日志。
- [ ] 管理员可配置 Turnstile 和转换后端。

### 13.2 用户端

- [ ] 用户可注册。
- [ ] 用户可登录。
- [ ] 用户可兑换授权码。
- [ ] 用户可查看到期时间。
- [ ] 用户可复制专属订阅链接。
- [ ] 用户可查看使用说明。
- [ ] 手机和电脑浏览器均可正常使用。

### 13.3 安全

- [ ] 注册接入 Turnstile。
- [ ] 登录接入 Turnstile。
- [ ] 授权码兑换接入 Turnstile。
- [ ] 订阅接口不接入 Turnstile。
- [ ] 订阅接口有限流。
- [ ] 密码哈希保存。
- [ ] 上游订阅链接不暴露给用户。
- [ ] 本地 NAS 可通过 `192.168.10.3:8084` 访问，正式环境 HTTPS 正常。

### 13.4 订阅

- [ ] 有效用户可以获取订阅。
- [ ] 过期用户无法获取有效订阅。
- [ ] 停用上游不会出现在订阅内容中。
- [ ] 多个上游可聚合输出。
- [ ] Clash/Mihomo 格式可用。
- [ ] 至少支持一种其他格式，如 sing-box 或 V2Ray。

---

## 14. 推荐开发顺序

1. 搭建项目和 Docker 环境。
2. 完成管理员登录。
3. 完成用户注册登录和 Turnstile。
4. 完成用户管理和授权码兑换。
5. 完成上游订阅管理。
6. 完成 `/sub/:token` 订阅接口。
7. 完成用户端我的订阅页面。
8. 完成手动轮换。
9. 完成安全设置和日志。
10. 先部署到 NAS `192.168.10.3:8084` 测试，再部署到美国服务器并测试 HTTPS。
11. 每个里程碑测试通过后，提交并上传到 GitHub 仓库 `GooFeng100/subscription_manager`。

---

## 15. 后续可扩展方向

后续版本可考虑：

1. 自建 subconverter 容器。
2. Playwright 自动重新鉴权。
3. 邮件通知用户轮换后更新订阅。
4. Telegram Bot 通知管理员轮换失败。
5. PWA 移动端体验优化。
6. 多管理员权限。
7. 授权码批量导出。
8. 上游节点基础连通性检测。
9. 自动备份到远程服务器。
10. 支持邀请码注册。

---

## 16. 给开发者 / Codex 的总提示词

请开发一个全新的“订阅聚合授权分发系统”，不要整合到现有 mail-code 项目。

系统本地开发部署在 NAS `192.168.10.3`，正式上线部署在美国服务器。不承担代理中转流量，只负责用户注册、一次性授权码、上游订阅管理、订阅聚合、订阅分发和手动轮换。

项目包含项目级 skill：`.codex/skills/subscription-manager-project/SKILL.md`。后续编程必须遵循该 skill、本任务书和当前里程碑验收标准。

技术栈：

```text
前端：Vue 3 + Vite + TypeScript + Pinia + Vue Router
后端：Node.js + TypeScript + Express
数据库：MongoDB
缓存：Redis
部署：Docker Compose + Caddy/Nginx；本地 NAS 使用 `http://192.168.10.3:8084`，正式上线使用 HTTPS 域名
安全：Cloudflare Turnstile + Redis 限流
认证：Cookie Session
```

管理端页面：

```text
1. 管理员登录
2. 用户管理
3. 授权码管理
4. 上游订阅管理
5. 轮换管理
6. 系统设置 / 安全设置
7. 日志记录
```

用户端页面：

```text
1. 注册
2. 登录
3. 我的订阅
4. 授权码兑换
5. 使用说明
6. 修改密码
```

第一版必须实现：

```text
用户自行注册
Cloudflare Turnstile 防自动化
一次性授权码兑换
用户专属订阅 token
/sub/:token 订阅接口
上游 A/B/C 订阅管理
服务端调用 subconverter
手动轮换
Redis 限流
NAS 本地部署与正式 HTTPS 部署
里程碑测试通过后上传 GitHub 仓库 GooFeng100/subscription_manager
```

第一版不要实现：

```text
在线支付
代理中转服务器
真实流量统计
Playwright 自动重新鉴权
复杂仪表盘
工单系统
多管理员权限
```

UI 要求：

```text
简洁中文界面
管理端以表格和弹窗为主
用户端移动优先，兼容 PC Web
不做复杂图表
复制订阅链接必须方便
状态显示清晰
```
