# TASK_STATE

## Date

2026-06-01

## Round Goal

执行 `UI_REPLICATION_PLAN.md` 阶段 B：完成 `/login` + `/register` UI 复刻首版，并通过构建与接口验收。

## Project Current Status

- 项目目录：`/vol1/1000/docker/subscription_manager`
- 本轮已完成统一登录页与注册页改造（前端）。
- 未修改后端业务逻辑，未重建容器。

## Stitch Read Status (This Round)

项目：`SubHub Management System`（`projects/3146590146845636196`）

本轮关联页面：

- `统一登录页 /login`（DESKTOP）
- `注册页面 /register`（DESKTOP）

备注：

- Stitch 列表中未单独标注 `/login` 与 `/register` 的 MOBILE screen；本轮按统一设计语言做响应式适配（移动端单列、桌面端居中）。

## Completed Pages (Stage B)

- `/login`
- `/register`

## Behavior Completed

- 全系统仍只保留一个登录入口：`/login`。
- 未创建 `/admin/login`。
- 登录页支持统一登录流程：优先尝试用户登录，失败后尝试管理员登录；登录成功后通过 `/api/auth/me` 的 `dashboard` 字段自动分流。
- 注册成功后自动跳转 `/login`。
- 登录/注册页面已做移动端单列 + 桌面端居中布局。

## File Changes In This Round

- Updated: `frontend/src/App.vue`
- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `frontend/src/pages/RegisterPage.vue`
- Added: `frontend/src/components/auth/AuthLayout.vue`
- Added: `frontend/src/components/ui/FormField.vue`
- Added: `frontend/src/components/ui/LoadingButton.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `mcp__stitch.list_screens(projectId=3146590146845636196)`
- `npm install --prefix frontend`
- `npm run build --prefix frontend`
- `curl -i http://127.0.0.1:8084/`
- `curl -i http://127.0.0.1:8084/health`
- `curl -i http://127.0.0.1:8084/config`
- `docker compose ps`

## Build Result

- `npm run build --prefix frontend`：成功
- 初次失败原因为 `vue-tsc: not found`，安装前端依赖后已成功。

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)
- 仍有 compose 文件重复命名 warning（非阻塞）。

## API/Interface Check Result

- `GET /`：`200 OK`
- `GET /health`：`200 OK`，mongo/redis 连接正常
- `GET /config`：`200 OK`

## UI Replication Differences / Gaps

- 本轮只完成阶段 B（登录/注册），尚未进入用户端与管理端页面复刻。
- Stitch 未显式提供 `/login` 与 `/register` 独立移动端稿；当前实现为同一页面响应式复刻。

## Next Step And Blockers

下一步建议：

1. 进入阶段 C：`/dashboard`、`/redeem`、`/password`、`/help` 及 `UserMobileLayout`。
2. 在阶段 C 中补充 `CopyButton` 组件与 `target` 切换逻辑（clash/mihomo/sing-box/v2ray/shadowrocket）。

阻塞项：

- 阶段 C 设计稿中 `/password`、`/help` 仍未在 Stitch 标题里明确出现，如需严格一比一复刻，可先补齐 Stitch screen。

## Stage C Precheck (Latest)

- 已通过 Stitch MCP 复查 `SubHub Management System` 页面。
- 可用于阶段 C 的页面：
  - `我的订阅 (移动端) /dashboard`
  - `兑换授权码 (移动端) /redeem`
- 阶段 C 缺失页面（未检出）：
  - `/password`（移动端）
  - `/help`（移动端）
- 按 `docs/UI_REPLICATION_PLAN.md` 阶段 C 规则，缺失即暂停当前页面复刻，不凭空猜测设计。

## Stage D Progress (Admin Web First)

### Round Goal

先行完成管理端 Web 布局与首批模块页面骨架，并接入基础列表接口：

- `/admin/users`
- `/admin/codes`
- `/admin/upstreams`

### Completed

- 新增 `AdminLayout`（左侧菜单 + 顶栏 + 内容区）。
- 新增管理端三页并接入接口：
  - 用户列表：`GET /api/admin/users`
  - 授权码列表：`GET /api/admin/codes`
  - 上游列表：`GET /api/admin/upstreams`
- 补齐管理端路由占位页：
  - `/admin/rotation`
  - `/admin/settings`
  - `/admin/logs`
- 调整 `App.vue`：管理路由下不显示旧的用户端顶部导航。

### File Changes

- Added: `frontend/src/components/admin/AdminLayout.vue`
- Added: `frontend/src/pages/AdminUsersPage.vue`
- Added: `frontend/src/pages/AdminCodesPage.vue`
- Added: `frontend/src/pages/AdminUpstreamsPage.vue`
- Added: `frontend/src/pages/AdminRotationPage.vue`
- Added: `frontend/src/pages/AdminSettingsPage.vue`
- Added: `frontend/src/pages/AdminLogsPage.vue`
- Updated: `frontend/src/router/index.ts`
- Updated: `frontend/src/App.vue`
- Updated: `docs/TASK_STATE.md`

### Commands Executed

- `npm run build --prefix frontend`

### Build Result

- Frontend build: success.

### Docker Status

- 本轮未重建容器、未执行 `docker compose up`。

