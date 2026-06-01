# 订阅分发管理系统 Stitch UI 复刻计划与验收步骤书

> 文件用途：  
> 本文档用于交给 Codex 在 NAS 项目中逐步读取、复刻 Stitch UI，并按阶段完成构建、容器检查、接口联调和验收。  
> 新开 Codex 线程时，只需让 Codex 先读取本文件、`AGENTS.md`、`docs/TASK_STATE.md`，即可继续上一次 UI 复刻任务。

---

## 0. 项目基本信息

### 0.1 项目名称

订阅分发管理系统

### 0.2 项目目录

```bash
/vol1/1000/docker/subscription_manager
```

### 0.3 当前运行环境

```text
NAS 主机：ZXHome
项目入口：http://192.168.10.3:8084
对外端口：8084 -> caddy:80

容器：
- app
- caddy
- mongodb
- redis

路由：
- /api/* -> 后端
- /sub/* -> 后端
- 其他路径 -> 前端 SPA
```

### 0.4 技术栈

```text
前端：Vue 3 + Vite + TypeScript
后端：Node.js + Express + TypeScript
数据库：MongoDB
缓存：Redis
入口：Caddy
UI 设计来源：Stitch + Stitch MCP
```

### 0.5 当前业务功能状态

后端和接口层已基本完成，当前重点是：

```text
基于 Stitch MCP 读取设计稿，逐页复刻前端 UI，并完成接口联调。
```

已完成阶段：

```text
阶段0-1：基础框架与认证
阶段2：用户与授权码
阶段3：上游订阅管理
阶段4：订阅分发接口
阶段5：用户端 MVP 页面
阶段6：轮换管理
阶段7：接口层、系统设置 API、日志筛选 API
```

---

## 1. 本文档使用规则

### 1.1 Codex 每次开始任务必须先读取

新开 Codex 线程时，先让 Codex 读取以下文件：

```bash
sed -n '1,240p' AGENTS.md
sed -n '1,260p' docs/TASK_STATE.md
sed -n '1,260p' docs/UI_REPLICATION_PLAN.md
```

如果文件路径不同，以当前项目中的实际文档为准。

### 1.2 每轮任务必须遵守

每完成一轮 UI 复刻任务，Codex 必须更新：

```text
docs/TASK_STATE.md
```

更新内容至少包括：

```text
1. 本轮目标
2. 已完成页面
3. 修改文件清单
4. 执行命令
5. build 结果
6. Docker 状态
7. 接口测试结果
8. UI 复刻差异
9. 缺少的 Stitch 页面或弹窗
10. 下一轮建议
```

### 1.3 如果缺少 Stitch 页面

如果 Codex 通过 Stitch MCP 读取后发现缺少页面、弹窗、状态设计或移动端/桌面端版本，必须停止当前页面复刻，并在最终回复中明确列出：

```text
缺少的页面/弹窗名称
目标路由或所属页面
缺少的是移动端、桌面端还是弹窗
需要用户回 Stitch 重新生成的内容
建议的 Stitch 提示词方向
```

不要凭空猜测缺失 UI。

---

## 2. UI 复刻总原则

### 2.1 一个系统，一套前端代码

不要做两个前端项目。

```text
Web 端和 Mobile 端通过同一套 Vue3 响应式代码实现。
```

响应式规则：

```text
>= 1024px：桌面端布局
768px - 1023px：平板布局
< 768px：手机端布局
```

### 2.2 统一登录入口

全系统只保留一个登录页：

```text
/login
```

不要创建：

```text
/admin/login
```

登录后按角色自动跳转：

```text
普通用户 -> /dashboard
管理员 -> /admin/users
```

不要设计：

```text
用户/管理员 Tab
角色选择按钮
管理员注册入口
单独管理员登录页
```

### 2.3 用户端移动端优先

用户端页面：

```text
/register
/login
/dashboard
/redeem
/password
/help
```

要求：

```text
手机端卡片布局
桌面端居中显示，最大宽度 480px - 640px
按钮高度不低于 44px
订阅链接过长时省略显示
复制按钮独立明显
```

### 2.4 管理端桌面端优先

管理端页面：

```text
/admin/users
/admin/codes
/admin/upstreams
/admin/rotation
/admin/settings
/admin/logs
```

要求：

```text
桌面端：左侧菜单 + 顶部栏 + 表格
移动端：菜单折叠，表格横向滚动
弹窗自适应
```

### 2.5 不做的内容

第一版不要做：

```text
支付页面
工单系统
客服系统
营销首页
复杂仪表盘
自动上游登录
节点测速大屏
无关统计图表
```

