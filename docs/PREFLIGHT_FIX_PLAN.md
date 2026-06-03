# 上线前专项复审与修复计划

复审日期：2026-06-03  
项目目录：`/vol1/1000/docker/subscription_manager`

## 1. 复审时间

- 2026-06-03

## 2. 当前上线状态判断

- 是否可上线：**条件可上线**
- P0 数量：**0**
- P1 数量：**0**
- P2 数量：**4**

## 3. P0 阻塞项

- 暂无

## 4. P1 上线前必须处理项

### 4.1 `/rotation` 页面处理建议

**现状核查结果**

- `frontend/src/router/index.ts` 仍注册 `/rotation`
- `frontend/src/pages/RotationPage.vue` 仍存在
- 该页面会调用管理员轮换接口：
  - `/api/admin/rotation/status`
  - `/api/admin/rotation/logs`
  - `/api/admin/rotation/execute`
- 当前前端没有显式菜单链接指向 `/rotation`
- 普通已登录用户仍可直接访问该路由
- 管理员已有正式页面 `/admin/rotation`

**当前处理结果**

- 已在前端路由守卫中完成收敛：
  - 未登录访问 `/rotation` -> `/login`
  - 普通用户访问 `/rotation` -> `/dashboard`
  - 管理员访问 `/rotation` -> `/admin/rotation`

**风险判断**

- 该页面属于历史遗留 / 调试页性质
- 对普通用户来说属于“可访问但不可用”的权限语义错位
- 不属于立即安全漏洞，但属于明显的上线前 UX / 路由治理问题

**推荐方案**

- **推荐短期采用：方案 C，保留但强制管理员权限**
  - 普通用户访问时直接重定向到 `/dashboard`
  - 管理员访问时可跳转到 `/admin/rotation` 或被统一接管到正式管理页
- **推荐中期收敛：方案 A，移除 `/rotation` 路由**
  - 在兼容窗口结束后删除历史入口

**不建议**

- 直接继续暴露给普通用户
- 继续让页面调用管理员接口但不做权限约束

## 5. P2 上线前建议处理项

### 5.1 compose 文件重复

- 当前 `compose.yaml` 与 `docker-compose.yml` 同时存在。
- `docker compose` 实际使用的是 `compose.yaml`。
- 两个文件当前**不完全一致**：
  - `compose.yaml` 额外包含 `subconverter`
  - `compose.yaml` 额外包含 `CONVERTER_SOURCE_SECRET`
  - `compose.yaml` 的 `CONVERTER_BACKEND_URL` 有默认值
- 结论：
  - `docker-compose.yml` 已明显过期，建议后续只保留 `compose.yaml` 作为唯一权威文件。
  - 若暂不删除，至少要在 README / 任务状态 / 部署文档中明确说明 `compose.yaml` 为唯一权威编排文件。

### 5.2 文档历史漂移

- `docs/DEV_TASK.md` 仍包含旧逻辑：
  - 旧的 `redeem_turnstile_enabled`
  - 旧的 `/admin/login`
  - 旧的 `/rotation`
  - “公共 subconverter” 的旧描述
- `docs/TASK_STATE.md` 历史段落也保留了大量旧阶段信息，属于正常演进记录，但不适合作为最新上线依据。
- 建议：
  - 新建 `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
  - 将旧任务书归档到 `docs/archive/`
  - 在当前任务书或部署文档中标记“旧描述仅供历史参考”

### 5.3 老管理员接口

- 当前前端不再调用：
  - `/api/auth/admin/login`
  - `/api/auth/admin/change-password`
- 前端统一使用 `/login`，后端会根据用户名自动区分普通用户与管理员。
- 这两个老接口仍可作为兼容入口保留。
- 当前代码里它们已经具备：
  - 登录失败限制
  - Turnstile 校验
  - 登录日志
- 建议：
  - 短期保留，并在文档中标记为“兼容接口”
  - 若未来确认无外部调用，再逐步下线

### 5.4 过期空订阅兼容性

- 当前实现：
  - `expired`：返回 `200` 空订阅，并带“订阅已过期，请联系管理员”标题
  - `inactive`：返回 `403`
  - `disabled`：返回 `403`
- 建议分两层决策：
  1. 如果目标是**尽量不让客户端报错**，可以考虑让 `expired / inactive / disabled` 都返回合法空配置，并通过标题/文件名提示状态。
  2. 如果目标是**保留账号状态语义**，则至少保留当前 expired 空订阅方案，inactive/disabled 继续返回 `403`。
- 需要用户确认最终策略后再改代码。

## 6. 建议删除项

- `docker-compose.yml`
- `frontend/src/pages/RotationPage.vue`
- `docs/DEV_TASK.md` 中过期的配置段落（应先归档再考虑删除）
- `upstream_fetch_user_agent`、`sub_cache_seconds`、`redeem_turnstile_enabled` 的旧文档说明

## 7. 建议保留项

- `compose.yaml`
  - 当前实际生效的唯一编排文件。
- `backend/src/routes/auth.ts` 中的老管理员接口
  - 作为兼容入口可继续保留，降低外部脚本迁移成本。
- `docs/TASK_STATE.md`
  - 作为项目过程记录保留，便于审计与回溯。
- `frontend/src/pages/AdminRotationPage.vue`
  - 这是正式管理端页面，应保留。

## 8. 需要用户确认项

- 是否将 `/rotation` 作为历史兼容入口保留一段时间后再删除
- 是否允许 `inactive / disabled` 也返回 200 空订阅
- 是否将 `docker-compose.yml` 直接删除，或仅保留为历史参考
- 是否新建 `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- 是否将旧任务书归档到 `docs/archive/`
- 是否允许老管理员接口继续作为兼容入口存在

## 9. 建议执行顺序

1. 先处理 `/rotation` 的路由语义问题
2. 明确 `compose.yaml` 为唯一权威编排文件
3. 清理或归档文档历史漂移
4. 确认老管理员接口保留策略
5. 确认过期空订阅的最终兼容策略
6. 整理正式环境变量清单
7. 执行全量 smoke test

## 10. 下一轮可执行任务提示

> 可直接复制给 Codex 的下一轮任务建议：

请先只处理 P1：将 `/rotation` 路由收敛为管理员兼容入口，或者改为直接重定向到 `/admin/rotation`，并确保普通用户无法停留在该页；同时在 `docs/TASK_STATE.md` 中同步记录。随后再统一 `compose.yaml` 与 `docker-compose.yml` 的权威关系，最后整理文档历史漂移与过期订阅兼容策略，暂不删除任何文件。