### API Status

- 管理端列表页面已接接口调用；鉴权失败会在页面显示错误文案。

### Next Step

1. 按 Stitch 继续细化管理端视觉（表格、状态标签、弹窗）。
2. 先完成 `/admin/users` 的详情/续期/重置 token/删除交互弹窗。

## Admin Users UI Optimization (Mock First)

### Round Goal

先为 `/admin/users` 注入 6 条演示用户数据并优化表格视觉，便于先验界面。

### Completed

- `/admin/users` 页面新增 6 条虚拟用户数据（仅前端演示数据）。
- 真实接口有数据时优先展示接口数据；接口失败或空列表时自动回退到演示数据。
- 优化用户表格：
  - 状态 Tag 颜色
  - token 脱敏显示
  - 操作按钮列（详情/续期/重置/删除）
  - 横向滚动容器

### File Changes

- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Build Result

- `npm run build --prefix frontend`: success

### Notes

- 本轮未改后端业务逻辑，虚拟用户仅用于前端展示与布局联调。

## Admin Users Date + Filter Update

- `/admin/users` 的“到期日/实际失效日”改为仅显示日期（`YYYY-MM-DD`）。
- 在标题区上方新增筛选栏：用户名、联系方式、状态、重置。
- 备注：当前已完成前端展示层；后端持久化模型仍为 `Date` 精度，后续若需要“仅日期存储”将单独执行数据模型迁移。

## Admin Codes UI (Consistent With Users)

- `/admin/codes` 已按 `/admin/users` 同风格完成首版：标题区 + 筛选栏 + 表格 + 操作区。
- 已接入真实接口 `GET /api/admin/codes`；接口失败或空列表时回退 6 条演示数据。
- 已实现状态中文与颜色：`unused/used/revoked` -> `未使用/已使用/已作废`。
- 顶部右侧新增“生成授权码”按钮位（本轮先展示样式，弹窗在下一步实现）。

## Admin Codes Modal Polish (Stitch-aligned)

- 已按 Stitch `/admin/codes` Modal 视觉优化“生成授权码”弹窗：
  - 顶部标题栏 + 关闭按钮
  - 数量输入占位提示
  - 授权天数快捷按钮（30/90/180/365/自定义）
  - 备注多行输入
  - 底部操作栏（取消 / 确认生成）
  - 遮罩与层级样式优化
- 兼容现有生成逻辑：接口优先，失败回退本地演示生成。

## Admin Users Modals Implemented (View/Edit/Add)

- 已按 Stitch 读取结果在 `/admin/users` 落地 3 个弹窗：
  - 查看用户弹窗（View Modal）
  - 编辑用户弹窗（Edit Modal）
  - 新增用户弹窗（Add Modal）
- 已接入按钮行为：
  - `增加用户` -> 打开新增弹窗
  - `查看` -> 打开详情弹窗
  - `修改` -> 打开编辑弹窗并可保存到当前列表（前端演示层）
- 保持现有 users 页风格与表格布局一致。

## Unified Username/Password Validation (Frontend + Backend)

统一规则已落地：
- `username`：字母开头，仅字母+数字，长度 `>=8`
- `password`：长度 `>=8`

已改动：
- 后端：`backend/src/routes/auth.ts`
  - `register` / `login` / `admin/login` 使用统一 `usernameSchema + password` 校验
- 前端：
  - `frontend/src/lib/validators.ts` 新增统一校验函数
  - `frontend/src/pages/RegisterPage.vue` 注册校验
  - `frontend/src/pages/LoginPage.vue` 登录校验
  - `frontend/src/pages/AdminUsersPage.vue` 新增用户、编辑用户校验（含错误提示）

验证：
- `npm run build --prefix frontend`：通过
- `npm run build --prefix backend`：当前环境缺少 `tsc`（`tsc: not found`），未完成后端本地构建验证

## Admin Users View Modal (Stitch Replica, No Created/Login IP)

### Goal
- 复刻 `/admin/users` 查看用户弹窗（Stitch 风格），并按要求去掉“创建日期、最近登录IP”。

### Completed
- 已调整查看用户弹窗为紧凑宽度和 Stitch 风格信息卡片布局。
- 保留字段：用户名、状态、到期时间、实际失效时间、订阅 Token（含“复制订阅链接”按钮）、备注。
- 明确移除字段：创建日期、最近登录IP（本弹窗不渲染）。
- 统一 Token 复制按钮视觉（系统色背景 + 白字 + hover）。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

### Docker/Container Status
- 本轮未执行容器变更命令，未重建容器。

### API/Interface Status
- 本轮为前端 UI 复刻，不涉及后端接口变更。

### Next
- 按你下一条指令继续处理 `/admin/users` 编辑弹窗与新增弹窗细节对齐（Stitch）。

## Admin Users View Modal Layout Adjustment

### Completed
- 查看用户弹窗布局调整：
  - 第一行改为“用户名 | 联系方式”。
  - “状态”改到 `订阅 Token` 下方，并仅以胶囊状态展示。
  - “备注”保持在最下方。
- 其余字段和按钮行为不变。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users Note Field Alignment