---

## 3. Stitch MCP 使用规则

### 3.1 每轮任务开始前

Codex 必须先通过 Stitch MCP 读取本轮相关 screen，而不是凭记忆或截图猜测。

要求 Codex 输出：

```text
1. 本轮读取到的 Stitch 项目名称
2. 本轮读取到的 screen 名称
3. 每个 screen 对应的系统路由
4. 是否存在移动端和桌面端版本
5. 是否存在相关弹窗
6. 是否存在缺失页面
```

### 3.2 当前 Stitch 项目

当前 MCP 已确认可读取：

```text
SubHub Management System
```

已识别的页面关键词包括：

```text
统一登录页 /login
用户管理 /admin/users
我的订阅 /dashboard
兑换授权码 /redeem
授权码管理 /admin/codes
上游管理 /admin/upstreams
轮换管理 /admin/rotation
系统设置 /admin/settings
```

如缺少以下页面，需要提示用户回 Stitch 生成：

```text
/register
/password
/help
/admin/logs
关键弹窗
移动端/桌面端对应版本
```

---

## 4. 页面映射总表

| 业务页面 | 路由 | 类型 | 优先适配 | 是否必须 |
|---|---|---|---|---|
| 统一登录页 | `/login` | 用户/管理员共用 | Mobile + Desktop | 必须 |
| 注册页 | `/register` | 用户端 | Mobile | 必须 |
| 我的订阅 | `/dashboard` | 用户端 | Mobile | 必须 |
| 授权码兑换 | `/redeem` | 用户端 | Mobile | 必须 |
| 修改密码 | `/password` | 用户端 | Mobile | 必须 |
| 使用帮助 | `/help` | 用户端 | Mobile | 必须 |
| 用户管理 | `/admin/users` | 管理端 | Desktop | 必须 |
| 授权码管理 | `/admin/codes` | 管理端 | Desktop | 必须 |
| 上游订阅 | `/admin/upstreams` | 管理端 | Desktop | 必须 |
| 轮换管理 | `/admin/rotation` | 管理端 | Desktop | 必须 |
| 系统设置 | `/admin/settings` | 管理端 | Desktop | 必须 |
| 日志中心 | `/admin/logs` | 管理端 | Desktop | 必须 |

---

## 5. 弹窗映射总表

| 弹窗 | 所属页面 | 是否必须 | 说明 |
|---|---|---|---|
| 用户详情弹窗 | `/admin/users` | 必须 | 查看用户状态、订阅链接、续期记录 |
| 手动续期弹窗 | `/admin/users` | 必须 | 增加 30/90/180/365/自定义天数 |
| 重置 Token 确认弹窗 | `/admin/users` | 必须 | 旧订阅链接失效 |
| 删除用户确认弹窗 | `/admin/users` | 必须 | 危险操作 |
| 生成授权码弹窗 | `/admin/codes` | 必须 | 数量、天数、备注 |
| 生成成功弹窗 | `/admin/codes` | 必须 | 展示授权码列表，复制全部 |
| 作废授权码确认弹窗 | `/admin/codes` | 必须 | 危险操作 |
| 删除授权码确认弹窗 | `/admin/codes` | 必须 | 危险操作 |
| 新增上游弹窗 | `/admin/upstreams` | 必须 | 名称、订阅 URL、启用、备注 |
| 编辑上游弹窗 | `/admin/upstreams` | 必须 | 编辑完整 URL |
| 删除上游确认弹窗 | `/admin/upstreams` | 必须 | 危险操作 |
| 测试拉取结果提示 | `/admin/upstreams` | 必须 | 成功/失败提示 |
| 手动轮换确认弹窗 | `/admin/rotation` | 必须 | 输入 ROTATE 才能确认 |
| 设置保存成功提示 | `/admin/settings` | 必须 | Toast 或提示条 |
| 会话过期提示 | 全局 | 必须 | 跳转登录 |

---

## 6. 通用组件计划

Codex 必须优先抽取或建立以下通用组件，避免每页重复写：

```text
AuthLayout
UserMobileLayout
AdminLayout
StatusTag
CopyButton
ConfirmDialog
PageHeader
EmptyState
LoadingButton
FormField
DataTable
TabPanel
ResponsiveShell
```

### 6.1 StatusTag

用户状态：

```text
inactive -> 未授权，灰色
active -> 正常，绿色
grace -> 宽限期，橙色
expired -> 已过期，红色
disabled -> 已禁用，深灰
```

授权码状态：

```text
unused -> 未使用，绿色
used -> 已使用，灰色
revoked -> 已作废，红色
```