### Completed
- 查看用户弹窗“备注”改为仅显示 `note` 字段，不再复用联系方式。
- 用户列表新增“备注”列，位置在“订阅token”和“操作区”之间。
- 新增用户时会把备注写入本地列表数据（演示数据链路）。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users View Modal Token Action Removed

### Completed
- 查看用户弹窗已移除“复制订阅链接”按钮。
- 订阅 Token 区域保留纯展示，不含操作按钮。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users Edit Modal Refactor (Reuse View Layout)

### Completed
- 编辑用户弹窗改为复用“查看用户”同款布局。
- 字段权限按要求调整：
  - 用户名：只读不可修改
  - 密码：新增可选输入（留空不改；输入则校验至少8位）
  - 订阅 Token：只读文本框 + `重置` 按钮
  - 状态：只读胶囊，不可修改
  - 备注：可修改
- 联系方式/到期时间/实际失效时间在编辑弹窗中只读展示。
- 保存时仅更新允许变更字段（备注、token；密码仅做有效性校验链路）。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users Edit Modal Focus & Editable Field Rules

### Completed
- 用户名、订阅Token改为纯展示块，不可输入、不可获得焦点。
- 可编辑字段改为正常输入控件（白底可聚焦）：密码、联系方式、到期日、备注。
- 保存逻辑同步更新：可保存联系方式、到期日、备注；到期日变更时自动按轮换天数重算实际失效日。
- 状态仍保持胶囊只读展示。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users Edit Modal Token Action Constraint

### Completed
- 编辑弹窗中 Token 展示区保持只读展示，不绑定任何重置行为。
- 仅保留“重置”按钮可触发 token 重置。
- 已移除编辑弹窗“实际失效时间”字段（由系统自动判定）。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users Edit Modal Token Misclick Fix

### Completed
- 编辑弹窗 token 区块容器由 `label` 改为普通 `div`，避免点击标签区域转发触发按钮。
- 重置按钮事件增加 `@click.stop`，确保仅按钮点击触发重置。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users Delete Confirm Modal

### Completed
- `/admin/users` 增加删除确认弹窗。
- 操作区“删除”由直接删除改为：打开弹窗 -> `确认删除` 才执行。
- 弹窗提供关闭/取消/确认删除三种关闭路径。
- 顺带修复演示数据重复 `mock-5` 项，避免表格渲染 key 冲突。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Users Delete Modal Unified With Codes

### Completed
- `/admin/users` 删除弹窗结构已统一为 `/admin/codes` 同款：
  - `modal-content`（标题 + 提示文案）
  - `modal-actions`（取消 / 确认）
- 移除 users 删除弹窗的独立标题栏和额外背景样式，避免视觉偏差。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Stage D Next UI: Admin Upstreams Completed (First Full Replica)

### Round Goal
- 进入下一阶段 UI 任务：完成 `/admin/upstreams` 视觉与交互首版，风格统一到 `/admin/users`、`/admin/codes`。

### Completed
- `/admin/upstreams` 从基础表格升级为管理端完整页面：
  - 标题区 + 演示数据标记
  - 筛选栏（上游名称、状态）
  - 表格列（编号、名称、状态、URL、最后测试、更新时间、操作区）
  - 状态胶囊（启用/禁用）
  - 操作区（测试、修改、启用/禁用、删除）
- 新增上游/编辑上游弹窗（同站内管理端弹窗风格）。
- 新增删除确认弹窗（与 codes 确认弹窗布局一致）。
- 数据读取策略：真实接口优先，失败或空数据时回退演示数据。

### File Changes
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

### Notes
- 本轮仅前端 UI 与页面交互层，不修改后端业务逻辑。

## Stage D Next UI: Admin Rotation Completed (First Full Replica)

### Round Goal
- 继续下一阶段 UI：完成 `/admin/rotation` 的管理端正式页面复刻。

### Completed
- `/admin/rotation` 从旧简版嵌套页升级为独立管理页：
  - 顶部信息区 + 状态卡（当前版本/有效用户/启用上游）
  - 手动轮换执行区（原因、确认口令、刷新、执行）
  - 结果消息状态（成功/失败）
  - 日志筛选区（原因、结果）
  - 日志表格（版本变更、原因、执行人、影响用户、结果）
- 接口逻辑保留：
  - `GET /api/admin/rotation/status`
  - `GET /api/admin/rotation/logs`
  - `POST /api/admin/rotation/execute`
- 接口失败时自动回退演示数据，保证 UI 可演示。

### File Changes
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

### Next
- 下一页建议：`/admin/settings`（系统设置）正式 UI 复刻与分组化表单。

## Rotation Version Rule Change: Monthly Sequence (YY.M.N)

### Round Goal
- 将轮换版本号规则改为“当月第几版”：`YY.M.N`（例如 `26.5.2`）。

### Completed
- 后端 `rotation` 版本逻辑已改为月内递增：
  - 当前版本存储值改为字符串格式 `YY.M.N`。
  - 同月执行轮换：`N + 1`。
  - 跨月首次执行轮换：重置为 `N = 1`。
  - 状态接口若无历史值：初始化为当月 `YY.M.0`。
- 轮换日志字段同步改为字符串版本：
  - `from_version: string`
  - `to_version: string | null`
- 前端轮换页面类型与展示同步：
  - 不再按数字版本渲染，直接展示 `YY.M.N`。

### File Changes
- Updated: `backend/src/routes/stage6.ts`
- Updated: `backend/src/lib/db.ts`
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `frontend/src/pages/RotationPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success
- `npm run build --prefix backend` -> failed (`tsc: not found` in current environment)

### Notes
- 后端构建失败原因为环境依赖缺失，不是本轮规则改造导致的编译错误信息。

## Admin Rotation: Manual/Schedule Tabs Added

### Completed
- `/admin/rotation` 增加标签页切换：
  - `手动轮换`
  - `定时轮换`
- 新增“定时轮换列表”区：
  - 列：计划编号、计划名称、执行周期、下次执行、状态、备注、操作区
  - 操作：启用/停用、删除
- 新增“新增定时轮换”弹窗：
  - 字段：计划名称、执行周期描述、下次执行日期、备注
- 保留原手动轮换与日志模块，切换到手动标签页时展示。

### File Changes
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Rotation Layout Update (Tabs/Switch Area/Logs)

### Completed
- `/admin/rotation` 页面结构调整为：
  - 版本状态卡
  - 标签页（手动轮换 / 定时轮换）
  - 轮换区域（随标签切换）
  - 轮换日志（固定最下方，始终显示）
- 标签页切换仅影响轮换区域，不影响日志区域显示。

### File Changes
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Rotation Schedule Modals (Aligned With Codes)

### Completed
- 定时轮换新增计划弹窗保留并继续使用。
- 定时轮换删除操作改为确认弹窗流程（与 codes 的确认弹窗交互一致）：
  - 点击删除 -> 打开确认弹窗
  - 点击确认 -> 执行删除
- 删除不再直接执行，避免误删。

### File Changes
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Rotation Schedule Interval Modes

### Completed
- 定时轮换“新增计划”支持两种时间间隔配置：
  - 每天固定几点
  - 每月几号几点
- 弹窗新增字段：执行模式、每月日期（按模式显示）、小时、分钟。
- 新增计划时自动生成“执行周期”文案与“下次执行”展示时间。

### File Changes
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Stage D Next UI: Admin Settings Completed (First Full Replica)

### Round Goal
- 继续下一阶段 UI：完成 `/admin/settings` 正式管理端页面。

### Completed
- `/admin/settings` 完成分组化设置页面：
  - 基础开关（注册、Turnstile 总开关及分场景开关）
  - 订阅与限流（converter 地址、域名、限流、缓存）
  - 登录/注册风控（失败阈值、锁定时长、IP窗口）
  - Turnstile 密钥（site/secret）
- 增加页面底部统一操作区：重新加载 / 保存设置。
- 接口联调：
  - 读取 `GET /api/admin/settings`
  - 保存 `PUT /api/admin/settings`
- 保存前对数值类字段做最小值兜底（>=1）。

### File Changes
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Settings UI Rework (Stitch-style Section Tabs)

### Completed
- `/admin/settings` 按 Stitch 系统设置风格重排为“分区标签 + 卡片表单”结构。
- 新增设置分区标签：
  - 基础设置
  - 安全策略
  - Turnstile
- 保留原接口联调与保存逻辑：
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings`
- 底部固定操作区保持：重新加载 / 保存设置 + 状态反馈。

### File Changes
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Settings: Readonly Domain + Help Texts

### Completed
- 基础设置中的“站点域名”改为只读文本框展示。
- 保存时不再提交 `site_domain`（避免误改环境驱动配置）。
- 增加说明文案：
  - 站点域名：环境变量/网关驱动，仅展示
  - 订阅缓存：缓存命中含义
  - 订阅限流：访问频率限制含义

### File Changes
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Settings Single-Page Merge

### Completed
- 系统设置由“分区标签切换”改为“单页三分区连续展示”。
- 三块内容（基础设置 / 安全策略 / Turnstile）整合在同一页。
- 底部统一操作区（重新加载、保存设置）保持不变。

### File Changes
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Settings Unified Item Size + Full Help Texts

### Completed
- 开关类设置项改为与输入项一致的设置块结构（标题 + 控件 + 底部说明）。
- “允许用户注册”不再使用大块独立样式，尺寸与其他设置项保持一致。
- 为系统设置页每个字段补充底部说明文案（基础设置 / 安全策略 / Turnstile 全覆盖）。

### File Changes
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Settings Frontend Validation

### Completed
- 系统设置输入框增加前端校验与错误提示（红框 + 错误文案）。
- 保存前统一校验：
  - converter 地址必须为 http/https
  - 数值项必须为正整数且在合理范围
  - Turnstile 任一开关启用时，site/secret key 不能为空
- 聚焦输入框时清除对应字段错误。

### File Changes
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Stage D Next UI: Admin Logs Completed (First Full Replica)

### Round Goal
- 进入下一阶段 UI：完成 `/admin/logs` 正式页面（日志类型切换 + 筛选 + 表格）。

### Completed
- `/admin/logs` 新增日志类型页签：
  - 登录日志（`/api/admin/logs/auth`）
  - 授权码日志（`/api/admin/logs/code-usage`）
  - 订阅访问日志（`/api/admin/logs/sub-access`）