轮换状态：

```text
success -> 成功，绿色
failed -> 失败，红色
```

### 6.2 CopyButton

用于：

```text
复制订阅链接
复制授权码
复制 token
```

要求：

```text
点击后显示“已复制”
失败时显示“复制失败，请手动复制”
```

### 6.3 ConfirmDialog

要求：

```text
标题明确
说明风险
取消按钮
确认按钮
危险操作为红色
提交时 loading
失败时保留弹窗
```

### 6.4 手动轮换弹窗

要求输入：

```text
ROTATE
```

只有输入完全等于 `ROTATE` 才能提交。

---

## 7. 分阶段复刻计划

## 阶段 A：UI 复刻计划确认

### A.1 目标

不改代码，只读取 Stitch MCP 和当前前端结构，输出复刻计划。

### A.2 Codex 必须执行

```bash
pwd
whoami
find frontend -maxdepth 3 -type f | sort
```

并通过 Stitch MCP 读取页面清单。

### A.3 输出

```text
1. Stitch 页面清单
2. 当前前端页面清单
3. 页面映射表
4. 缺少页面清单
5. 第一轮复刻建议
6. 需要用户回 Stitch 补充的内容
```

### A.4 验收

```text
未修改业务代码
docs/TASK_STATE.md 已更新
缺少页面已明确列出
```

---

## 阶段 B：统一登录页与注册页

### B.1 页面范围

```text
/login
/register
AuthLayout
Turnstile 区域样式
```

### B.2 功能要求

登录页：

```text
全系统唯一登录页
管理员和用户共用
登录成功后按角色分流
不出现 /admin/login
不出现角色选择
```

注册页：

```text
仅普通用户注册
注册关闭时显示提示
注册成功后跳转 /login
```

### B.3 Stitch 检查

开始前必须确认 Stitch 是否包含：

```text
/login 桌面端
/login 移动端
/register 移动端
```

如果缺少 `/register`，必须提示用户回 Stitch 生成。

### B.4 验收命令

```bash
npm run build --prefix frontend
curl -i http://127.0.0.1:8084/
curl -i http://127.0.0.1:8084/health
curl -i http://127.0.0.1:8084/config
```

### B.5 验收标准

```text
/login 可访问
/register 可访问
无 /admin/login 新页面
登录页桌面端居中
登录页移动端单列
build 成功
TASK_STATE.md 已更新
```

---

## 阶段 C：用户端核心页面

### C.1 页面范围

```text
/dashboard
/redeem
/password
/help
UserMobileLayout
```

### C.2 Dashboard 要求

显示：

```text
用户名
用户状态标签
到期时间 expire_at
实际失效时间 disable_after
订阅版本号
target 格式选择
订阅链接
复制订阅链接按钮
状态说明
```

target 选项：

```text
clash
mihomo
sing-box
v2ray
shadowrocket
```

状态说明：

```text
inactive：当前账号未授权，请先兑换授权码
active：订阅正常，可复制链接使用
grace：当前处于宽限期，请尽快续期
expired：订阅已过期
disabled：账号已禁用
```

### C.3 Redeem 要求

```text
授权码输入
兑换按钮
成功后显示新到期时间
失败显示明确错误
```

### C.4 Password 要求

```text
原密码
新密码
确认新密码
保存按钮
```

### C.5 Help 要求

分区：

```text
Clash / Mihomo
Shadowrocket
sing-box
V2RayN
常见问题
```

### C.6 Stitch 检查

开始前确认 Stitch 是否包含：

```text
/dashboard mobile
/redeem mobile
/password mobile
/help mobile
```

如缺少，提示用户补充。

### C.7 验收标准

```text
用户端页面移动端可用
桌面端居中显示
订阅链接可复制
target 切换后链接变化
兑换页状态明确
build 成功
TASK_STATE.md 已更新
```

---

## 阶段 D：管理端布局与用户管理

### D.1 页面范围

```text
AdminLayout
/admin/users
用户详情弹窗
手动续期弹窗
重置 token 确认弹窗
删除用户确认弹窗
```

### D.2 AdminLayout 要求

桌面端：

```text
左侧菜单
顶部栏
主内容区
```

菜单：

```text
用户管理
授权码管理
上游订阅
轮换管理
系统设置
日志中心
```

顶部栏：

```text
系统名称
当前管理员
退出登录
```

移动端：

```text
菜单折叠
表格横向滚动
```

### D.3 用户管理字段

```text
用户名
状态
到期时间
实际失效时间
订阅 token 脱敏
创建时间
操作
```

### D.4 用户操作

```text
查看详情
手动续期
禁用/启用
重置 token
删除
```

### D.5 Stitch 检查

开始前确认 Stitch 是否包含：

```text
/admin/users desktop
用户详情弹窗
手动续期弹窗
删除/重置确认弹窗
```

如缺少，提示用户补充。

### D.6 验收标准

```text
/admin/users 可访问
左侧菜单正常
用户表格显示
用户状态标签正确
弹窗可打开和关闭
build 成功
TASK_STATE.md 已更新
```

---

## 阶段 E：授权码管理与上游订阅管理

### E.1 页面范围

```text
/admin/codes
/admin/upstreams
生成授权码弹窗
生成成功弹窗
作废/删除确认弹窗
新增/编辑上游弹窗
删除上游确认弹窗
测试拉取结果提示
```

### E.2 授权码管理字段

```text
授权码，脱敏显示
天数
状态
使用用户
使用时间
创建时间
备注
操作
```

操作：

```text
复制
作废
删除
```

### E.3 上游管理字段

```text
上游名称
启用状态
订阅链接脱敏
最近测试状态
最近测试时间
更新时间
备注
操作
```

操作：

```text
编辑
启用/停用
测试拉取
删除
```

### E.4 验收标准

```text
/admin/codes 可访问
/admin/upstreams 可访问
授权码状态显示正确
上游 URL 不在表格暴露完整内容
弹窗完整
build 成功
TASK_STATE.md 已更新
```

---

## 阶段 F：轮换管理

### F.1 页面范围

```text
/admin/rotation
当前版本卡片
影响用户统计卡片
手动轮换卡片
轮换日志表格
ROTATE 确认弹窗
```

### F.2 当前版本卡片

显示：

```text
当前订阅版本号
上次轮换时间
上次轮换结果
本月轮换次数
```

### F.3 手动轮换

要求：

```text
输入 ROTATE 后按钮才可点击
点击后二次确认
成功后版本号增加
失败不增加版本号
```

### F.4 验收标准

```text
/admin/rotation 可访问
ROTATE 机制可用
日志表格可显示
build 成功
TASK_STATE.md 已更新
```

---

## 阶段 G：系统设置与日志中心

### G.1 页面范围

```text
/admin/settings
/admin/logs
```

### G.2 设置页分区

```text
站点与 Converter
安全与限流
Turnstile
```

站点与 Converter：

```text
appBaseUrl
converter_backend_url
默认 target
sub_cache_seconds
sub_rate_limit_per_minute
```

安全与限流：

```text
registration_enabled
登录限流参数
注册限流参数
订阅接口限流参数
```

Turnstile：

```text
启用状态
site key
secret key
登录启用
注册启用
兑换启用
```

要求：

```text
secret key 默认隐藏
保存后提示设置已生效
```

### G.3 日志中心

Tabs：

```text
登录日志
授权码日志
订阅访问日志
```

登录日志字段：

```text
时间
用户名
IP
User-Agent
是否成功
失败原因
```

授权码日志字段：

```text
时间
授权码脱敏
使用用户
天数
结果
失败原因
```

订阅访问日志字段：

```text
时间
用户
token 脱敏
target
IP
是否命中缓存
是否成功
失败原因
版本号
```

### G.4 验收标准

```text
/admin/settings 可访问
/admin/logs 可访问
设置表单可加载
日志 Tab 可切换
筛选区存在
build 成功
TASK_STATE.md 已更新
```

---

## 阶段 H：全局响应式与视觉统一

### H.1 目标

统一全站视觉、间距、字体、状态色、弹窗、移动端适配。

### H.2 检查项

```text
统一登录页桌面/移动端
用户端 375px / 390px / 430px
管理端 1440px
管理端窄屏菜单折叠
表格横向滚动
弹窗移动端自适应
状态标签颜色一致
复制按钮一致
危险操作弹窗一致
```

### H.3 验收命令

```bash
npm run build --prefix frontend
docker compose ps
docker compose logs --tail=100
curl -i http://127.0.0.1:8084/
curl -i http://127.0.0.1:8084/health
curl -i http://127.0.0.1:8084/config
```

### H.4 验收标准

```text
所有页面可访问
build 成功
容器正常
健康检查正常
TASK_STATE.md 已更新
```

---

## 8. 每轮 Codex 标准提示词模板

每一轮可使用以下模板：