- 每类日志配套筛选区和查询按钮。
- 每类日志独立表格展示，含状态 Tag、时间格式化、token 脱敏。
- 首次进入页面默认加载登录日志，切换页签按需加载。

### File Changes
- Updated: `frontend/src/pages/AdminLogsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Logs Filter Simplification

### Completed
- 日志页三类筛选统一为两项：用户名 + 结果。
- 已移除额外筛选项：
  - 登录日志：动作
  - 授权码日志：授权码
  - 订阅访问日志：token、target
- 查询参数同步收敛到简化筛选字段。

### File Changes
- Updated: `frontend/src/pages/AdminLogsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin Logs Mock Data Injection

### Completed
- `/admin/logs` 注入三类演示日志数据（登录/授权码/订阅访问，各 3 条）。
- 行为策略：接口返回空列表或请求失败时，自动回退到演示日志，便于 UI 验收。
- 失败提示文案更新为“已切换演示数据”。

### File Changes
- Updated: `frontend/src/pages/AdminLogsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin UI Polish Round 1 (Global Consistency)

### Completed
- 管理端全局细节收尾（样式一致性第一轮）：
  - 统一筛选按钮最小宽度与 hover 态（`upstreams/rotation/logs`）
  - 统一表格悬浮反馈（`logs`）
  - 统一移动端筛选区换行与按钮触达尺寸（`upstreams/logs`）
  - 统一弹窗按钮交互态与新增计划按钮 hover 反馈（`rotation`）
- 保持业务逻辑与接口调用不变，仅样式与交互收敛。

### File Changes
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `frontend/src/pages/AdminLogsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin UI Polish Round 2 (Users/Codes/Settings)

### Completed
- `users` 页面统一收口：
  - 弹窗宽度基线统一为 `58% / max 500 / min 320`
  - 筛选按钮最小宽度统一
  - 移动端筛选区改为单列 + 按钮可点击高度统一
  - 弹窗按钮 hover 态统一（含 focus-ring 风格）
- `codes` 页面统一收口：
  - 筛选按钮最小宽度统一
  - 表格最小宽度基线对齐（1080）
  - 移除中断点下异常弹窗宽度策略，统一移动端全宽弹窗
  - 移动端筛选区改单列
- `settings` 页面细节一致性：
  - 输入控件高度统一（40px）
  - 底部操作按钮高度统一（40px）

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `frontend/src/pages/AdminCodesPage.vue`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin UI Polish Round 3 (Empty States)

### Completed
- 统一管理端空状态展示（表格内空行文案 + 样式一致）：
  - `/admin/users` -> 暂无用户数据
  - `/admin/codes` -> 暂无授权码数据
  - `/admin/upstreams` -> 暂无上游数据
  - `/admin/rotation` -> 暂无定时轮换计划 / 暂无轮换日志
  - `/admin/logs` -> 暂无登录日志 / 暂无授权码日志 / 暂无订阅访问日志
- 空状态样式统一：居中、弱化文案色、统一垂直留白。

### File Changes
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `frontend/src/pages/AdminCodesPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `frontend/src/pages/AdminLogsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Admin UI Polish Round 4 (Logs Loading State)

### Completed
- `/admin/logs` 新增统一加载态：
  - 查询按钮支持 `查询中...` 文案与禁用态
  - 表格加载中占位行（`加载中...`）
  - 加载结束后再显示空状态文案
- 三类日志（登录/授权码/订阅访问）全部接入加载态。

### File Changes
- Updated: `frontend/src/pages/AdminLogsPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands
- `npm run build --prefix frontend` -> success

## Milestone Closure Report (UI + Integration Snapshot)

### Completed Feature Map
- 认证与入口：
  - `/login` 统一登录页（无 `/admin/login`）
  - `/register` 统一注册页
- 管理端页面：
  - `/admin/users`：筛选、状态胶囊、到期/失效日显示、查看/编辑/新增/删除弹窗、token 重置
  - `/admin/codes`：授权码列表、生成弹窗、成功弹窗、作废/删除确认弹窗
  - `/admin/upstreams`：列表、状态切换、测试、新增/编辑、删除确认
  - `/admin/rotation`：手动轮换 + 定时轮换标签、计划新增/删除弹窗、轮换日志固定区
  - `/admin/settings`：单页三分区（基础/安全/Turnstile），只读域名，说明文案，前端校验
  - `/admin/logs`：登录/授权码/订阅访问日志切换、统一筛选、加载态、空状态、演示数据回退

### UI Consistency Status
- 已完成多轮全局收尾：
  - 筛选栏按钮尺寸与 hover 态统一
  - 表格空状态文案与样式统一
  - 弹窗响应式策略与按钮交互态统一
  - 移动端筛选区换行策略统一

### Runtime & Port Info
- 对外入口：`http://<NAS_IP>:8084`
- 反向代理：`caddy`（8084 -> 80）
- 后端 API：`/api/*`
- 订阅接口：`/sub/*`

### Core API Integration Snapshot
- Settings:
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings`
- Rotation:
  - `GET /api/admin/rotation/status`
  - `GET /api/admin/rotation/logs`
  - `POST /api/admin/rotation/execute`
- Logs:
  - `GET /api/admin/logs/auth`
  - `GET /api/admin/logs/code-usage`
  - `GET /api/admin/logs/sub-access`
- Users/Codes/Upstreams：管理页已接对应读取/操作接口，接口失败时具备演示回退路径（用于 UI 验收）。

### Version Rule Snapshot
- 轮换版本规则已改为 `YY.M.N`（如：`26.5.2`）：
  - 同月执行轮换：`N + 1`
  - 跨月首次执行：`N = 1`

### Validation/Build Snapshot
- Frontend build: `npm run build --prefix frontend` -> success
- Backend build: 当前环境仍存在 `tsc: not found`（环境依赖问题）

### Ready For Next Stage
- 当前已可进入“最终视觉微调 + 真接口联调 + 回归测试”阶段。

## Milestone Continuation Round (Build + Runtime Validation)

### Round Goal
- 按里程碑继续推进：执行前端构建、容器状态与关键入口/健康接口联调检查，确认当前可进入后续功能开发。

### Commands Executed
- `npm run build --prefix frontend`
- `docker compose ps`
- `curl -i http://127.0.0.1:8084/`
- `curl -i http://127.0.0.1:8084/health`
- `curl -i http://127.0.0.1:8084/config`

### Build Status
- Frontend build: success（`vue-tsc -b && vite build` 通过）

### Docker/Container Status
- `subscription-manager-app`: Up
- `subscription-manager-caddy`: Up（`:8084 -> 80`）
- `subscription-manager-mongodb`: Up (healthy)
- `subscription-manager-redis`: Up (healthy)
- `docker compose` 仍提示双配置文件 warning（`compose.yaml` 与 `docker-compose.yml`），当前使用 `compose.yaml`，不影响运行。

### API/Interface Status
- `GET /` -> `200 OK`
- `GET /health` -> `200 OK`（mongo/redis connected）
- `GET /config` -> `200 OK`

### Completion Status
- 当前管理端 UI 已完成阶段可视化收尾并通过基础联调检查，可继续进入下一阶段“真接口回归 + 业务流程测试”。

### Next Step
1. 执行管理端关键流程回归：users/codes/upstreams/rotation/settings/logs（重点验证新增、修改、删除、状态切换、轮换执行）。
2. 清理并确认前端源码中非必要产物文件（如 `*.vue.js`、`*.tsbuildinfo`）是否应纳入版本管理，避免后续提交噪音。
3. 若继续推进后端构建校验，补齐 backend TypeScript 构建依赖（解决 `tsc: not found`）。

## Continuation Round (Frontend Artifact Cleanup)

### Round Goal
- 延续里程碑推进：清理前端源码目录中的误生成编译产物，降低提交噪音并保证构建稳定。

### Completed
- 已删除 `frontend/src` 下误生成的 `*.vue.js/*.js` 文件（保留真实 TypeScript/Vue 源码）。
- 已删除 `frontend/tsconfig.tsbuildinfo`（构建缓存产物，不应作为源码版本内容）。
- 已重新执行前端构建验证，结果通过。

### Commands Executed
- `find frontend/src -type f \( -name '*.vue.js' -o -name 'main.js' -o -name 'index.js' -o -name 'api.js' -o -name 'validators.js' \) -delete`
- `rm -f frontend/tsconfig.tsbuildinfo`
- `npm run build --prefix frontend`

### Build Status
- Frontend build: success

### Docker/Container Status
- 本轮未执行容器重建、未执行 compose up。

### API/Interface Status
- 本轮未新增接口改动，接口行为保持上一轮状态。

### Next Step
1. 继续执行“管理端真接口回归”并逐页完成交互验收（users/codes/upstreams/rotation/settings/logs）。
2. 回归完成后整理一次里程碑报告并准备提交。

## Continuation Round (Admin API Regression Smoke)

### Round Goal
- 继续下一阶段：执行管理端真实接口回归（含鉴权）并确认当前运行态与代码预期一致性。

### Commands Executed
- `curl -i http://127.0.0.1:8084/api/admin/users`
- `curl -i http://127.0.0.1:8084/api/admin/codes`
- `curl -i http://127.0.0.1:8084/api/admin/rotation/status`
- `curl -i http://127.0.0.1:8084/api/admin/settings`
- `curl -c /tmp/subhub.cookies -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123456"}' http://127.0.0.1:8084/api/auth/admin/login`
- `curl -b /tmp/subhub.cookies http://127.0.0.1:8084/api/admin/users`
- `curl -b /tmp/subhub.cookies http://127.0.0.1:8084/api/admin/codes`
- `curl -b /tmp/subhub.cookies http://127.0.0.1:8084/api/admin/rotation/status`
- `curl -b /tmp/subhub.cookies http://127.0.0.1:8084/api/admin/settings`
- `curl -b /tmp/subhub.cookies 'http://127.0.0.1:8084/api/admin/logs/auth?username=admin&result=success&limit=5'`