```text
当前项目在 NAS：

/vol1/1000/docker/subscription_manager

请先读取：
1. AGENTS.md
2. docs/TASK_STATE.md
3. docs/UI_REPLICATION_PLAN.md

请通过 Stitch MCP 读取本轮对应页面设计。

本轮任务：[填写阶段名称]

页面范围：
[填写页面和弹窗]

要求：
1. 不要修改后端业务逻辑
2. 不要新增无关页面
3. 不要创建 /admin/login
4. 不要做支付页面
5. 按当前接口字段实现
6. 响应式适配 Web/Mobile
7. 每完成本轮必须 npm run build --prefix frontend
8. 必须更新 docs/TASK_STATE.md

如果 Stitch MCP 缺少本轮页面或弹窗，请停止并告诉我缺少什么，不要凭空猜测。

完成后输出：
- 读取到的 Stitch 页面
- 修改文件清单
- 页面清单
- 弹窗清单
- build 结果
- 容器/接口检查结果
- 缺少页面或差异
- 下一步建议
```

---

## 9. 每轮验收命令清单

Codex 每轮结束至少执行：

```bash
cd /vol1/1000/docker/subscription_manager
npm run build --prefix frontend
curl -i http://127.0.0.1:8084/
curl -i http://127.0.0.1:8084/health
curl -i http://127.0.0.1:8084/config
```

如果本轮涉及容器状态检查：

```bash
docker compose ps
docker compose logs --tail=100
```

如果确实需要重建容器，Codex 必须先说明原因，再执行：

```bash
docker compose up -d --build
```

禁止未经确认执行：

```bash
rm -rf
docker volume rm
docker system prune
清空 MongoDB
删除数据库数据卷
修改其他项目目录
重启 NAS
修改 /etc 系统配置
```

---

## 10. 缺少页面时的处理流程

如果 Codex 发现 Stitch MCP 中缺少页面或弹窗：

### 10.1 Codex 必须输出

```text
缺少页面：
- 页面名称
- 目标路由
- 缺少的是移动端、桌面端还是弹窗
- 为什么当前无法可靠复刻
```

### 10.2 用户应回 Stitch 补充

例如缺少 `/admin/logs`，用户给 Stitch 的补充提示词：

```text
请补充设计订阅分发管理系统的日志中心页面 /admin/logs。
要求包含三个 Tab：登录日志、授权码日志、订阅访问日志。
每个 Tab 包含筛选区、表格、空状态、分页。
保持现有 SaaS 简洁风格。
```

### 10.3 补充后 Codex 再读取

用户生成页面后，让 Codex 重新通过 Stitch MCP 读取页面，再继续复刻。

---

## 11. 最终全量验收标准

全部 UI 复刻完成后，必须满足：

```text
1. /login 可访问，且为统一登录入口
2. 不存在 /admin/login 页面
3. /register 可访问
4. /dashboard 可访问
5. /redeem 可访问
6. /password 可访问
7. /help 可访问
8. /admin/users 可访问
9. /admin/codes 可访问
10. /admin/upstreams 可访问
11. /admin/rotation 可访问
12. /admin/settings 可访问
13. /admin/logs 可访问
14. 用户端移动端显示正常
15. 管理端桌面端显示正常
16. 关键弹窗完整
17. 状态标签颜色一致
18. 复制按钮可用
19. 危险操作有二次确认
20. 手动轮换需要 ROTATE
21. build 成功
22. 容器状态正常
23. /health 正常
24. docs/TASK_STATE.md 已更新
```

---

## 12. 最终交付物

Codex 完成后必须输出：

```text
1. 完成页面清单
2. 完成弹窗清单
3. 修改文件清单
4. 新增组件清单
5. 执行命令
6. build 结果
7. 接口/容器测试结果
8. 与 Stitch 设计差异
9. 未完成内容
10. 下一步建议
```

---

## 13. 推荐执行顺序摘要

```text
A. UI 复刻计划确认
B. /login + /register
C. /dashboard + /redeem + /password + /help
D. AdminLayout + /admin/users
E. /admin/codes + /admin/upstreams
F. /admin/rotation
G. /admin/settings + /admin/logs
H. 全局响应式与视觉统一
```

---

## 14. 给新线程的最短接续提示词

```text
当前项目在 NAS：

/vol1/1000/docker/subscription_manager

请先读取：
1. AGENTS.md
2. docs/TASK_STATE.md
3. docs/UI_REPLICATION_PLAN.md

然后通过 Stitch MCP 读取 SubHub Management System 设计稿，按 UI_REPLICATION_PLAN.md 的阶段继续复刻。

每轮结束必须 build、验收、更新 TASK_STATE.md。
如果 Stitch 缺少页面或弹窗，停止并告诉我需要补充什么。
```