### Regression Result
- 无会话访问管理接口：均返回 `401 Unauthorized`（符合预期）。
- 管理员登录：`/api/auth/admin/login` 返回 `200` + `Set-Cookie`（成功）。
- 带会话访问管理接口：
  - `/api/admin/users` -> `200`，返回用户列表
  - `/api/admin/codes` -> `200`，返回授权码列表
  - `/api/admin/settings` -> `200`，返回系统设置
  - `/api/admin/logs/auth` -> `200`，筛选可用
  - `/api/admin/rotation/status` -> `200`

### Key Finding
- 运行中 `/api/admin/rotation/status` 仍返回 `sub_version: 2`（number），未体现代码中 `YY.M.N` 字符串规则。
- 判断：后端版本规则改动已在代码中，但当前运行容器尚未加载该变更（运行镜像与工作区代码不一致）。

### Docker/Container Status
- 本轮未执行容器重建、未执行 `docker compose up`（遵循限制）。

### Next Step
1. 在允许时执行后端容器重建/重启以加载最新 `stage6` 版本规则改动，然后复测 `/api/admin/rotation/status` 是否输出 `YY.M.N`。
2. 继续执行管理端写操作回归（新增/编辑/删除/作废/重置）并记录接口请求与结果。

## Continuation Round (Write-Path Regression + Consistency Fix)

### Round Goal
- 继续推进：执行管理端关键写操作回归（upstreams/codes/users/rotation/settings），并修复回归中发现的后端一致性问题。

### Commands Executed
- `curl -c /tmp/subhub.cookies -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123456"}' /api/auth/admin/login`
- Upstreams 回归：
  - `POST /api/admin/upstreams`
  - `PATCH /api/admin/upstreams/:id`
  - `POST /api/admin/upstreams/:id/disable`
  - `POST /api/admin/upstreams/:id/enable`
  - `DELETE /api/admin/upstreams/:id`
- Codes 回归：
  - `POST /api/admin/codes`
  - `POST /api/admin/codes/:id/revoke`
  - `DELETE /api/admin/codes/:id`
- Users 回归：
  - `PATCH /api/admin/users/:id/status`（disabled/inactive）
  - `POST /api/admin/users/:id/renew`
- Rotation 回归：
  - `POST /api/admin/rotation/execute`
- Settings 回归：
  - `PUT /api/admin/settings`（`register_ip_limit` +1 后回滚）
- 一致性验证：
  - 对 `used` 授权码执行 revoke/delete

### Regression Result
- `upstreams`：新增、编辑、启停、删除全通过。
- `codes`：新增、作废、删除（unused/revoked）通过。
- `users`：状态切换与手动续期通过。
- `rotation execute`：通过（运行态返回 `from_version:2 -> to_version:3`）。
- `settings`：更新与回滚通过。

### Key Finding
- 运行态后端中：`used` 授权码 `revoke` 正确返回 `409`，但 `delete` 仍可成功（与“已使用不可删除”规则不一致）。

### Fix Applied (Code)
- 已修复 `backend/src/routes/stage2.ts`：
  - `DELETE /admin/codes/:id` 先查询码状态；当 `status === used` 时返回 `409 Used code cannot be deleted`。
  - 仅允许删除非 used 的授权码。

### Build/Validation
- `npm run build --prefix frontend`：success。
- `npm run build --prefix backend`：失败（环境缺少 `tsc`，`tsc: not found`）。
- 说明：后端修复代码已写入工作区，但当前运行容器未重建，接口运行态尚未加载该修复。

### Repo Hygiene
- 再次清理误生成文件：`frontend/src/*.vue.js`、`frontend/src/*.js`、`frontend/tsconfig.tsbuildinfo`。
- 现象：执行前端 build 后这批文件会被再次产出，后续需专门修正前端构建配置，避免重复噪音。

### Next Step
1. 在允许时重建后端镜像/容器，使 `codes delete guard` 与 `YY.M.N` 版本规则生效。
2. 继续做一轮“前端真实交互 + 后端接口响应一致性”联调（重点 users/codes 弹窗流程）。
3. 修正前端构建配置，阻止 `src` 目录生成 `*.vue.js/*.js` 产物。

## Continuation Round (Frontend Build Artifact Root-Cause Fix)

### Round Goal
- 解决前端构建后在 `src` 目录产生 `*.vue.js/*.js` 污染问题，避免后续提交噪音与误追踪。

### Root Cause
- `frontend/tsconfig.json` 未设置 `noEmit`，`vue-tsc -b` 在构建模式下会产生编译输出到源码目录。

### Fix Applied
- Updated: `frontend/tsconfig.json`
  - `compilerOptions.noEmit = true`

### Validation
- 清理旧产物后执行：`npm run build --prefix frontend` -> success。
- 构建后再次检查 `frontend/src`：未再生成 `*.vue.js/*.js`。

### Docker/Container Status
- 本轮未重建容器，未执行 `docker compose up`。

### Next Step
1. 等你允许后重建后端容器，使 `stage2` 删除保护与 `stage6` 版本规则更新进入运行态。
2. 继续补齐接口级回归脚本（可沉淀为 `scripts/regression-admin.sh`）。

## Continuation Round (Backend Rebuild + Runtime Verification)

### Round Goal
- 将后端最新代码（admin 登录校验修复、used 授权码删除保护、rotation 版本规则）加载到运行容器并做运行态复测。

### Commands Executed
- `docker compose build app`
- `docker compose up -d --force-recreate app`
- `docker compose ps`
- `curl -c /tmp/subhub.cookies -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123456"}' /api/auth/admin/login`
- `curl -b /tmp/subhub.cookies /api/auth/me`
- `curl -b /tmp/subhub.cookies /api/admin/rotation/status`
- `curl -b /tmp/subhub.cookies /api/admin/codes?status=used&limit=1`
- `curl -b /tmp/subhub.cookies -X DELETE /api/admin/codes/:id`
- `curl -i /health`

### Runtime Status
- `subscription-manager-app` 已重建并重新创建，状态 `Up`。
- `mongodb/redis/caddy` 保持运行。

### Verification Result
- `POST /api/auth/admin/login`：`200`，管理员登录恢复正常。
- `GET /api/auth/me`：返回 `{"userType":"admin","dashboard":"/admin"}`。
- `GET /api/admin/rotation/status`：返回字符串版本号 `26.6.3`，`YY.M.N` 规则生效。
- `DELETE /api/admin/codes/:usedId`：返回 `409 Used code cannot be deleted`，删除保护生效。
- `GET /health`：`200`，mongo/redis connected。

### Issue Fixed In This Round
- 修复了上轮引入的回归：`/admin/login` 不应套用用户用户名长度规则（`admin` 被错误拦截）。

### Next Step
1. 继续执行前端管理端实机流程回归（users/codes/upstreams/rotation/settings/logs）并逐项对照 UI 与接口结果。
2. 收口本阶段变更，准备里程碑提交报告。

## Continuation Round (Full Admin Regression - Pass)

### Round Goal
- 继续管理端全链路回归：logs 查询、settings 校验边界、upstream 测试、rotation 执行与版本推进。

### Commands Executed
- `POST /api/auth/admin/login`
- `GET /api/admin/logs/auth?limit=5&username=admin&success=true`
- `GET /api/admin/logs/code-usage?limit=5&status=used`
- `GET /api/admin/logs/sub-access?limit=5`
- `PUT /api/admin/settings`（无效值 `sub_rate_limit_per_minute=0`）
- `POST /api/admin/upstreams/:id/test`
- `POST /api/admin/rotation/execute`
- `GET /api/admin/rotation/logs`
- `GET /api/admin/rotation/status`
- 串行一致性确认：`status -> execute -> status`
- `npm run build --prefix frontend`

### Regression Result
- Logs 三类查询均可返回并支持筛选。
- Settings 边界校验有效：无效 payload 返回 `400 Invalid settings payload`。
- Upstream 测试接口行为正常：上游 URL 返回 404 时，接口返回 `400 upstream test failed`。
- Rotation 手动执行成功，版本按规则连续推进：
  - `26.6.4 -> 26.6.5`（串行验证）
- Frontend 构建通过。

### Notes
- `rotation/logs` 中历史记录仍包含旧数字版本（早期数据），新执行记录已使用字符串版本规则。

### Docker/Container Status
- 本轮未再次重建容器，沿用上一轮已生效运行态。

### Next Step
1. 进入收口：整理本阶段变更清单并提交里程碑报告。
2. 如需，我可继续执行一次“前端逐页面人工验收清单”对照（users/codes/upstreams/rotation/settings/logs）。

## Milestone Closure Round (Ready-To-Commit Check)

### Round Goal
- 完成本阶段收口：输出可提交前检查结果（变更清单 + 构建 + 运行健康）。

### Changed Files Snapshot
- Backend:
  - `backend/src/routes/auth.ts`
  - `backend/src/routes/stage2.ts`
  - `backend/src/routes/stage6.ts`
  - `backend/src/lib/db.ts`
- Frontend:
  - `frontend/src/App.vue`
  - `frontend/src/router/index.ts`
  - `frontend/src/pages/LoginPage.vue`
  - `frontend/src/pages/RegisterPage.vue`
  - `frontend/src/pages/RotationPage.vue`
  - `frontend/src/pages/AdminUsersPage.vue`
  - `frontend/src/pages/AdminCodesPage.vue`
  - `frontend/src/pages/AdminUpstreamsPage.vue`
  - `frontend/src/pages/AdminRotationPage.vue`
  - `frontend/src/pages/AdminSettingsPage.vue`
  - `frontend/src/pages/AdminLogsPage.vue`
  - `frontend/src/components/*`
  - `frontend/tsconfig.json`
- Docs:
  - `docs/TASK_STATE.md`
  - `UI_REPLICATION_PLAN.md`

### Validation
- `npm run build --prefix frontend` -> success。
- `GET /health` -> `200`（mongo/redis connected）。
- `docker compose ps` -> app/caddy/mongodb/redis 全部 `Up`（db/cache healthy）。

### Runtime Critical Checks (Already Verified)
- 管理员登录可用（修复 admin 用户名校验回归）。
- rotation 版本规则运行态生效（`YY.M.N`）。
- used 授权码删除保护运行态生效（`409 Used code cannot be deleted`）。

### Current Status
- 当前代码与运行环境已完成本阶段目标，处于“可提交”状态。

### Next Step
1. 执行 `git add/commit`（按里程碑说明写提交信息）。
2. 推送远端并输出里程碑报告。
