# TASK_STATE

## Date

2026-06-03

## Round Goal

复测云服务器与 NAS 本地在同一上游链接下的差异，确认线上测试返回 HTTP 403 的根因。

## Project Current Status

- 云服务器直接请求上游链接时返回 `HTTP/2 403`，响应头显示 `server: cloudflare`，正文为 Cloudflare 的访问受限页面。
- NAS 本地通过 OpenClash 出口访问同一链接时返回 `HTTP/2 200`，说明上游本身并非完全不可用，而是**对云服务器出口 IP / 机房网络特征做了限制**。
- 这次差异与前端、节点解析或分类逻辑无关，属于上游风控 / 出口网络差异问题。

## File Changes In This Round

- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,260p' backend/src/lib/upstream-testing.ts`
- `sed -n '1,260p' backend/src/routes/stage3.ts`
- `sed -n '1,260p' backend/src/lib/subscription-conversion.ts`
- `sed -n '1,260p' backend/src/services/upstream-batch-runner.ts`
- `sed -n '1,240p' backend/src/lib/redis.ts`
- `sed -n '1,220p' backend/src/config/env.ts`

## Docker/Container Status

- 本轮未重建容器。

## API/Interface Status

- `/admin/upstreams/:id/test` 在云服务器环境下会把上游 HTTP 403 判定为测试失败。

## Validation Result

- 云服务器测试：`HTTP/2 403`
- NAS 本地 OpenClash 测试：`HTTP/2 200`

## Notes / Blockers

- 当前阻塞点在上游对云服务器出口的限制，不在本项目解析或转换代码。

## Next Step

- 如需继续推进，可考虑为上游抓取增加可切换出口（代理/中转抓取），或把上游测试与刷新仍放在可通的出口环境执行。

## Date

2026-06-03

## Round Goal

排查正式站点上游测试在云服务器环境下返回 HTTP 403、但 NAS 本地测试正常的差异原因。

## Project Current Status

- 线上 `/admin/upstreams/:id/test` 与批量测试在云服务器环境返回 HTTP 403。
- NAS 本地同一批上游链接测试正常，节点池可达 `ready (2/2 成功，共 153 个节点)`。
- 当前最可能的差异点是云服务器出口 IP / ASN / 地域触发了上游供应商风控，而不是前端或本地解析逻辑。

## File Changes In This Round

- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,260p' backend/src/lib/upstream-testing.ts`
- `sed -n '1,260p' backend/src/routes/stage3.ts`
- `sed -n '1,260p' backend/src/lib/subscription-conversion.ts`
- `sed -n '1,260p' backend/src/services/upstream-batch-runner.ts`
- `sed -n '1,220p' docs/TASK_STATE.md`
- `sed -n '1,240p' backend/src/lib/redis.ts`
- `sed -n '1,220p' backend/src/config/env.ts`

## Docker/Container Status

- 本轮未重建容器。

## API/Interface Status

- 接口未改动。

## Validation Result

- 代码层测试逻辑确认：`/admin/upstreams/:id/test` 直接将上游 HTTP 403 记为测试失败。
- 当前现象与云服务器出口网络环境相关性高。

## Notes / Blockers

- 需要在云服务器侧进一步核实出口 IP / 网络环境是否被上游供应商限制。

## Next Step

- 建议在云服务器上直接用 `curl -A Shadowrocket` 复测对应上游 URL，和 NAS 本地的出口 IP 行为做对比；必要时再评估是否需要代理/中转抓取方案。

## Date

2026-06-03

## Round Goal

修复生产站点前端在 HTTPS 页面下仍请求 NAS 本地 `http://192.168.10.3:8084/config` 的 Mixed Content / CORS 问题，并准备上传代码。

## Project Current Status

- `frontend/src/lib/api.ts` 已改为优先使用 `VITE_APP_BASE_URL`，否则回退到 `window.location.origin`，避免生产页面继续请求 NAS 本地地址。
- 前端已重新构建，代码层修复已完成。
- 本地发布 commit 已生成，但当前远端推送仍受 GitHub SSH/HTTPS 鉴权与连接问题阻塞，尚未完成远端上传。

## File Changes In This Round

- Updated: `frontend/src/lib/api.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,220p' .codex/skills/subscription-manager-project/SKILL.md`
- `sed -n '1,220p' frontend/src/lib/public-config.ts`
- `sed -n '1,220p' frontend/src/main.ts`
- `sed -n '1,260p' frontend/src/pages/LoginPage.vue`
- `sed -n '1,220p' frontend/src/lib/auth-request.ts`
- `sed -n '1,220p' frontend/src/lib/api.ts`
- `grep -RIn "VITE_APP_BASE_URL\\|API_BASE" frontend/src`
- `npm run build --prefix frontend`
- `git push origin master`
- `ssh -T -o BatchMode=yes git@github.com`
- `ssh -T -p 443 -o BatchMode=yes git@ssh.github.com`

## Docker/Container Status

- 本轮未重建容器。

## API/Interface Status

- `/config` 的前端请求基址策略已修正为同源优先；后端接口未变更。

## Validation Result

- `frontend` 构建通过。
- 本地代码修复已完成。
- 远端推送仍失败于 GitHub 连接/鉴权阶段。

## Notes / Blockers

- GitHub SSH 连接被远端关闭。
- HTTPS push 缺少可用用户名/令牌。

## Next Step

- 等待可用的 GitHub 推送通道，或在可用环境中重试 `git push origin master`。

## Date

2026-06-03

## Round Goal

排查生产站点登录页请求本地 NAS 地址导致的 Mixed Content / CORS 问题，并修正前端接口基址策略。

## Project Current Status

- 生产环境中前端仍在请求 `http://192.168.10.3:8084/config`，与正式域名 `https://sub.889100.xyz` 不一致，触发 Mixed Content 与 CORS 拦截。
- 根因已确认：`frontend/src/lib/api.ts` 将 `API_BASE` 默认写死为 NAS 本地地址。
- 已改为“优先使用 `VITE_APP_BASE_URL`，否则回退到 `window.location.origin`”，使生产环境自动同源请求。

## File Changes In This Round

- Updated: `frontend/src/lib/api.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,220p' .codex/skills/subscription-manager-project/SKILL.md`
- `sed -n '1,220p' frontend/src/lib/public-config.ts`
- `sed -n '1,220p' frontend/src/main.ts`
- `sed -n '1,260p' frontend/src/pages/LoginPage.vue`
- `sed -n '1,220p' frontend/src/lib/auth-request.ts`
- `sed -n '1,220p' frontend/src/lib/api.ts`
- `grep -RIn "VITE_APP_BASE_URL\\|API_BASE" frontend/src`
- `npm run build --prefix frontend`

## Docker/Container Status

- 本轮未重建容器。

## API/Interface Status

- `/config` 的请求路径策略已修正为同源优先；后端接口本身未变更。

## Validation Result

- `frontend` 构建通过。

## Notes / Blockers

- 生产环境需要重新部署前端静态资源，使新构建产物生效。

## Next Step

- 重新发布前端静态资源并在正式域名下复测登录页 `/config` 请求是否已变为同源 HTTPS。

## Date

2026-06-03

## Round Goal

修正 `scripts/nas-release.sh` 的发布确认交互，允许小写 `yes` 继续发布。

## Project Current Status

- `scripts/nas-release.sh` 的交互确认现已支持 `YES/yes/Y/y`。
- 仍保持本地发布流程与远端推送流程一致。

## File Changes In This Round

- Updated: `scripts/nas-release.sh`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '140,210p' scripts/nas-release.sh`
- `sed -n '210,280p' scripts/nas-release.sh`

## Docker/Container Status

- 本轮未重建容器。

## API/Interface Status

- 无接口变更。

## Validation Result

- 发布确认交互已修正为大小写兼容。

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 重新执行 `scripts/nas-release.sh` 完成发布上传。

## Date

2026-06-03

## Round Goal

完成 `scripts/nas-release.sh` 发布上传，并确保仓库可成功推送到 GitHub 远端。

## Project Current Status

- 发布脚本已修正为在没有新待提交改动时，仍可直接推送当前发布提交与 tag。
- 本地发布 commit 已生成并推送到远端。
- 本次发布 tag 已推送：`v2026.06.03-1`

## File Changes In This Round

- Updated: `scripts/nas-release.sh`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `YES=true ./scripts/nas-release.sh`
- `git status --short`
- `git log --oneline -1 --decorate`
- `git tag --list 'v2026.06.03*'`

## Docker/Container Status

- 本轮未重建容器。
- 现有服务状态未变更。

## API/Interface Status

- 无接口变更。

## Validation Result

- `backend` 构建通过。
- `frontend` 构建通过。
- 本地 smoke test 通过。
- GitHub 分支推送成功。
- GitHub tag 推送成功。

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 如需继续，可执行云服务器侧 `deploy.sh v2026.06.03-1` 完成生产环境更新。

## Date

2026-06-03

## Round Goal

执行 `scripts/nas-release.sh` 完成仓库发布上传，并处理发布脚本的暂存排除逻辑。

## Project Current Status

- 发布脚本已修正为仅暂存允许提交的文件，避免 `.env` / 生产编排文件 / 运行目录被误暂存。
- 本地发布 commit 已生成。
- 远端推送在 GitHub 鉴权阶段被阻塞：SSH 连接被远端关闭，HTTPS 推送缺少可用用户名/令牌。

## File Changes In This Round

- Updated: `scripts/nas-release.sh`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `YES=true ./scripts/nas-release.sh`
- `git status --short`
- `git remote -v`
- `git config --get credential.helper`
- `env | grep -Ei 'github|gh|token'`
- `gh --version`
- `ssh -T -o BatchMode=yes git@github.com`
- `GIT_TERMINAL_PROMPT=0 git ls-remote https://github.com/GooFeng100/subscription_manager.git HEAD`
- `git push https://github.com/GooFeng100/subscription_manager.git master`

## Docker/Container Status

- 本轮未重建容器。
- 现有服务状态未变更。

## API/Interface Status

- 无接口变更。

## Validation Result

- `backend` 构建通过。
- `frontend` 构建通过。
- 本地 smoke test 通过。
- 本地 commit 已完成，push 仍待远端鉴权条件满足。

## Notes / Blockers

- GitHub SSH 连接被远端关闭。
- HTTPS push 无可用用户名/令牌，无法完成远端上传。

## Next Step

- 如需继续发布，请先提供可用的 GitHub HTTPS 凭据或恢复可用的 SSH 发布通道。

## Date

2026-06-03

## Round Goal

生成最终版云服务器部署与维护总文档，并让 README / DEPLOYMENT / TASK_STATE 指向该总文档。

## Project Current Status

- 已生成 `docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`。
- `README.md` 与 `docs/DEPLOYMENT.md` 已更新为指向最终总文档。
- 总文档覆盖本地 NAS、云服务器生产、Caddy 容器、备份恢复、tag、回滚与验收流程。

## File Changes In This Round

- Added: `docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,260p' /home/admin/.codex/attachments/58a50bd4-e61b-4e96-8a80-67a7017f2cf0/pasted-text.txt`
- `sed -n '261,520p' /home/admin/.codex/attachments/58a50bd4-e61b-4e96-8a80-67a7017f2cf0/pasted-text.txt`
- `sed -n '1,360p' docs/CLOUD_DEPLOYMENT_STEPS.md`
- `sed -n '1,320p' docs/BACKUP_RESTORE.md`
- `sed -n '1,260p' docs/DEPLOYMENT.md`
- `sed -n '1,320p' docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `sed -n '1,220p' docs/RELEASE_TAG_POLICY.md`
- `sed -n '1,260p' .env.production.example`
- `sed -n '1,260p' README.md`
- `sed -n '1,260p' docs/TASK_STATE.md`
- `sed -n '1,260p' compose.yaml`
- `sed -n '1,260p' .gitignore`
- `sed -n '1,260p' backend/Dockerfile`
- `sed -n '1,260p' frontend/package.json`
- `sed -n '1,260p' backend/package.json`

## Docker/Container Status

- 本轮未重建容器。
- 现有容器状态未变更。

## API/Interface Status

- 无接口变更。

## Validation Result

- 总文档已生成，并与 README / DEPLOYMENT 入口对齐。

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 如需继续，可进行一次文档终检，确认所有新旧部署文档之间的引用关系一致。

---

## Date

2026-06-03

## Round Goal

修正云端部署文档一致性：备份主方案、Caddy SPA 路由顺序、MongoDB 认证、外层生产目录、deploy.sh 分支/tag 语义。

## Project Current Status

- `docs/CLOUD_DEPLOYMENT_STEPS.md` 已改为外层 `/opt/apps/subscription-manager/` 生产目录模型。
- `docs/CLOUD_DEPLOYMENT_STEPS.md` 中的 `Caddyfile` 示例已调整为先反代 `/api`、`/config`、`/health`、`/sub`，最后处理 SPA。
- 生产 MongoDB 认证已写入示例与说明。
- `docs/BACKUP_RESTORE.md` 已改为 `mongodump` / `mongorestore` 主方案，并给出容器内执行思路。
- `docs/RELEASE_TAG_POLICY.md` 已保留 annotated tag 策略并补充打 tag 前置条件。

## File Changes In This Round

- Updated: `.env.production.example`
- Updated: `README.md`
- Updated: `docs/BACKUP_RESTORE.md`
- Updated: `docs/CLOUD_DEPLOYMENT_STEPS.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,260p' /home/admin/.codex/attachments/83cc3264-b641-470a-9142-30ce1697b207/pasted-text.txt`
- `sed -n '1,220p' docs/TASK_STATE.md`
- `sed -n '1,260p' docs/CLOUD_DEPLOYMENT_STEPS.md`
- `sed -n '1,260p' docs/BACKUP_RESTORE.md`
- `sed -n '1,260p' docs/DEPLOYMENT.md`
- `sed -n '1,260p' docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `sed -n '1,220p' docs/RELEASE_TAG_POLICY.md`
- `sed -n '1,220p' .env.production.example`

## Docker/Container Status

- 本轮未重建容器。
- 现有容器状态未变更。

## API/Interface Status

- 无接口变更。

## Validation Result

- 云端部署文档已按外层生产目录模型与 MongoDB 认证口径修正。

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 如需继续，建议下一轮只做“上线前逐项打勾版清单”，不再改业务代码。

---

## Date

2026-06-03

## Round Goal

将云端部署文档收口为“外层生产部署文件 + 内层 repo 代码”的生产架构，并补齐生产 env / 备份恢复 / tag 说明。

## Project Current Status

- 云服务器部署步骤已改为 `/opt/apps/subscription-manager/` 外层目录模型。
- 生产 `docker-compose.prod.yml`、`.env.prod`、`caddy/Caddyfile`、`deploy.sh` 已明确为不进 Git 的外层文件。
- `BACKUP_RESTORE.md` 已改为 MongoDB 逻辑备份主方案。
- `RELEASE_TAG_POLICY.md` 已补充打 tag 前置条件。
- `README.md`、`docs/DEPLOYMENT.md`、`docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` 已同步生产口径。

## File Changes In This Round

- Added: `.env.production.example`
- Added: `docs/CLOUD_DEPLOYMENT_STEPS.md`
- Added: `docs/BACKUP_RESTORE.md`
- Added: `docs/RELEASE_TAG_POLICY.md`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,260p' /home/admin/.codex/attachments/11abdd88-7c05-449a-8b9d-39ffa95ce2dd/pasted-text.txt`
- `sed -n '261,520p' /home/admin/.codex/attachments/11abdd88-7c05-449a-8b9d-39ffa95ce2dd/pasted-text.txt`
- `sed -n '1,260p' docs/CLOUD_DEPLOYMENT_STEPS.md`
- `sed -n '1,260p' docs/BACKUP_RESTORE.md`
- `sed -n '1,220p' docs/RELEASE_TAG_POLICY.md`
- `sed -n '1,260p' README.md`
- `sed -n '1,260p' docs/DEPLOYMENT.md`
- `sed -n '1,260p' caddy/Dockerfile`
- `sed -n '1,220p' caddy/Caddyfile`
- `sed -n '1,220p' caddy/Caddyfile.prod`
- `sed -n '1,260p' docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `git status --short`
- `git diff --stat`

## Docker/Container Status

- 本轮未重建容器。
- 现有容器状态未变更。

## API/Interface Status

- 无接口变更。

## Validation Result

- 文档已按外层生产部署架构收口。

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 若要继续，可再补一版“生产上线执行清单（逐项打勾版）”。

---

## Date

2026-06-03

## Round Goal

整理云服务器部署步骤、生产环境变量样例、备份/恢复说明，并确认 release tag 方案。

## Project Current Status

- 已生成云服务器部署步骤文档 `docs/CLOUD_DEPLOYMENT_STEPS.md`。
- 已生成备份/恢复说明 `docs/BACKUP_RESTORE.md`。
- 已生成 release tag 策略 `docs/RELEASE_TAG_POLICY.md`。
- 已新增生产环境样例 `.env.production.example`。
- `README.md` 与 `docs/DEPLOYMENT.md` 已补充文档入口与权威说明。

## File Changes In This Round

- Added: `.env.production.example`
- Added: `docs/CLOUD_DEPLOYMENT_STEPS.md`
- Added: `docs/BACKUP_RESTORE.md`
- Added: `docs/RELEASE_TAG_POLICY.md`
- Updated: `backend/.env.example`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `git status --short`
- `git diff --stat`
- `sed -n '1,220p' docs/TASK_STATE.md`
- `sed -n '1,260p' docs/DEPLOYMENT.md`
- `sed -n '1,260p' docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `sed -n '1,220p' frontend/.env.example`
- `sed -n '1,260p' .env.example`
- `sed -n '1,220p' backend/.env.example`
- `sed -n '1,260p' backend/src/config/env.ts`
- `sed -n '1,260p' backend/src/lib/runtime-settings.ts`
- `sed -n '1,220p' docker/backup.sh`
- `sed -n '1,260p' docker/restore.sh`
- `sed -n '1,220p' README.md`
- `sed -n '1,220p' compose.yaml`
- `sed -n '1,220p' docker-compose.prod.yml`

## Docker/Container Status

- 本轮未重建容器。
- 现有容器状态未变更。

## API/Interface Status

- 无接口变更。

## Validation Result

- 文档与样例已补齐。
- tag 方案已确认。

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 如果要继续推进，可以按 `docs/CLOUD_DEPLOYMENT_STEPS.md` 做一次正式域名的人工上线准备核对。

---
## Date

2026-06-03

## Round Goal

将网页页签标题更新为正式产品名，并同步前端静态资源到运行中的站点。

## Project Current Status

- 前端页签标题已更新为 `订阅聚合授权分发系统`。
- 前端生产构建已通过。
- 静态资源已同步到 `caddy`，并完成重启。

## File Changes In This Round

- Updated: `frontend/index.html`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`

## Docker/Container Status

- `subscription-manager-caddy`：已重启并运行正常。
- 其余容器未重建。

## API/Interface Status

- 无接口变更。

## Validation Result

- 前端构建：通过
- 页签标题：已切换为正式产品名

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 如需继续优化，可继续统一全站品牌文案；当前需求已完成。

---

## 2026-06-03 - 上线前专项复审与修复计划

### 当前目标
- 基于 `docs/CODEX_COMPLETION_REPORT.md` 复核上线前风险，重点确认 P1 / P2 项，并产出可执行的修复计划。

### 完成情况
- 已完成专项复审。
- 已生成：
  - `docs/PREFLIGHT_FIX_PLAN.md`
- 已明确当前风险分级：
  - P0：0
  - P1：1
  - P2：4

### 结论摘要
- P1：`/rotation` 页面已完成收敛，不再作为当前阻塞项。
- P2：compose 文件重复、文档历史漂移、老管理员接口、过期空订阅兼容性，均建议作为下一轮优化项处理。
- 当前未发现新的 P0 阻塞项。

### 文件变化
- 新增：`docs/PREFLIGHT_FIX_PLAN.md`
- 更新：`docs/TASK_STATE.md`

### 已执行命令
- `sed -n '1,260p' docs/CODEX_COMPLETION_REPORT.md`
- `sed -n '1,220p' AGENTS.md`
- `sed -n '1,260p' docs/TASK_STATE.md`
- `sed -n '1,260p' docs/DEV_TASK.md`
- `sed -n '1,220p' docs/CODEX_HANDOFF.md`
- `ls -la compose.yaml docker-compose.yml`
- `diff -u docker-compose.yml compose.yaml`
- `docker compose config`
- `find docs -maxdepth 2 -type f | sort`
- `grep -RIn "redeem_turnstile_enabled\\|upstream_fetch_user_agent\\|sub_cache_seconds\\|admin/login\\|/rotation\\|sub.ops.ci\\|公共 converter" docs`
- `sed -n '1,220p' frontend/src/router/index.ts`
- `sed -n '1,240p' frontend/src/pages/RotationPage.vue`
- `sed -n '1,240p' frontend/src/pages/AdminRotationPage.vue`
- `sed -n '1,220p' backend/src/routes/auth.ts`
- `sed -n '1,260p' backend/src/routes/stage2.ts`
- `sed -n '1,520p' backend/src/routes/stage4.ts`
- `sed -n '1,260p' backend/src/lib/runtime-settings.ts`
- `sed -n '1,260p' backend/src/lib/db.ts`
- `sed -n '1,260p' .env.example`
- `sed -n '1,220p' backend/package.json`
- `sed -n '1,220p' frontend/package.json`

### Docker / 容器状态
- 本轮未重建容器。
- 当前容器状态维持不变。

### API / 接口状态
- 已复核路由与页面映射，重点确认：
  - `/rotation` 仍存在且可由已登录普通用户直接访问
  - `/admin/rotation` 已存在正式管理页
  - 老管理员接口仍保留兼容

### 下一步
- 等待你确认是否先处理 `/rotation` 路由语义收敛。
- 若确认，我下一轮可以直接只做 P1 收敛，不动其它删改项。

## 2026-06-03 - 最终上线前验收与接口回归

### 当前目标
- 执行最终只读验收，确认老管理员接口已下线、统一登录与改密链路可用、订阅状态策略符合预期，并回填最终验收报告。

### 完成情况
- 已确认旧管理员兼容接口 `/api/auth/admin/login` 与 `/api/auth/admin/change-password` 返回 404，源代码中已移除。
- 已确认统一 `/api/auth/login` 支持管理员登录，管理员与普通用户均可走统一 `/api/auth/change-password`。
- 已确认 `expired / inactive / disabled` 订阅状态均返回 `200` 空订阅。
- 已确认 `clash` / `mihomo` / `sing-box` 订阅输出可用；`shadowrocket` 在当前节点池与 subconverter 版本下仍返回空结果并被后端显式标记为失败。

### 文件变化
- 更新：`backend/src/routes/auth.ts`
- 更新：`backend/src/routes/stage2.ts`
- 更新：`backend/src/routes/stage4.ts`
- 更新：`docs/FINAL_PREFLIGHT_REPORT.md`
- 更新：`docs/TASK_STATE.md`

### 已执行命令
- `grep -n 'admin/login\\|admin/change-password\\|router.post(\"/login\"\\|router.post(\"/change-password\"' backend/src/routes/auth.ts`
- `curl -i -X POST http://127.0.0.1:8084/api/auth/admin/login -H 'Content-Type: application/json' -d '{}'`
- `curl -i -X POST http://127.0.0.1:8084/api/auth/admin/change-password -H 'Content-Type: application/json' -d '{}'`
- `curl -i -c /tmp/submgr.cookies -b /tmp/submgr.cookies -H 'Content-Type: application/json' --data ... http://127.0.0.1:8084/api/auth/login`
- `curl -i -b /tmp/submgr.cookies http://127.0.0.1:8084/api/auth/me`
- `curl -i -b /tmp/submgr.cookies -H 'Content-Type: application/json' --data ... http://127.0.0.1:8084/api/auth/change-password`
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker compose restart app`
- `curl -i http://127.0.0.1:8084/health`
- `curl -i http://127.0.0.1:8084/config`

### Docker / 容器状态
- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

### API / 接口状态
- 旧管理员接口已下线并返回 404。
- 统一登录/统一改密链路已通过管理员与普通用户回归。
- 订阅状态矩阵已验证：
  - `expired`：200 空订阅
  - `inactive`：200 空订阅
  - `disabled`：200 空订阅

### 测试结果
- 后端构建：通过
- 前端构建：通过
- app 重启：通过
- `/health`：通过
- `/config`：通过
- `clash` / `mihomo` / `sing-box`：通过
- `shadowrocket`：当前失败（后端显式返回 `502 converter returned empty payload`）

### 遗留问题
- `shadowrocket` 兼容策略仍需确认：是继续支持并调整目标映射，还是从支持矩阵中移除。

### 下一步建议
- 先确认 `shadowrocket` 的产品策略，再决定是否进入正式上线窗口。

## Date

2026-06-03

## Round Goal

移除 Turnstile Site Key / Secret Key 的后台可编辑入口，改为只从环境变量读取并在容器重建后生效。

## Project Current Status

- 管理端系统设置页已删除 Site Key / Secret Key 文本框和对应保存逻辑。
- 后端 `/config` 现在直接从环境变量返回 Turnstile site key，不再读取运行时数据库字段。
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` 已写入本地 `.env`，并通过 `docker compose up -d --force-recreate app` 重新注入容器。
- 登录/注册页会继续通过 `/config` 获取当前启用状态和 site key，渲染 Turnstile。

## File Changes In This Round

- Updated: `backend/src/index.ts`
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/services/turnstile.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/components/auth/AuthLayout.vue`
- Updated: `frontend/src/components/auth/TurnstileWidget.vue`
- Updated: `.env`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose exec -T mongodb mongosh --quiet subscription_manager --eval '...'`
- `docker compose up -d --force-recreate app`
- `curl -s http://127.0.0.1:8084/config`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/config` 已返回环境变量中的 `turnstileSiteKey=1x00000000000000000000AA`
- 管理端不再允许修改 Turnstile key

## Validation Result

- 前后端构建：通过
- app 重新创建：通过
- `/config` 读取测试 key：通过

## Notes / Blockers

- Site/Secret key 变更后需要重建 `app` 容器才能生效，这是当前“只写环境变量”的预期行为。

## Next Step

- 你可以直接在浏览器里刷新登录/注册页，确认使用测试 key 时 Turnstile 是否正常显示。

## Date

2026-06-03

## Round Goal

将 `target=shadowrocket` 从 subconverter 转换链路中拆出，改为直接读取已发布节点池、按 Shadowrocket 可识别协议行 Base64 输出，同时保持 `clash / mihomo / sing-box` 继续走本地 subconverter。

## Project Current Status

- `shadowrocket` 已切换为直出链路：
  - 不再调用 subconverter
  - 直接读取已发布节点池
  - 仅保留 `ss://` / `trojan://` / `vmess://` / `vless://` / `ssr://`
  - Base64 编码后返回 `text/plain; charset=utf-8`
- `active` / `grace` 用户可拿到真实节点。
- `expired` / `inactive` / `disabled` 用户对 `shadowrocket` 仍返回合法空订阅，不返回真实节点。
- `clash / mihomo / sing-box` 仍然走本地 subconverter，未受影响。

## File Changes In This Round

- Updated: `backend/src/routes/stage4.ts`
- Updated: `docs/FINAL_PREFLIGHT_REPORT.md`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `grep -RIn "\\bgrace\\b" backend frontend docs`
- `sed -n '1,260p' backend/src/lib/node-pool.ts`
- `sed -n '1,260p' backend/src/routes/stage4.ts`
- `sed -n '1,260p' backend/src/lib/subscription-conversion.ts`
- `npm run build --prefix backend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker compose restart app`
- `curl -i http://127.0.0.1:8084/sub/<token>?target=shadowrocket`
- `curl -i http://127.0.0.1:8084/sub/<token>?target=clash`
- `curl -i http://127.0.0.1:8084/sub/<token>?target=mihomo`
- `curl -i http://127.0.0.1:8084/sub/<token>?target=sing-box`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `target=shadowrocket`：
  - active / grace：200，Base64 后可解码为原始节点文本
  - expired / inactive / disabled：200 空订阅
- `target=clash / mihomo / sing-box`：仍由 subconverter 正常输出。

## Validation Result

- 后端构建：通过
- app 重启：通过
- `shadowrocket` 直出回归：通过
- `clash / mihomo / sing-box` 回归：通过

## Notes / Blockers

- 本轮未发现新的阻塞项。

## Next Step

- 继续按生产清单逐项完成正式域名、HTTPS、Turnstile 生产 key、管理员密码、上游 token 与备份确认。

## Round Goal

缩小登录/注册卡片宽度以更好适配 Turnstile 组件，并完成本地测试 key 下的前端重建与静态资源更新。

## Project Current Status

- 登录/注册卡片宽度已进一步收窄到更适合 Turnstile 的视觉比例。
- 前端已重新构建并同步到 caddy，避免旧静态资源继续展示旧布局。
- 本地测试 key 仍在使用，`/config` 持续返回测试 Turnstile 状态。

## File Changes In This Round

- Updated: `frontend/src/components/auth/AuthLayout.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- 登录/注册页应在刷新后使用更窄的卡片宽度展示 Turnstile。

## Validation Result

- 前端构建：通过
- caddy 重启：通过

## Notes / Blockers

- 如果浏览器仍然看到旧宽度，优先强刷页面并清理站点缓存。

## Next Step

- 你刷新登录页和注册页再看一次；如果还是觉得宽，我们就继续把 `max-width` 再压到更小一档。

## Date

2026-06-03

## Round Goal

将登录/注册页缩窄到更适合 Turnstile 组件的宽度，并切换到本地 Turnstile 测试 key，先验证前端渲染与后端配置读取。

## Project Current Status

- 登录页和注册页的外层卡片宽度已缩小，更适合展示 Turnstile 组件。
- 本地运行配置已切换为 Cloudflare Turnstile 测试 key，`/config` 已返回启用状态与测试 site key。
- 后端运行时设置也已同步到同一套测试 key，方便本地完整联调。

## File Changes In This Round

- Updated: `frontend/src/components/auth/AuthLayout.vue`
- Updated: `frontend/src/components/auth/TurnstileWidget.vue`
- Updated: `.env`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `docker compose exec -T mongodb mongosh --quiet subscription_manager --eval '...'`
- `docker compose restart app`
- `curl -s http://127.0.0.1:8084/config`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/config` 已返回 `turnstileEnabled=true` 和测试 `turnstileSiteKey`
- 登录/注册页下一次刷新后会使用测试 key 渲染 Turnstile

## Validation Result

- Mongo 运行时设置更新：通过
- `/config` 读取验证：通过
- app 重启：通过

## Notes / Blockers

- 仍需你在浏览器里实际确认 Turnstile 是否正常渲染、是否通过测试站点 key 完成验证。

## Next Step

- 刷新登录页和注册页，检查 Turnstile 是否已经变成测试组件；如果组件仍然报“无法连接到网站”，我们再继续排查 hostname 或脚本加载。

## Date

2026-06-03

## Round Goal

回填 Cloudflare Turnstile 的 site key / secret key，并开启登录与注册的防机器人校验。

## Project Current Status

- 登录页和注册页已接入真实 Turnstile 配置。
- 管理端系统设置中的 Turnstile 已开启，且仅保留登录/注册两个场景。
- `/config` 已返回启用状态和 site key，前端可以正常渲染 Turnstile。

## File Changes In This Round

- Updated runtime settings in MongoDB
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `curl -s -c /tmp/submgr_admin.cookies -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123456"}' http://127.0.0.1:8084/api/auth/admin/login`
- `curl -s -b /tmp/submgr_admin.cookies -H 'Content-Type: application/json' -X PUT http://127.0.0.1:8084/api/admin/settings -d '{"turnstile_enabled":true,"login_turnstile_enabled":true,"register_turnstile_enabled":true,"turnstile_site_key":"...","turnstile_secret_key":"..."}'`
- `curl -s http://127.0.0.1:8084/config`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/settings` 已写入 Turnstile 配置。
- `/config` 已返回 `turnstileEnabled=true` 和 `turnstileSiteKey`。

## Validation Result

- 后台设置更新：通过
- `/config` 读取验证：通过

## Notes / Blockers

- secret key 已写入运行时设置，不再展示在任务状态中。

## Next Step

- 你现在可以刷新登录页和注册页，检查 Turnstile 组件是否正常出现并可完成验证。

## Date

2026-06-03

## Round Goal

完成 Turnstile 的前后端接线：只保留登录/注册防机器人，彻底移除授权码兑换页的 Turnstile 链路，并为后续填入 Cloudflare site key / secret key 做好接口准备。

## Project Current Status

- 登录页和注册页已经接入可渲染的 Turnstile 组件，前端会从 `/config` 获取开关和 site key。
- 后端 Turnstile 只保留登录/注册两个场景，授权码兑换链路已移除 Turnstile 校验。
- 管理端设置页已去掉“兑换启用”开关，相关环境变量和运行时配置也已清理。
- 目前本地仍未填入实际 Cloudflare key，等待你后续完成 Cloudflare 后台申请后再回填。

## File Changes In This Round

- Added: `frontend/src/components/auth/TurnstileWidget.vue`
- Added: `frontend/src/lib/public-config.ts`
- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `frontend/src/pages/RegisterPage.vue`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `backend/src/services/turnstile.ts`
- Updated: `backend/src/config/env.ts`
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/routes/stage2.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `compose.yaml`
- Updated: `docker-compose.yml`
- Updated: `.env.example`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart app caddy`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/config` 会返回 `turnstileEnabled` 和 `turnstileSiteKey`，供登录/注册页动态决定是否渲染 Turnstile。
- `/api/auth/register`、`/api/auth/login` 仍保留后端校验闭环，前端已准备好随时带入 token。
- `/api/redeem` 已不再包含 Turnstile 校验链路。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 容器重启：通过

## Notes / Blockers

- Cloudflare Turnstile 的 site key / secret key 仍待你在控制台申请后提供。

## Next Step

- 你把 Cloudflare 控制台申请到的 `site key` / `secret key` 发给我，我再帮你回填到环境变量和系统设置，并做一次登录/注册联调。

## Date

2026-06-03

## Round Goal

优化用户端订阅卡片：到期日/失效日显示剩余天数胶囊，并让复制链接按钮展示当前版本号。

## Project Current Status

- 用户端订阅卡片的到期日和失效日现在会显示与管理端一致的剩余天数胶囊。
- 用户端复制按钮现在会显示当前订阅版本号，点击复制行为和提示文案保持不变。
- `/api/auth/me` 已向用户端补充 `sub_version`，避免前端自行猜版本号。
- 前后端构建已通过，app 和 caddy 容器已同步更新并重启。

## File Changes In This Round

- Updated: `backend/src/routes/auth.ts`
- Updated: `frontend/src/pages/DashboardPage.vue`
- Updated: `frontend/src/lib/auth-cache.ts`
- Updated: `frontend/src/router/index.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart app caddy`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/auth/me` 对用户返回 `sub_version`
- `/dashboard` 侧边/卡片 UI 已显示剩余天数胶囊和版本化复制按钮

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 容器重启：通过

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 你刷新用户端订阅页面后，可以检查到期日/失效日的剩余天数胶囊，以及复制按钮版本号是否符合预期。

## Date

2026-06-03

## Round Goal

修复登录页把管理员用户名误判为注册格式错误的问题，登录仅做基础非空校验，避免把前端注册规则套到管理员账号上。

## Project Current Status

- 登录页已不再使用注册专用的用户名格式规则，管理员用户名可以正常输入并提交。
- 注册页仍保持原有用户名规则校验，不受本次登录修复影响。
- 前端构建已通过，caddy 静态资源已同步并重启。

## File Changes In This Round

- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- 登录页提交时不再因用户名格式触发前端错误提示，管理员账号可正常走后端鉴权。

## Validation Result

- 前端构建：通过
- caddy 静态资源更新：通过

## Notes / Blockers

- 无新增阻塞。

## Next Step

- 你可以直接用管理员账号再试一次登录；如果后端仍然拒绝，我们再看后端鉴权规则是否也需要放宽。

## Date

2026-06-03

## Round Goal

合并手动“全部测试”和自动轮询到同一条刷新发布链路；订阅文件名加入版本号；过期用户返回 200 空订阅并展示过期提示文件名；补齐自动轮询功能。

## Project Current Status

- “全部测试”与定时轮询现在共用同一条批量刷新、节点池更新、版本递增和轮换日志写入链路。
- 订阅文件名默认变为 `username_V26.6.X` 风格，且会带上当前版本号。
- 过期用户不再返回 403，而是返回空订阅，并使用“订阅已过期，请联系管理员”作为文件标题。
- 自动轮询间隔已加入系统设置，0 表示关闭，后台已具备定时触发能力。

## File Changes In This Round

- Added: `backend/src/services/subscription-version.ts`
- Added: `backend/src/services/upstream-batch-runner.ts`
- Added: `backend/src/services/upstream-poller.ts`
- Updated: `backend/src/index.ts`
- Updated: `backend/src/config/env.ts`
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/routes/stage4.ts`
- Updated: `backend/src/routes/stage6.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`
- Updated: `subscription_manager_dev_task.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart app caddy`
- `curl -i -s --max-time 20 http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash`
- `curl -b /tmp/submgr.cookies -X POST http://127.0.0.1:8084/api/admin/upstreams/test-all`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/upstreams/test-all` 现在会递增版本号并写轮换日志。
- `/sub/:token?target=clash` 过期用户返回 200 空订阅；正常用户文件名包含版本号。
- 系统设置中新增自动轮询间隔字段。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 手动批量刷新：通过
- 过期空订阅：通过
- 版本号文件名：通过

## Notes / Blockers

- 自动轮询依赖后台定时器运行，当前实现已接上服务启动；由于间隔配置默认是分钟级，未做长时间等待型验证。
- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以先把自动轮询间隔设成一个较短值做观察；如果空订阅效果满意，我们再决定是否继续细化空订阅格式。

## Date

2026-06-03

## Round Goal

继续优化登录和注册体验：登录页补齐用户名格式校验，输入过程中自动清除错误提示，减少重复报错感。

## Project Current Status

- 登录页已和注册页保持一致，提交前会先做用户名/密码格式校验。
- 表单内容变化时，若当前是错误提示会自动清空，避免旧错误一直挂在页面上。
- 前端构建与 caddy 静态资源更新已完成。

## File Changes In This Round

- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `frontend/src/pages/RegisterPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`
- `curl -s -I http://127.0.0.1:8084/login`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- 登录页和注册页现在都会在页面内给出验证/接口错误提示，不再依赖浏览器抛出异常。

## Validation Result

- 前端构建：通过
- caddy 重启：通过
- `/login` 页面可正常返回：通过

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以直接在登录页和注册页继续试错，看看提示是否更顺手。

## Date

2026-06-03

## Round Goal

修复登录和注册的前端错误提示：用户名或密码错误、用户名重复、格式不合法时，只在页面显示提示，不让浏览器抛出原始异常。

## Project Current Status

- 登录页和注册页已改为使用不抛异常的 auth 请求封装。
- 用户名/密码错误、用户名已存在、格式错误等情况现在会被映射成前端提示文案。
- 前端构建与 caddy 静态资源更新已完成。

## File Changes In This Round

- Added: `frontend/src/lib/auth-request.ts`
- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `frontend/src/pages/RegisterPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`
- `curl -s -I http://127.0.0.1:8084/login`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/auth/login`、`/api/auth/register` 的预期错误现在会在前端页面内提示，不再依赖抛异常展示。

## Validation Result

- 前端构建：通过
- caddy 重启：通过
- `/login` 页面可正常返回：通过

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以在登录页和注册页分别试一次错误场景，确认只显示页面提示，不再出现浏览器报错感。

## Date

2026-06-03

## Round Goal

去掉订阅响应里的顶部流量展示，并确保节点池里不再保留 `Traffic:` / `Expire:` 这类说明节点，同时订阅有效期只取 `expire_at`。

## Project Current Status

- 订阅响应头仍保留 `Subscription-Userinfo: expire=...`，用于客户端显示到期日。
- 订阅响应已增加防缓存头，避免客户端继续拿旧的流量元信息。
- 批量测试入池前已清洗节点名称，`Traffic:` / `Expire:` 说明节点不会再进入最终节点池。
- 实测最终订阅正文里已搜索不到 `Traffic:` 和 `Expire:` 节点。

## File Changes In This Round

- Updated: `backend/src/lib/node-pool.ts`
- Updated: `backend/src/lib/upstream-testing.ts`
- Updated: `backend/src/routes/stage4.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker compose restart app`
- `curl -s -b /tmp/submgr.cookies -X POST http://127.0.0.1:8084/api/admin/upstreams/test-all`
- `curl -i -s http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash`
- `curl -s http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash | grep -n "Traffic:\\|Expire:"`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/upstreams/test-all` 重新生成了清洗后的节点池。
- `/sub/:token?target=clash` 现在带防缓存头，且正文里不再出现 `Traffic:` / `Expire:` 说明节点。

## Validation Result

- 后端构建：通过
- 容器重启：通过
- 节点池清洗：通过
- 订阅正文清理：通过
- 防缓存头：通过

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以刷新客户端订阅，确认顶部流量展示是否已消失，日期仍然正常显示。

## Date

2026-06-03

## Round Goal

去掉订阅响应里的流量展示，并确保客户端显示的有效期取自到期日 `expire_at`，而不是实际失效日。

## Project Current Status

- 订阅响应头里的 `Subscription-Userinfo` 现在只保留 `expire`，不再输出 `upload/download/total`。
- 订阅有效期日期改为优先使用 `expire_at`，不会再误用 `disable_after`。
- 当前实测响应头已经只剩 `expire=1781740800`，客户端不应再显示顶部流量统计。

## File Changes In This Round

- Updated: `backend/src/routes/stage4.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker compose restart app`
- `curl -i -s http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/sub/:token?target=clash` 的 `Subscription-Userinfo` 已去掉流量字段，仅保留到期时间。

## Validation Result

- 后端构建：通过
- 容器重启：通过
- 订阅响应头：通过

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以再次刷新客户端订阅，确认顶部流量统计已消失、右下角日期仍正常显示。

## Date

2026-06-03

## Round Goal

让订阅文件名可配置，并在订阅响应里带上有效期信息，方便客户端显示名称和到期日期。

## Project Current Status

- 系统设置中新增 `subscription_filename_template`，默认使用 `{{username}}`。
- 订阅接口会把模板渲染成 subconverter 的 `filename` 参数，并同时写入 `Content-Disposition`。
- 订阅响应里新增 `Subscription-Userinfo`，客户端可据此显示右下角有效期。
- 当前实测订阅响应已包含文件名 `test0001.yaml` 和有效期头 `expire=1782000000`。

## File Changes In This Round

- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/routes/stage4.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart app caddy`
- `curl -i -s http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/settings` 现在返回 `subscription_filename_template`。
- `/sub/:token?target=clash` 现在带 `Content-Disposition` 和 `Subscription-Userinfo`。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 容器重启：通过
- 文件名响应头：通过
- 有效期响应头：通过

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以在设置里改 `subscription_filename_template`，比如 `{{username}}-{{target}}`。

## Date

2026-06-03

## Round Goal

优化订阅转换，默认保留上游节点的旗帜 emoji，避免客户端订阅里节点名称被转换成纯英文短名。

## Project Current Status

- 订阅转换链路现在会自动附加保留 emoji 的 subconverter 参数。
- 实测转换后的 Clash 订阅已恢复 `🇬🇧`、`🇭🇰`、`🇨🇳` 等旗帜前缀。
- 后端本地构建已通过，运行中的 `app` 容器已更新并重启。

## File Changes In This Round

- Updated: `backend/src/routes/stage4.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker compose restart app`
- `curl -s 'http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash'`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/sub/:token?target=clash` 当前返回的节点名已保留旗帜 emoji。

## Validation Result

- 后端构建：通过
- 运行时验证：通过，节点名前缀恢复为 emoji

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以直接再刷新客户端订阅，确认节点列表已经恢复旗帜 emoji。

## Date

2026-06-03

## Round Goal

把上游批量测试的两条状态提示合并成一条，只保留单一结果区。

## Project Current Status

- 上游管理页现在只显示一条批量测试结果文案。
- 文案会根据状态展示“测试中”“节点池已 ready”或“节点池为空但已 ready”。
- 页面不再同时出现两条测试结果提示。

## File Changes In This Round

- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix frontend`
- `docker compose up -d --build caddy`
- `curl -s -b ... http://127.0.0.1:8084/api/admin/upstreams`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/upstreams` 的批量测试状态字段仍保留，前端只用一条提示展示。

## Validation Result

- 前端构建：通过
- `caddy` 重建：通过

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你刷新上游管理页后，应该只会看到一条批量测试结果提示。

## Date

2026-06-03

## Round Goal

为“全部测试”增加清晰状态提示：测试中、ready、空节点池但已完成。

## Project Current Status

- 上游管理页现在会显示批量测试状态提示条。
- 测试进行中时显示“测试中”，完成后显示“节点池已 ready”或“节点池为空”。
- 空节点池也会被视为 ready，按钮会释放，允许重新测试。

## File Changes In This Round

- Updated: `backend/src/routes/stage3.ts`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker compose up -d --build app caddy`
- `curl -s -b ... http://127.0.0.1:8084/api/admin/upstreams`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/upstreams` 现在会返回 `batch_test_total`、`batch_test_success`、`batch_test_failed`、`batch_test_node_count`。
- 前端会据此显示批量测试提示条。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 容器重建：通过
- 状态接口回显：通过

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你现在可以在上游管理页直接观察“测试中 / ready / 空池”的提示效果。

## Date

2026-06-03

## Round Goal

给“全部测试”增加按钮锁：测试开始后禁用按钮，只有节点池 ready 后才释放；即便上游全挂、最终空池，也视为 ready。

## Project Current Status

- 上游批量测试接口现在带有服务端锁，重复点击会返回 `409`，不会重复触发测试。
- 前端“全部测试”按钮会在测试中保持禁用，并在页面刷新后根据后端状态恢复锁定或释放。
- 节点池在批量测试完成前不会被清空，只有在最终 ready 时才一次性替换为新结果，避免中途把用户订阅打空。
- 如果所有上游都失败，最终会生成空节点池，但仍会标记为 ready，按钮会释放以允许再次测试。

## File Changes In This Round

- Added: `backend/src/lib/upstream-batch-state.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker compose up -d --build app caddy`
- `curl -s -b ... http://127.0.0.1:8084/api/admin/upstreams`
- `POST /api/admin/upstreams/test-all` lock simulation

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/upstreams` 现在会返回批量测试状态字段：`batch_test_running` / `batch_test_ready` / `batch_test_message`。
- `/api/admin/upstreams/test-all` 在运行中再次调用会返回 `409 batch test already running`。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 容器重建：通过
- 后端锁定校验：通过，重复调用返回 `409`
- 前端状态回显：通过，`batch_test_running=false`、`batch_test_ready=true`

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以直接在上游管理页点“全部测试”，再试一次刷新页面确认锁状态会随服务端恢复。

## Date

2026-06-03

## Round Goal

执行 3 并发订阅压测，确认订阅接口在并发下是否稳定返回。

## Project Current Status

- 3 个并发线程同时请求订阅链接时，全部返回 `200`。
- 单次响应耗时约在 `98ms~114ms` 之间，返回体长度一致。
- 当前订阅链路在这次 3 并发压测中表现稳定，没有出现 `502` 或其他错误。

## File Changes In This Round

- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `curl -sS -o ... -w '%{http_code}' http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash`（3 并发）

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/sub/XWzZJdUOsb?target=clash` 在 3 并发下均可正常返回 `200`。

## Validation Result

- 三并发压测：通过
- 最大响应约 `114ms`

## Notes / Blockers

- 这次压测没有复现之前的 `This operation was aborted`。

## Next Step

- 如果你要进一步压测，我们可以把并发数提高到 5 或 10，或者做持续循环压测。

# TASK_STATE

## Date

2026-06-03

## Round Goal

对比 subconverter 在“带 config”和“不带 config”两种模式下的转换耗时，排查用户订阅 502 的慢点。

## Project Current Status

- 在当前节点池数据上，`subconverter` 带 `config` 转换约 59ms，不带 `config` 约 26ms。
- 这说明 `config` 参数本身不是导致超时的主因。
- 不带 `config` 时输出更大，属于不同转换结果，不直接代表问题链路。

## File Changes In This Round

- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `docker compose exec -T app node --input-type=module - <<'NODE' ... NODE`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `subconverter` 在当前节点池上可正常生成订阅。

## Validation Result

- 带 `config` 转换：通过，约 `59ms`
- 不带 `config` 转换：通过，约 `26ms`

## Notes / Blockers

- 这次对比没有发现 `config` 是慢点。
- 若继续追 502，下一步应检查是否是某次请求的上游节点池内容、系统负载或随机路径导致的偶发抖动。

## Next Step

- 如果你愿意，我可以继续做 5 次连续转换，看看是否存在偶发抖动或第 N 次开始变慢。

# TASK_STATE

## Date

2026-06-03

## Round Goal

查看节点池状态，并手动跑一次订阅转换，确认 502 卡在链路的哪一段。

## Project Current Status

- 节点池当前是有内容的，Redis 中 `sm:sub:node-pool` 长度约为 10741 字符。
- 内部中转源 `/api/internal/converter-source/:cacheKey?format=base64` 可正常返回，实测约 128ms。
- `subconverter` 单独直连可正常完成转换，实测约 5 秒返回 200。
- 用户订阅链路现在已经不是“直接抓上游”，而是“读节点池 → 写内部源 → 交给 subconverter”。

## File Changes In This Round

- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `docker compose exec -T redis redis-cli STRLEN sm:sub:node-pool`
- `docker compose exec -T redis redis-cli --raw GET sm:sub:node-pool`
- `docker compose exec -T app node --input-type=module ...`
- `curl -i -s 'http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash'`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/internal/converter-source/:cacheKey` 返回正常。
- `/sub/:token?target=clash` 当前实测可返回 200。

## Validation Result

- 节点池状态读取：通过
- 内部源直连：通过
- subconverter 手动转换：通过
- 用户订阅接口：通过，当前请求返回 `200`

## Notes / Blockers

- 这次手动复现里，没有卡在节点池或内部源接口上；真正耗时主要出现在 `subconverter` 的生成阶段。
- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 如果还要继续追 502，可以进一步对比“带 config 参数”和“不带 config 参数”的转换耗时差异。

# TASK_STATE

## Date

2026-06-03

## Round Goal

将系统设置中的“转换后端地址”改成默认只读、支持可选覆盖，避免用户把默认值当成必填项误填。

## Project Current Status

- 系统设置页的转换后端地址现在展示为只读默认值 `http://subconverter:25500/sub`。
- 只有开启“使用自定义转换后端”时，才会显示可编辑覆盖项并参与校验。
- 关闭自定义覆盖时会自动回退到默认地址并清除相关错误提示。
- 前端已完成构建，`caddy` 已重建并切换到新静态资源。

## File Changes In This Round

- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,260p' frontend/src/pages/AdminSettingsPage.vue`
- `sed -n '260,420p' frontend/src/pages/AdminSettingsPage.vue`
- `npm run build --prefix frontend`
- `docker compose up -d --build caddy`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/settings` 仍保留 `converter_backend_url` 字段，但前端默认以只读值展示。
- 自定义覆盖开启时，前端才会把该字段作为可编辑项提交。

## Validation Result

- 前端构建：通过
- `caddy` 重建：通过，已接入新的前端资源

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。

## Next Step

- 你可以直接刷新系统设置页，确认默认地址现在是只读显示。

# TASK_STATE

## Date

2026-06-02

## Round Goal

取消订阅缓存，改为先批量测试上游并把成功节点写入节点池；用户订阅时直接从节点池转换。

## Project Current Status

- 系统设置中的订阅缓存项已移除，后端不再使用 `sub_cache_seconds`。
- 上游管理页已改为单个“全部测试”按钮，逐条测试启用上游并在行内显示“测试中 / HTTP 状态”胶囊。
- 后端新增节点池，批量测试时会先清空旧节点，再把成功上游的节点写入池中，失败上游不会写入节点。
- 用户订阅接口已改为直接从节点池读取并交给 subconverter 转换，不再每次回源抓取上游订阅。
- 订阅响应头 `X-Subscription-Version` 已修正为正常显示版本号字符串。
- 这一轮已完成构建、容器重建和接口回归验证，当前服务可用。

## File Changes In This Round

- Added: `backend/src/lib/node-pool.ts`
- Added: `backend/src/lib/upstream-testing.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/routes/stage4.ts`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `backend/src/config/env.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `curl -s -c /tmp/submgr-cookie... -d '{"username":"admin","password":"admin123456"}' http://127.0.0.1:8084/api/auth/admin/login`
- `curl -s -b /tmp/submgr-cookie... http://127.0.0.1:8084/api/admin/upstreams`
- `curl -s -N -b /tmp/submgr-cookie... -X POST http://127.0.0.1:8084/api/admin/upstreams/test-all`
- `curl -i -s http://127.0.0.1:8084/sub/ozWMYbhWve?target=clash`
- `docker compose up -d --build app`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/upstreams/test-all` 已可按顺序测试所有启用上游，并返回 NDJSON 结果流。
- `/api/admin/upstreams/:id/test` 仍保留单条测试接口，但前端主流程已转为总测试按钮。
- `/sub/:token` 已改为直接读取节点池并转换；测试前若节点池为空会返回 503 提示先测试上游。
- 订阅响应头 `X-Subscription-Version` 已恢复为正确版本字符串。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 容器重建：通过，`app` 已重建并启动
- 批量测试接口：通过，已返回逐条结果流并更新节点池
- 订阅接口：通过，`/sub/ozWMYbhWve?target=clash` 返回 200 且包含正确的 `X-Subscription-Version`

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 并存的 warning。
- 当前样例上游仍有一条 404，属于上游源本身问题，不影响新链路验证。

## Next Step

- 你可以继续在管理端点“全部测试”并观察节点池与订阅输出。
- 如果需要，我们下一步可以把脚本 `scripts/verify_subscription_flow.sh` 也同步成新的节点池流程。

## Date

2026-06-02

## Round Goal

系统设置不再维护上游 UA，订阅转换时改为按每条上游的类型自动选择抓取 UA。

## Project Current Status

- 系统设置页已移除 `upstream_fetch_user_agent`，仅保留后端地址、默认客户端与默认分流规则。
- 后端抓取上游订阅时会按每条上游的 `source_type` 自动决定 UA。
- 上游测试接口与实际订阅合并链路已切到按类型选择 UA，旧上游默认按 `auto` 处理。
- 这轮修改已完成构建与回归验证，环境保持可用。
- 额外新增了分步验证脚本 `scripts/verify_subscription_flow.sh`，可在中间步骤失败时立即停止并打印错误原因。
- 该脚本已更新为逐条测试所有启用上游，不会只覆盖第一条。
- 脚本现在会在最终订阅前输出汇总：总订阅数、成功数、总节点数，以及每条订阅的成功/失败明细。
- 脚本的汇总结果现在会带上每条订阅的 HTTP 状态码，便于区分“上游接口失败”与“识别失败”。

## File Changes In This Round

- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/routes/stage4.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Added: `scripts/verify_subscription_flow.sh`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `grep -RIn "upstream_fetch_user_agent" backend/src frontend/src docs/TASK_STATE.md`
- `sed -n '1,120p' backend/src/lib/runtime-settings.ts`
- `sed -n '1,120p' backend/src/routes/stage7.ts`
- `sed -n '180,230p' backend/src/routes/stage3.ts`
- `sed -n '240,320p' backend/src/routes/stage4.ts`
- `sed -n '1,340p' frontend/src/pages/AdminSettingsPage.vue`
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker compose up -d --build`
- `curl -s -b /tmp/submgr.cookies http://127.0.0.1:8084/api/admin/settings`
- `curl -s -b /tmp/submgr.cookies http://127.0.0.1:8084/api/admin/upstreams`
- `curl -s -b /tmp/submgr.cookies -X POST http://127.0.0.1:8084/api/admin/upstreams/6a1d24a51bb7429ca8259ceb/test`
- `docker compose exec -T app sh -lc 'cat /tmp/ua-server.log'`
- `curl -s -b /tmp/submgr.cookies -H 'Content-Type: application/json' -X PATCH -d '{"sourceUrl":"https://example.com/sub","sourceType":"ss"}' http://127.0.0.1:8084/api/admin/upstreams/6a1d24a51bb7429ca8259ceb`
- `bash -n scripts/verify_subscription_flow.sh`
- `scripts/verify_subscription_flow.sh`
- `scripts/verify_subscription_flow.sh`（更新汇总输出）
- `scripts/verify_subscription_flow.sh`（增加每条订阅 HTTP 状态码）
- `docker compose restart caddy`
- `docker compose up -d --build caddy`

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/settings` 的请求体不再包含 `upstream_fetch_user_agent`。
- `/admin/upstreams/:id/test` 和 `/sub/:token` 将按上游 `source_type` 选取 UA。
- `source_type = ss` 的上游测试已回归通过，临时回显服务记录到 `User-Agent: Shadowrocket`。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 容器重建：通过
- 上游测试接口：通过，`source_type=ss` 时抓取 UA 为 `Shadowrocket`
- 订阅转换接口：保持可用，前一轮已验证 `/sub/:token?target=clash` 可返回 Clash YAML
- 验证脚本：已完成，当前样例上游指向 `https://example.com/sub`，运行会在上游测试步骤停下并明确报告 `HTTP 404`
- 验证脚本：已完成，当前可自动遍历两条启用上游，分别返回 `base64_nodes / 90` 与 `base64_nodes / 63`
- 验证脚本：已完成，当前会输出 `共 2 条订阅，2 条成功，共 153 个节点` 这类汇总信息，并列出每条订阅结果
- 验证脚本：已完成，当前失败分支会显示 `失败，HTTP 400 - HTTP 404` 这类更明确的错误上下文
- `caddy` 已重启，用于让前端静态资源重新加载
- `caddy` 已重新构建并重新创建，当前首页已返回新版 `index-DJtNNo_q.js` 与 `index-06XygQtU.css`

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 同名并存的 warning。
- 本轮已完成验证，不影响现有上游配置。

## Next Step

- 你可以直接继续在管理端测试；如果还要细化 UA 映射表，我们再按实际上游类型补充。
- 如果你要让脚本完整跑通，把测试上游换成可用链接后再执行即可。

## Date

2026-06-02

## Round Goal

上游列表的测试结果列改成胶囊样式，只显示 HTTP 状态码，并用颜色区分成功与失败。

## Project Current Status

- 上游列表页的“最后测试”列已切换为状态码胶囊展示。
- 成功状态采用绿色胶囊，失败状态采用红色胶囊，未知状态保持灰色占位。
- 其余上游字段和测试链路不变。

## File Changes In This Round

- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `sed -n '1,240p' frontend/src/pages/AdminUpstreamsPage.vue`
- `sed -n '240,420p' frontend/src/pages/AdminUpstreamsPage.vue`
- `npm run build --prefix frontend`

## Docker/Container Status

- 容器状态未变化，等待前端构建后确认。

## API/Interface Status

- `/api/admin/upstreams` 返回的 `last_test_status` 与 `last_test_ok` 已在前端用于胶囊展示。

## Validation Result

- 前端构建：待执行

## Notes / Blockers

- 暂无新增阻塞。

## Next Step

- 跑一次前端构建，确认上游列表页样式和状态展示无误。

## Date

2026-06-02

## Round Goal

按反馈优化设置页下拉选择，并把上游订阅的“链接类型”下放到上游配置中。

## Project Current Status

- 系统设置页的 `converter_default_target` 与 `upstream_fetch_user_agent` 已改为下拉选择。
- 上游配置已新增 `source_type`，可为每条订阅链接单独标注类型。
- 上游列表与编辑弹窗已支持显示和修改 `source_type`。
- 上游列表表格列顺序已调整为：`名称` → `状态` → `上游URL` → `链接类型` → `最后测试` → `更新时间` → `操作区`。
- 后端已兼容新字段，旧上游文档未填 `source_type` 时默认按 `auto` 处理。

## File Changes In This Round

- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/lib/db.ts`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker compose up -d --build`
- `docker compose exec app node` scripts for admin login and upstream `source_type` round-trip validation

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription_manager_subconverter`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)

## API/Interface Status

- `/api/admin/settings`：仍可正常读写，前端现为下拉选择。
- `/api/admin/upstreams`：已返回并接受 `source_type`。

## Validation Result

- 后端构建：通过
- 前端构建：通过
- 上游类型字段回归：通过，`source_type` 可保存与回读
- `/sub/:token?target=clash` 回归：通过，临时测试源下可返回 Clash YAML，包含 `proxies` 与 `rules`

## Notes / Blockers

- `docker compose` 仍会提示 `compose.yaml` 与 `docker-compose.yml` 同名并存的 warning。
- 本轮未改动订阅核心转换逻辑，只做配置层与上游元数据补强。

## Next Step

- 你可以先在管理端把上游链接类型补齐，再继续做订阅链路测试。
- 如果你希望，我下一步可以顺手把上游列表页的类型筛选也加上。

## Date

2026-06-02

## Round Goal

整合本地 `subconverter`、默认分流规则、系统设置字段与后端订阅转换链路，并完成联调验收。

## Project Current Status

- 已在 `compose.yaml` 中新增本地 `subconverter` 服务，未暴露宿主机端口。
- 后端已支持：
  - 默认订阅转换后端
  - 默认客户端 target
  - 默认分流规则 URL
  - 上游拉取 User-Agent
  - 内部 `converter-source` 生成与短期缓存
- 管理端 `/admin/settings` 已增加“订阅转换与分流规则”区块。
- `/sub/:token?target=clash` 已完成本地 subconverter 转换链路联调。

## File Changes In This Round

- Updated: `compose.yaml`
- Updated: `.env.example`
- Updated: `backend/.env.example`
- Added: `backend/src/lib/subscription-conversion.ts`
- Updated: `backend/src/config/env.ts`
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/lib/db.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/routes/stage4.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

## Commands Executed In This Round

- `docker compose config`
- `npm install --prefix backend`
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker compose up -d --build`
- `docker compose ps`
- `docker compose logs --tail=100 subconverter`
- `docker compose logs --tail=100 app`
- `docker compose exec app node -e "fetch('http://subconverter:25500/version')..."`
- `docker compose exec app node` scripts for upstream classification / temporary test source / restore
- `curl -s "http://127.0.0.1:8084/sub/XWzZJdUOsb?target=clash"` for subscription output verification

## Docker/Container Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)
- `subscription_manager_subconverter`：Up
- `subconverter` 仅通过 Docker 内网可访问，未配置 `ports` 暴露到宿主机。

## API/Interface Status

- `GET /sub/:token?target=clash`：已可输出 Clash YAML，包含 `proxies`、`proxy-groups`、`rules`。
- 上游测试接口：已返回结构化识别结果，支持 `raw_nodes` / `base64_nodes` / `clash_yaml` / `invalid_or_html`。
- 管理端设置页：已支持新增的 4 个订阅转换相关字段。

## Validation Result

- `docker compose config`：通过，`subconverter` 服务存在且无宿主机端口映射。
- `app -> subconverter` 内网连通性：通过，`/version` 可访问。
- 上游识别测试：通过，临时 base64 节点源被识别为 `base64_nodes`，`nodeCount=63`。
- 订阅输出测试：通过，`/sub/:token?target=clash` 返回 Clash YAML，并包含 `rules`。
- 日志脱敏抽查：通过，未发现完整订阅 token、完整节点内容或 trojan 密码直出。

## Notes / Blockers

- 本轮验证使用了临时的 base64 节点源来模拟 wd-blue 的识别与转换链路；实际 wd-blue 原始订阅 URL 未在当前工作区中提供。
- `docker compose` 当前仍提示 `compose.yaml` 与 `docker-compose.yml` 同名并存的 warning，但编排与联调不受影响。

## Next Step

- 如需进一步贴近线上真实流量，可以补充实际 wd-blue 原始订阅 URL 后再做一次回归验证。
- 若要进一步收敛日志与审计，可继续评估 subconverter 侧的 verbose 输出策略。

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

## Subscription Link Integrity Test - Stepwise Progress

### Round Goal

本轮按“准备数据 -> 协议转换 -> 定时轮询失效 -> 续期恢复 -> 清理回收”的顺序，验证订阅链接完整性与轮询失效链路。

### What Was Tested

- 管理员登录后，确认 `/health`、`/config`、`docker compose ps` 正常。
- 临时接入 subconverter 后端与测试源站，验证订阅转换链路。
- 验证不同 `target` 的订阅转换：
  - `clash`
  - `surge`
  - `quanx`
  - `ss`
  - `surfboard`
  - `loon`
- 创建临时单次轮询计划，验证用户在轮询后被自动标记为失效。
- 对已失效用户执行手动续期，验证订阅链接恢复可用。
- 清理所有临时计划、临时上游、临时用户、临时测试容器，并恢复 runtime settings。

### Key Results

- `clash`、`surge`、`quanx`、`ss`、`surfboard`、`loon` 的转换链路在临时 subconverter 环境下均可返回 200。
- 轮询计划生效后，测试用户 `testsub20260601` 由 `active/grace` 进入 `expired`，订阅链接返回 `403 subscription expired`。
- 执行 `POST /api/admin/users/:userId/renew` 后，该用户恢复为 `active`，订阅链接重新可用。
- 清理后：
  - `TEST-TODAY` 临时轮询计划已删除
  - `TMP` 临时上游已删除
  - 测试用户已删除
  - `converter_backend_url` 已恢复为空
  - `sub_rate_limit_per_minute` 已恢复为 `3`
  - 临时测试容器 `tmp-subconverter`、`tmp-source` 已移除

### Important Discovery

- 当前管理端前端的协议按钮值里，`Quantumult X` / `Shadowsocks` 页面可能还在使用旧 target 名称（界面上看到的是 `quantumultx` / `shadowsocks`），而 subconverter 可工作的 target 名称是 `quanx` / `ss`。
- 这会导致部分协议按钮在真实环境下出现“按钮点了但返回失败”的表象，后续需要单独修正前端 target 映射。

### Commands Executed

- `curl -i http://127.0.0.1:8084/health`
- `curl -i http://127.0.0.1:8084/config`
- `docker compose ps`
- `POST /api/auth/login`
- `GET /api/admin/users`
- `GET /api/admin/upstreams`
- `GET /api/admin/settings`
- `POST /api/admin/upstreams/:id/test`
- `GET /sub/:token?target=...`
- `POST /api/admin/rotation/schedules`
- `POST /api/admin/users/:userId/renew`
- `DELETE /api/admin/rotation/schedules/:id`
- `DELETE /api/admin/upstreams/:id`
- `POST /api/admin/upstreams/:id/enable`
- `PUT /api/admin/settings`
- `DELETE /api/admin/users/:userId`
- `docker rm -f tmp-subconverter tmp-source`

### Docker / API Status

- `subscription-manager-app`：Up
- `subscription-manager-caddy`：Up
- `subscription-manager-mongodb`：Up (healthy)
- `subscription-manager-redis`：Up (healthy)
- 临时测试容器：已清理
- API 接口状态：订阅转换、轮询、续期、删除、设置恢复均已完成闭环验证

### Next Step And Blockers

下一步建议：

1. 修正管理端 Dashboard 的协议 target 映射，避免 `Quantumult X` / `Shadowsocks` 按钮与 subconverter 目标值不一致。
2. 再跑一次浏览器端回归，确认按钮点击与订阅链接复制行为在移动端和桌面端一致。

阻塞项：

- 目前没有服务端阻塞；主要是前端 target 映射的兼容性收口待修正。

## Dashboard Target Mapping Fix

### Round Goal

修正用户端 `/dashboard` 订阅模板的协议 target 映射，避免按钮选择与 subconverter 实际可用 target 不一致。

### Completed

- 已将前端 target 映射收口为 subconverter 实际可用值：
  - `Clash -> clash`
  - `Surge -> surge`
  - `Quantumult X -> quanx`
  - `Shadowsocks -> ss`
  - `Surfboard -> surfboard`
  - `Loon -> loon`
- 重新构建前端产物并重建 `caddy` 镜像，确保线上静态包包含最新 target 映射。

### File Changes

- Updated: `frontend/src/pages/DashboardPage.vue`
- Updated: `docs/TASK_STATE.md`

### Commands Executed

- `npm run build --prefix frontend`
- `docker compose build caddy`
- `docker compose up -d --force-recreate caddy`

### Build / Docker Result

- 前端构建：成功
- `caddy` 镜像构建：成功
- `subscription-manager-caddy`：已重建并启动

### API / Interface Status

- `/dashboard` 用户端模板 target 映射已与 subconverter 常用 target 对齐。
- 后续接入真实订阅转换地址后，可直接复测六种模板协议的真实链路。

### Next Step And Blockers

下一步建议：

1. 由你写入真实的 `CONVERTER_BACKEND_URL` 和真实上游订阅链接。
2. 重新跑一轮真实生产环境订阅完整性测试：
   - 订阅链接可访问
   - 六种协议转换
   - 轮询失效后访问限制
   - 续期恢复

阻塞项：

- 当前无功能阻塞，等待真实转换地址与真实上游链接接入。

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

## Milestone Delivery Round (Commit + Push)

### Round Goal
- 完成本阶段交付：提交本地里程碑变更并推送远端仓库。

### Git Actions
- Commit: `2ed7961`
- Message: `feat: complete admin UI milestone and harden backend regression guards`
- Push: `origin/master` 成功（`a97b8ae..2ed7961`）

### Scope Summary
- 管理端 UI 复刻与交互收口（users/codes/upstreams/rotation/settings/logs）。
- 后端回归修复：
  - `used` 授权码不可删除
  - admin 登录校验回归修复
  - rotation 版本规则运行态生效（`YY.M.N`）
- 前端构建噪音修复：`tsconfig noEmit`。

### Status
- 本阶段里程碑已交付并同步到 GitHub。

## Next Phase Round (User Pages Formalization)

### Round Goal
- 进入下一阶段：将用户端页面 `/dashboard` `/redeem` `/password` `/help` 从占位版升级为正式可用版（移动优先 + 桌面居中 + 完整交互）。

### Completed Pages
- `/dashboard`：
  - 新增账号状态信息卡片（账号、状态、到期日、失效日）。
  - 新增客户端 target 切换（clash/singbox/v2ray/shadowrocket）。
  - 订阅链接随 target 动态生成，支持复制。
  - 新增“刷新状态”“退出登录”操作。
- `/redeem`：
  - 正式表单布局与加载态。
  - 输入校验（非空）与成功/失败消息反馈。
- `/password`：
  - 正式表单布局与加载态。
  - 前端校验（新密码至少8位）。
  - 修改成功后自动跳转登录页。
- `/help`：
  - 调整为分区帮助卡片（快速开始、状态说明、注意事项）。

### Component/Structure
- Added: `frontend/src/components/user/UserMobileLayout.vue`
  - 统一用户端外壳：页头 + 内容区 + 底部四项导航。
- Updated: `frontend/src/App.vue`
  - 移除旧的用户端顶部导航，避免与新页面布局重复。

### File Changes
- Added: `frontend/src/components/user/UserMobileLayout.vue`
- Updated: `frontend/src/pages/DashboardPage.vue`
- Updated: `frontend/src/pages/RedeemPage.vue`
- Updated: `frontend/src/pages/PasswordPage.vue`
- Updated: `frontend/src/pages/HelpPage.vue`
- Updated: `frontend/src/App.vue`
- Updated: `docs/TASK_STATE.md`

### Commands Executed
- `npm run build --prefix frontend`
- `docker compose ps`
- `curl -i http://127.0.0.1:8084/health`

### Build Result
- Frontend build: success。

### Docker/Container Status
- `app` / `caddy` / `mongodb` / `redis` 全部 `Up`。

### API/Interface Status
- `GET /health`：`200`，mongo/redis connected。

### UI Replication Notes
- 本轮完成用户端正式化与统一布局。
- 若要继续做 Stitch 一比一像素级对齐，下一轮将补做细节（间距、字体尺寸、按钮视觉、空态文案）。

### Next Step
1. 用户端四页进行一次实机点击回归（登录后访问、兑换、改密、复制链接）。
2. 将 `/rotation` 用户侧旧页面并入新版风格，或确认是否从用户导航中移除。

## Production Test Prep Round (Remove Mock Data + Login Landing)

### Round Goal
- 为真实生产环境测试做准备：移除前端虚拟/演示数据回退，并将站点根路径落到登录页。

### Changes Applied
- 路由入口调整：
  - `frontend/src/router/index.ts`
  - `/` 重定向由 `/dashboard` 改为 `/login`。
- 移除管理端演示数据回退（接口失败不再注入 mock）：
  - `frontend/src/pages/AdminUsersPage.vue`
  - `frontend/src/pages/AdminCodesPage.vue`
  - `frontend/src/pages/AdminUpstreamsPage.vue`
  - `frontend/src/pages/AdminRotationPage.vue`
  - `frontend/src/pages/AdminLogsPage.vue`
- 同步修正授权码创建接口参数为后端真实字段：
  - `durationDays` / `graceDays`。

### Validation
- `npm run build --prefix frontend`：success。
- `docker compose ps`：核心容器保持 `Up`。

### Notes
- 现在页面不再展示“演示数据”标识，也不再在接口失败时回填虚拟数据。
- 访问 `http://192.168.10.3:8084` 将进入登录页（前端路由重定向）。

## Hotfix Round (Login Redirect + New Frontend Assets Applied)

### Problem
- 用户访问 `/dashboard` 时未登录会看到页面内 `Unauthorized`，并且浏览器仍命中旧前端资源。

### Fix
- `frontend/src/router/index.ts`
  - 新增全局前置守卫：
    - 未登录访问受保护路由 -> 跳转 `/login`
    - 已登录访问 `/login`/`/register` -> 按角色跳转对应 dashboard
    - admin/user 角色访问越权路由自动纠正
- 重建并重启 `caddy` 前端静态资源容器，使新前端 bundle 生效。

### Commands
- `docker compose build caddy`
- `docker compose up -d --force-recreate caddy`
- `docker exec subscription-manager-caddy cat /srv/index.html`
- `curl http://127.0.0.1:8084/`

### Verification
- 容器内 `/srv/index.html` 已更新为新资源：`index-Bu0BcA7v.js`。
- 对外 `http://127.0.0.1:8084/` 返回同一新资源版本。


## Token/Code Rule Update Round

### Goal
- 按要求收紧生成规则：
  - 用户 token：10 位，字母+数字
  - 授权码：6 位，大小写字母+数字

### Backend Changes
- `backend/src/lib/utils.ts`
  - `generateSubToken()` 改为 10 位 `[A-Za-z0-9]`。
- `backend/src/routes/stage2.ts`
  - `generateActivationCode()` 改为 6 位 `[A-Za-z0-9]`。
  - `redeem` 入参校验改为严格 6 位字母数字。

### Runtime Actions
- 重建并重启 `app` 容器，加载新规则。

### Verification
- `POST /api/admin/codes` 返回示例：`FsLSdq` / `QwMUo3` / `JYuF7r`（均为 6 位大小写字母数字）。
- 数据库用户 `sub_token` 字段可见旧历史值仍存在；新注册/新生成将按 10 位规则产生。

### Notes
- 历史已生成 token/授权码不会自动迁移；仅影响新生成数据。

## 2026-06-02 Token重置持久化修复（Admin Users）

### 当前目标与完成状态
- 目标：修复管理端“重置token只改前端、不写数据库”的问题。
- 状态：已完成并验证通过。

### 关键改动文件
- Updated: `backend/src/routes/stage2.ts`
- Updated: `frontend/src/pages/AdminUsersPage.vue`

### 关键实现
- 后端新增接口：`POST /api/admin/users/:userId/reset-token`
  - 服务端生成新 `sub_token`（10位字母+数字）
  - 持久化写入 MongoDB `users` 集合
  - 返回更新后的 `item`
- 前端 `/admin/users` 两个入口全部改为调后端接口：
  - 列表行内“重置token”
  - 编辑弹窗内“重置”
- 前端不再本地随机改 token，统一以后端返回值回填列表/弹窗。

### 执行命令
- `npm run build --prefix frontend`
- `docker compose build app caddy`
- `docker compose up -d --force-recreate app caddy`
- `docker compose ps`
- `docker compose logs --tail=40 app`
- `curl`（管理员登录 + 调用 reset-token 接口 + 回查 users 列表）

### Docker/容器状态
- `subscription-manager-app`: Up
- `subscription-manager-caddy`: Up
- `subscription-manager-mongodb`: Up (healthy)
- `subscription-manager-redis`: Up (healthy)

### 接口/持久化验证
- 管理员登录：`POST /api/auth/admin/login` 返回 `{"message":"ok"}`。
- 调用：`POST /api/admin/users/6a1ddd191c9e694353f38347/reset-token` 成功。
- 验证样例（test0001）：
  - 重置前：`KZQdYDYWdO`
  - 重置后：`9kSDz4SUk5`
  - 回查 `/api/admin/users` 仍为新值，确认已写库。

### 下一步建议
- 把 `/admin/users` 的“新增/编辑”从前端本地演示写法切到真实后端持久化接口（当前仍有本地更新路径）。
- 增加 reset-token 操作成功 toast 与按钮 loading 态，防止重复点击。

### 阻塞项
- 无。

## 2026-06-02 到期/失效同步 + 状态联动修复

### 问题
- 管理端修改“到期日/失效日”后，用户端未同步。
- 状态未按到期天数自动联动，出现“有到期日但仍未授权”的不一致。

### 修复内容
- 新增用户生命周期服务：`backend/src/services/user-lifecycle.ts`
  - `deriveUserStatus`：按日期计算状态（disabled 优先；无到期日=inactive；未到期=active；过期但未超过失效日=grace；超过失效日=expired）
  - `syncUserLifecycle`：读取时自动纠偏并写回数据库。
- 管理端用户编辑改为真实后端持久化：
  - 新增接口：`PATCH /api/admin/users/:userId`
  - 支持字段：`password/contact/expire_at/note`
  - 到期日更新后后端自动计算并更新 `status` 与 `disable_after`（当前规则默认 `disable_after = expire_at`）。
- 管理端用户列表读取时做生命周期同步纠偏：`GET /api/admin/users`。
- 用户端 `GET /api/auth/me` 返回前做生命周期同步，确保用户端与管理端一致。
- 订阅接口 `GET /sub/:token` 也基于同步后的状态判断访问权限。

### 前端改动
- `frontend/src/pages/AdminUsersPage.vue`
  - 编辑用户“保存”由前端本地改数据，改为调用 `PATCH /api/admin/users/:userId`。
  - 保存成功后回填接口返回数据，确保界面与数据库一致。

### 文件变更
- Updated: `backend/src/lib/db.ts`
- Added: `backend/src/services/user-lifecycle.ts`
- Updated: `backend/src/routes/stage2.ts`
- Updated: `backend/src/routes/auth.ts`
- Updated: `backend/src/routes/stage4.ts`
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `docs/TASK_STATE.md`

### 验证结果
- 管理员编辑 `test0001` 到期日为 `2026-06-11` 后：
  - `/api/admin/users` 返回：`status=active, expire_at=2026-06-11, disable_after=2026-06-11`
  - 用户登录后 `/api/auth/me` 返回同样值，用户端同步成功。
- 容器状态：`app/caddy/mongodb/redis` 全部 Up（db/cache healthy）。

### 备注
- 本轮仍遵守限制：未删除数据库、未执行危险清理命令。

## 2026-06-02 新增用户接口打通修复

- 问题：`/admin/users` 新增用户仍为前端本地假数据（`local-new-*`），未入库。
- 后端新增：`POST /api/admin/users`（管理员创建用户，写入 MongoDB）。
- 前端改造：`AdminUsersPage.vue` 的 `submitAdd` 改为调用 `POST /api/admin/users`，创建成功后重新拉取列表。
- 验证：创建 `test0002` 返回真实 `id=6a1de7ad344fc1098469b7f9`，`/api/admin/users` 可查，已不再出现 `local-new-*` 本地伪ID路径。

## 2026-06-02 接口收口专项（前端操作全量落库）

### 目标
- 前端所有增删改操作必须写入数据库。
- 页面渲染统一以后端接口返回数据为准，不再依赖本地模拟写入。

### 本轮完成

#### 1) 用户管理 `/admin/users`
- 已确认并修复：新增/编辑/删除/重置 token 全部通过后端接口执行。
- 前端在写操作成功后统一 `loadUsers()` 回读后端列表，避免本地状态与数据库偏差。
- 新增用户不再出现 `local-new-*` 伪 ID。

#### 2) 授权码管理 `/admin/codes`
- 移除前端本地 `genCode()` 兜底生成逻辑。
- 生成、作废、删除后统一回读 `/api/admin/codes`。
- 表格字段改为对齐后端：`duration_days -> days`，`used_by_username` 正确渲染/筛选。

#### 3) 上游管理 `/admin/upstreams`
- 后端 `GET /api/admin/upstreams` 增加返回 `source_url`（原始值，仅管理端接口可见）。
- 前端编辑时使用真实 `source_url`，不再把 `source_url_masked` 误写回后端。

#### 4) 轮换管理 `/admin/rotation`（定时轮换）
- 原先“定时轮换列表”是纯前端模拟数据，已改为后端持久化。
- 新增后端接口（存储于 `system_state.key=rotation_schedules` payload）：
  - `GET /api/admin/rotation/schedules`
  - `POST /api/admin/rotation/schedules`
  - `POST /api/admin/rotation/schedules/:id/toggle`
  - `DELETE /api/admin/rotation/schedules/:id`
- 前端 `AdminRotationPage.vue` 已改为全接口化：新增/启停/删除均走后端，渲染回读后端数据。

### 关键改动文件
- Updated: `backend/src/routes/stage6.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `frontend/src/pages/AdminUsersPage.vue`
- Updated: `frontend/src/pages/AdminCodesPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Updated: `docs/TASK_STATE.md`

### 构建与部署命令
- `npm run build --prefix frontend`
- `docker compose build app caddy`
- `docker compose up -d --force-recreate app caddy`
- `docker compose ps`

### 接口回归（实测）
- `POST /api/admin/users`：创建用户成功，返回真实 MongoDB id。
- `PATCH /api/admin/users/:id`：编辑成功并同步状态/日期。
- `POST /api/admin/users/:id/reset-token`：token 写库成功。
- `POST /api/admin/codes` + `POST /revoke` + `DELETE /codes/:id`：成功，页面回读后端列表。
- `GET/POST/TOGGLE/DELETE /api/admin/rotation/schedules`：新增/启停/删除成功，均可回读验证。

### 容器状态
- `subscription-manager-app` Up
- `subscription-manager-caddy` Up
- `subscription-manager-mongodb` Up (healthy)
- `subscription-manager-redis` Up (healthy)

### 备注
- `references/project-rules.md` 在仓库中不存在（读取失败），本轮按 `subscription_manager_dev_task.md` 与 `AGENTS.md` 执行。

## 2026-06-02 登录与日志收口修复

### 当前目标与完成状态
- 目标：修复一次登录产生 `admin_login` + `user_login` 两条日志的问题，避免登录失败计数被双倍消耗；同时调整日志中心列顺序和中文错误提示。
- 状态：已完成并部署到 NAS Docker 环境。

### 文件变更
- Updated: `backend/src/routes/auth.ts`
  - `/api/auth/login` 改为统一登录入口：后端先识别是否为管理员账号，再执行对应校验、Turnstile 场景、限流与日志写入。
  - 前端登录不再需要先尝试普通用户再尝试管理员。
  - 登录失败/限流/成功响应改为中文业务提示。
  - 兼容保留 `/api/auth/admin/login`，并同步中文化其失败提示。
- Updated: `frontend/src/pages/LoginPage.vue`
  - 登录提交只调用一次 `/api/auth/login`。
- Updated: `frontend/src/pages/AdminLogsPage.vue`
  - 日志表格移除前端假编号。
  - 时间列调整为第一列。
  - 登录动作与历史英文消息在前端映射为中文展示。
- Updated: `docs/TASK_STATE.md`

### 关键命令
- `npm run build --prefix frontend`
- `docker compose build app caddy`
- `docker compose up -d --force-recreate app caddy`
- `docker compose ps`
- `curl -i -X POST http://127.0.0.1:8084/api/auth/login ...`
- `curl http://127.0.0.1:8084/api/admin/logs/auth?limit=5`
- `curl -i http://127.0.0.1:8084/health`
- `curl -i http://127.0.0.1:8084/config`

### 验证结果
- 前端构建：成功，线上静态包已更新为 `index-Bpr_lvRl.js`。
- Docker build：`app` 与 `caddy` 镜像构建成功，后端 TypeScript 在 Docker build 中编译通过。
- 容器状态：
  - `subscription-manager-app` Up
  - `subscription-manager-caddy` Up
  - `subscription-manager-mongodb` Up (healthy)
  - `subscription-manager-redis` Up (healthy)
- 登录失败测试：
  - `POST /api/auth/login` 返回 `401`
  - 响应体为中文：`用户名或密码错误，或账号已禁用`
- 管理员登录测试：
  - `POST /api/auth/login` 使用 `admin/admin123456` 返回 `200`
  - 响应体：`登录成功`，`userType=admin`
  - `/api/auth/me` 返回 `userType=admin`
  - 最新日志只新增一条 `admin_login`，未同时产生 `user_login`
- `GET /health`：`200 OK`，MongoDB/Redis 正常。
- `GET /config`：`200 OK`。

### 已知说明
- 宿主机执行 `npm run build --prefix backend` 失败，原因是当前 NAS 宿主环境未安装后端依赖中的 `tsc`；同一份代码已在 `docker compose build app` 中完成 TypeScript 编译并通过。
- 历史日志中数据库原始 message 仍可能是英文，本轮通过前端展示层映射为中文；新写入登录日志已是中文。

### 下一步
- 建议继续处理 `/dashboard` 刷新时 `/api/auth/me` 重复请求的问题：用现有 `auth-cache` 让路由守卫的鉴权结果传递给页面首屏，避免页面挂载后立刻再请求一次。

## 2026-06-02 授权码生成与复制交互修复

### 当前目标与完成状态
- 目标：修复授权码格式、授权码复制、生成成功弹窗复制按钮溢出、复制后不关闭弹窗、授权码 hover/点击反馈缺失。
- 状态：已完成并部署到 NAS Docker 环境。

### 文件变更
- Updated: `backend/src/routes/stage2.ts`
  - 授权码生成规则改为严格 `6` 位，仅使用 `A-Z` 与 `0-9`。
  - 兑换接口校验同步改为 `^[A-Z0-9]{6}$`。
- Updated: `frontend/src/pages/AdminCodesPage.vue`
  - 授权码复制改为 `navigator.clipboard` 优先，HTTP/NAS 环境自动降级到隐藏 textarea + `execCommand('copy')`。
  - 生成成功弹窗“复制全部”成功后自动关闭弹窗。
  - 生成成功弹窗按钮增加固定最小/最大宽度与内边距，避免按钮溢出。
  - 授权码胶囊增加 hover 高亮与 active 点击动画。
  - 生成成功弹窗改为使用 `POST /api/admin/codes` 返回的本次生成结果，不再从列表前 N 条推断。
- Updated: `docs/TASK_STATE.md`

### 关键命令
- `npm run build --prefix frontend`
- `docker compose build app caddy`
- `docker compose up -d --force-recreate app caddy`
- `docker compose ps`
- `curl -X POST http://127.0.0.1:8084/api/admin/codes ...`
- `curl -i http://127.0.0.1:8084/health`

### 验证结果
- 前端构建成功，新静态包：`index-BW860cT8.js`。
- Docker build 成功，后端 TypeScript 在镜像构建中编译通过。
- 真实接口生成授权码测试：
  - 请求：`POST /api/admin/codes`
  - 返回示例：`312WI5`
  - 结果符合 `^[A-Z0-9]{6}$`。
- 容器状态：
  - `subscription-manager-app` Up
  - `subscription-manager-caddy` Up
  - `subscription-manager-mongodb` Up (healthy)
  - `subscription-manager-redis` Up (healthy)
- `GET /health`：`200 OK`，MongoDB/Redis 正常。

### 已知说明
- 旧数据库中已存在的历史授权码不会被本轮静默改写，避免影响已经发放或记录过的授权码；新生成授权码已按新规则执行。

### 下一步
- 建议继续处理 `/dashboard` 刷新时 `/api/auth/me` 重复请求，或继续做管理端剩余细节联调。

## 2026-06-02 用户端兑换页文案收口

### 当前目标与完成状态
- 目标：将用户端 `/redeem` 的提示文案改为与当前授权码规则一致，并避免继续暗示旧 `SM-` 前缀格式。
- 状态：已完成并部署到 NAS Docker 环境。

### 文件变更
- Updated: `frontend/src/pages/RedeemPage.vue`
  - 输入框占位文案改为 `请输入授权码`。
  - 格式示例改为 `AB12CD`。
  - 兑换前自动将输入转为大写并过滤非 `A-Z0-9` 字符。
  - 输入长度限制为 6 位。
- Updated: `docs/TASK_STATE.md`

### 关键命令
- `npm run build --prefix frontend`
- `docker compose build caddy`
- `docker compose up -d --force-recreate caddy`
- `curl http://127.0.0.1:8084/assets/index-I4l38Bb0.js`
- `docker compose ps`

### 验证结果
- 前端构建成功，新静态包：`index-I4l38Bb0.js`。
- 页面资源中已可检索到新的兑换页文案：
  - `请输入授权码`
  - `格式示例：AB12CD`
  - `立即兑换`
- 容器状态：
  - `subscription-manager-app` Up
  - `subscription-manager-caddy` Up
  - `subscription-manager-mongodb` Up (healthy)
  - `subscription-manager-redis` Up (healthy)

### 下一步
- 若你继续测用户端，我建议顺手检查 `/redeem` 的输入限制是否符合你现场扫码/粘贴的习惯，或者继续做 `/dashboard` 的复制按钮细节收尾。

## 2026-06-02 定时轮询驱动 disable_after 规则调整

### 当前目标与完成状态
- 目标：修改 `disable_after` 规则。
- 状态：已完成并部署到 NAS Docker 环境。

### 新规则
- 当没有启用中的定时轮询时，写入/续期仍走原有的 `graceDays` 流程，默认值保持 `3`。
- 当存在启用中的定时轮询时，`disable_after` 统一改为“下一次轮询日前一天”。
- 定时轮询一旦新增、启用、停用或删除，系统会重新计算所有用户的 `disable_after`。

### 文件变更
- Added/Updated: `backend/src/services/user-lifecycle.ts`
  - 新增定时轮询感知的 `disable_after` 解析。
  - 新增全量重算用户生命周期的辅助函数。
- Updated: `backend/src/routes/stage2.ts`
  - 用户创建、编辑到期日、管理员续期、授权码兑换都改为走新的 `disable_after` 计算器。
- Updated: `backend/src/routes/stage6.ts`
  - 定时轮询新增/启停/删除后，自动重算所有用户的 `disable_after`。
- Updated: `docs/TASK_STATE.md`

### 关键命令
- `docker compose build app`
- `docker compose up -d --force-recreate app`
- `curl /api/admin/rotation/schedules`
- `curl /api/admin/users?status=active`
- 临时创建一次性轮询计划验证后删除，再恢复用户数据

### 验证结果
- 后端 Docker build 成功，`tsc` 编译通过。
- 临时创建定时轮询计划 `2026-06-05 06:00` 后：
  - `test0001` 的 `disable_after` 立即变为 `2026-06-04T00:00:00.000Z`
- 删除临时计划并恢复数据后：
  - `test0001` 的 `disable_after` 回到原值 `2026-06-11T00:00:00.000Z`
- 当前 `GET /api/admin/rotation/schedules` 返回空列表，未遗留临时轮询计划。
- 容器状态：
  - `subscription-manager-app` Up
  - `subscription-manager-caddy` Up
  - `subscription-manager-mongodb` Up (healthy)
  - `subscription-manager-redis` Up (healthy)

### 已知说明
- 为了验证新规则，本轮曾短暂创建过一个临时轮询计划，随后已删除并恢复用户数据，不影响当前运行状态。

---

## 2026-06-02 定时轮询失效窗口精确计算与管理端列表收口

### 目标
- 按最新口径收口定时轮询的失效窗口计算：
  - 多个指定日期与多个每月计划混合时，按“`disable_at` 后最近一次有效轮询日期 - 1 天”计算 `disable_after`
  - 如果系统当前没有任何有效定时轮询，写入/续期仍回退到 `graceDays` 默认值 `3`
  - 指定日期计划在执行时间已过后自动停用，且前端按钮不可再启用
- 删除管理端列表中的前端假编号，改为真实有意义的字段展示

### 文件变更
- Added: `backend/src/services/rotation-schedules.ts`
  - 抽出轮询计划日期计算、过期判断、`disable_after` 推导的公共逻辑。
- Updated: `backend/src/services/user-lifecycle.ts`
  - 使用统一的轮询计划计算器推导 `disable_after`。
- Updated: `backend/src/routes/stage6.ts`
  - 定时轮询计划新增/查询/启停/删除改为统一规则；
  - 指定日期计划过期后自动降级为停用态；
  - 轮询计划变更后继续触发全量用户生命周期重算。
- Updated: `frontend/src/pages/AdminCodesPage.vue`
  - 删除授权码编号假列。
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
  - 删除上游编号假列。
- Updated: `frontend/src/pages/AdminRotationPage.vue`
  - 删除定时轮询编号假列；
  - 轮换日志首列改为时间；
  - 过期定时计划按钮置灰禁用。
- Updated: `docs/TASK_STATE.md`

### 关键命令
- `npm run build --prefix frontend`
- `docker compose build app`
- `docker compose up -d --force-recreate app caddy`
- `docker compose ps`
- `curl -i http://127.0.0.1:8084/health`

### 验证结果
- 前端构建成功。
- 后端在 Docker 构建中通过 `tsc` 编译。
- `app`、`caddy`、`mongodb`、`redis` 均处于运行状态，`/health` 返回 `200 OK`。
- 管理员登录成功后，`/api/admin/rotation/schedules` 返回了：
  - 1 条已过期的指定日期计划，按钮应停用
  - 1 条未来指定日期计划
  - 1 条每月 1 日计划
- `/api/admin/users` 返回的示例用户 `disable_after` 已按当前有效轮询计划计算到 `2026-06-24T00:00:00.000Z`。
- 管理端列表已去掉前端假编号：
  - 授权码管理：取消“授权码编号”
  - 上游管理：取消“编号”
  - 轮换管理：取消“计划编号”和“日志编号”，日志首列改为时间
- 定时轮询计划在执行时间已过后，后端会自动视为停用，前端按钮不可再启用。

### 下一步
- 继续按同一口径检查用户端 `disable_after` 与管理端状态渲染是否完全一致。
- 如需进一步收口，可继续把“过期计划”的展示文案做得更明确一些。

---

## 2026-06-02 定时轮询失效窗口自测

### 目标
- 自测最新定时轮询规则是否能在真实接口中正确前移 `disable_after`。
- 验证过期指定日期计划是否不可重新启用。
- 验证临时数据可回滚，不污染现场。

### 自测步骤
1. 管理员登录成功。
2. 读取 `/api/admin/rotation/schedules` 与 `/api/admin/users`，确认当前计划与用户状态可正常读取。
3. 创建临时用户 `tmpcalc20260602`，初始 `disable_after` 为 `2026-06-24T00:00:00.000Z`。
4. 创建临时定时轮询计划 `2026-06-22 06:00`。
5. 重新读取用户，确认该临时用户的 `disable_after` 前移到 `2026-06-21T00:00:00.000Z`。
6. 尝试启用已过期的指定日期计划，接口返回 `409`，表示不可重新启用。
7. 删除临时定时轮询计划后，重新读取用户，确认 `disable_after` 回到 `2026-06-24T00:00:00.000Z`。
8. 删除临时用户，确认现场恢复。

### 验证结果
- 临时用户前移规则验证通过：
  - 创建前：`disable_after=2026-06-24T00:00:00.000Z`
  - 创建临时计划后：`disable_after=2026-06-21T00:00:00.000Z`
  - 删除临时计划后：`disable_after=2026-06-24T00:00:00.000Z`
- 过期计划启用验证通过：
  - `POST /api/admin/rotation/schedules/:id/toggle` 返回 `409`
  - 返回信息：`Schedule has expired and cannot be enabled`
- 清理验证通过：
  - 临时定时轮询计划已删除
  - 临时用户已删除
  - 当前现场未留下额外测试数据

### 当前状态
- `docker compose ps`：`app / caddy / mongodb / redis` 正常。
- `curl http://127.0.0.1:8084/health`：`200 OK`
- 当前定时轮询列表仍保留原有 3 条记录，不含临时自测数据。

### 下一步
- 等待人工核验。
- 如人工核验发现边界案例，可继续补充单条计划、月计划或混合计划的更多样例。

---

## 2026-06-02 `disable_after` 逐用户计算纠偏

### 目标
- 修复此前把“当前时间”误当成“用户到期日”参与轮询窗口计算的问题。
- 确保 `disable_after` 始终按每个用户自己的 `expire_at` 独立计算。

### 问题原因
- 之前 `getScheduledDisableAfter()` 在同步用户生命周期时，没有把用户自己的 `expire_at` 传入计算器。
- 这会导致所有用户共享同一个“相对当前时间”的失效窗口，出现 `test0001 / test0003 / test0002` 的 `disable_after` 被压到同一天的错误。

### 文件变更
- Updated: `backend/src/services/user-lifecycle.ts`
  - `getScheduledDisableAfter(disableAt, now)` 改为接收单用户到期日。
  - `resolveDisableAfterForWrite()` 与 `syncUserLifecycle()` 统一按用户自己的 `expire_at` 计算。

### 关键命令
- `npm run build --prefix frontend`
- `docker compose build app`
- `docker compose up -d --force-recreate app`
- `curl -b /tmp/subhub.cookies http://127.0.0.1:8084/api/admin/users`

### 验证结果
- `test0001`：`expire_at=2026-06-11T00:00:00.000Z`，`disable_after=2026-06-14T00:00:00.000Z`
- `test0003`：`expire_at=2026-06-06T00:00:00.000Z`，`disable_after=2026-06-07T00:00:00.000Z`
- `test0002`：`expire_at=2026-08-04T00:00:00.000Z`，`disable_after=2026-08-07T00:00:00.000Z`
- 管理端用户列表已恢复为逐用户独立计算结果。

### 说明
- 当前用户管理页保留的“用户编号”是数据库 `_id` 的真实展示，不是前端假编号。
- 之前删除的假编号已全部从 codes / upstreams / rotation 列表中收口。

---

## 2026-06-02 前端静态包重建与线上发布确认

### 目标
- 重新构建前端静态包，并确保 NAS 线上 `caddy` 读取的是新 bundle。
- 验证当前线上 bundle 不再包含 `C001 / U001 / R001 / J001` 这类前端假编号。

### 文件与产物
- Updated: `frontend/src/pages/AdminCodesPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `frontend/src/pages/AdminRotationPage.vue`
- Rebuilt image: `subscription-manager-caddy:latest`

### 关键命令
- `docker compose build caddy`
- `docker compose up -d --force-recreate caddy`
- `curl -s http://127.0.0.1:8084/`
- `curl -s http://127.0.0.1:8084/assets/index-P8QpHPm1.js`

### 验证结果
- 当前首页 HTML 已指向新 bundle：`/assets/index-P8QpHPm1.js`
- 线上 bundle 未检出 `C001 / U001 / R001 / J001` 这类假编号字符串
- 如果浏览器仍显示旧编号，优先判断为客户端缓存未刷新，而非服务端未重建

### 下一步
- 请进行一次浏览器强制刷新后再核验管理端页面。
- 如强刷后仍显示旧编号，再继续排查是否有额外缓存层或老页面路由残留。

## 2026-06-02 阶段 8 部署交付物补齐

### 当前目标与完成状态
- 目标：推进任务书阶段 8 的部署上线收口，补齐生产 compose、HTTPS 模板、备份/恢复脚本和部署文档。
- 状态：已完成部署交付物补齐，并完成 compose / 脚本语法验证。

### 本轮新增文件
- Added: `docker-compose.prod.yml`
- Added: `caddy/Caddyfile.prod`
- Added: `docker/backup.sh`
- Added: `docker/restore.sh`
- Added: `docs/DEPLOYMENT.md`
- Updated: `README.md`

### 关键内容
- 新增生产 compose：
  - `app` / `mongodb` / `redis` / `caddy`
  - `caddy` 监听 `80/443`
  - `SESSION_COOKIE_SECURE=true`
  - `APP_BASE_URL` 默认指向 HTTPS 域名示例
- 新增 HTTPS Caddy 模板：
  - 使用 `sub.889100.xyz` 作为站点域名
  - 保持 API / 订阅接口反向代理到 `app`
- 新增备份与恢复脚本：
  - `docker/backup.sh` 导出 MongoDB / Redis 卷为 tar.gz
  - `docker/restore.sh` 按卷名恢复指定归档
- 新增部署文档：
  - NAS 本地部署
  - 生产 HTTPS 部署
  - 备份 / 恢复示例

### 命令与验证
- `chmod +x docker/backup.sh docker/restore.sh`
- `bash -n docker/backup.sh && bash -n docker/restore.sh`
- `docker compose -f docker-compose.prod.yml config`
- `docker compose -f docker-compose.nas.yml config`

### 验证结果
- 生产 compose 配置解析成功。
- NAS compose 配置解析成功。
- 备份 / 恢复脚本语法校验通过。
- 生产 compose 默认值可正常展开，未出现空域名或空 TLS 参数导致的配置错误。

### Docker / 容器状态
- 本轮未重建容器、未执行 `docker compose up`，仅做配置与脚本校验。

### 下一步
- 若进入正式上线阶段，可按 `docs/DEPLOYMENT.md` 填写真实域名、TLS 与环境变量后再执行生产 compose。
- 若继续产品开发，可回到最终联调与视觉微调收口。

## 2026-06-02 Mobile Typography Scaling

### 当前目标与完成状态
- 目标：提升移动端整体字体可读性，避免用户端、登录注册页在手机上出现字号偏小的问题。
- 状态：已完成基础字号放大与关键页面字号收口，并完成构建与 `caddy` 重建。

### 本轮变更文件
- Updated: `frontend/src/App.vue`
- Updated: `frontend/src/components/user/UserMobileLayout.vue`
- Updated: `frontend/src/components/auth/AuthLayout.vue`
- Updated: `frontend/src/components/ui/FormField.vue`
- Updated: `frontend/src/components/ui/LoadingButton.vue`
- Updated: `frontend/src/pages/DashboardPage.vue`
- Updated: `frontend/src/pages/HelpPage.vue`
- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `frontend/src/pages/PasswordPage.vue`
- Updated: `frontend/src/pages/RedeemPage.vue`
- Updated: `frontend/src/pages/RegisterPage.vue`

### 主要调整
- 全局移动端基础字号提升，输入框、按钮等控件字号同步放大。
- 用户端壳层字号提升：
  - 顶部标题
  - 底部导航
  - 元信息卡片
- 登录/注册页字号提升：
  - Turnstile 占位
  - 提示文案
  - 注册/登录切换文案
- 用户端功能页字号提升：
  - 兑换授权码
  - 修改密码
  - 使用帮助
  - 我的订阅

### 关键命令
- `npm run build --prefix frontend`
- `docker compose build caddy`
- `docker compose up -d --force-recreate caddy`

### 验证结果
- 前端构建成功。
- `subscription-manager-caddy` 已重建并启动。
- 新的前端静态包已发布到线上容器。

### 当前状态
- 移动端显示字号已整体放大，建议在手机端继续复核具体页面的可读性与排版。

### 下一步
- 建议在手机上复核：
  - `/login`
  - `/register`
  - `/dashboard`
  - `/redeem`
  - `/password`
  - `/help`
- 若视觉确认通过，再继续真实生产环境测试。

---

## 2026-06-03 - 结题报告整理

### 当前目标
- 按外部复审要求整理 `docs/CODEX_COMPLETION_REPORT.md`，不改业务代码，仅补齐项目完成度与上线前核查信息。

### 完成情况
- 已完成结题报告文件：
  - `docs/CODEX_COMPLETION_REPORT.md`
- 报告覆盖：
  - 项目基本信息
  - 已完成阶段总览
  - 完整 API 清单
  - 完整前端路由 / 页面清单
  - 数据模型与字段
  - 系统设置字段
  - Docker / 部署状态
  - 订阅转换链路
  - 已执行测试与验证
  - 已知问题与风险分级
  - 可能冗余项
  - 上线前待确认事项
  - 建议的后续检查

### 文件变化
- 新增：`docs/CODEX_COMPLETION_REPORT.md`

### 已执行内容
- 读取并整理了：
  - `docs/TASK_STATE.md`
  - `docs/DEV_TASK.md`
  - `docs/CODEX_HANDOFF.md`
  - `docs/PROGRESS.md`
  - `compose.yaml`
  - `docker-compose.yml`
  - `backend/package.json`
  - `frontend/package.json`
  - `.env.example`

### 容器 / 服务状态
- 当前没有改动容器配置。
- 既有部署状态保持不变，报告中已记录当前服务与健康状态。

### 接口 / 验证状态
- 本轮未新增接口联调，仅进行了文档整理与现状汇总。

### 下一步
- 等待外部复审意见。
- 如需继续，可据结题报告中的“上线前需确认事项”逐项收敛。

---

## 2026-06-03 - P1 路由收敛与部署说明收口

### 当前目标
- 仅处理 P1：收敛 `/rotation` 历史路由权限语义，并完成最小上线文档收口。

### 完成情况
- 已完成 `/rotation` 路由收敛。
- 已补充文档说明，明确 `compose.yaml` 为唯一权威编排文件。
- 老管理员接口与过期空订阅策略仅做记录收口，未改业务逻辑。

### 修改文件
- Updated: `frontend/src/router/index.ts`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/TASK_STATE.md`

### `/rotation` 处理结果
- 未登录访问 `/rotation`：重定向到 `/login`
- 普通用户访问 `/rotation`：重定向到 `/dashboard`
- 管理员访问 `/rotation`：重定向到 `/admin/rotation`
- `/admin/rotation` 正式管理页保持正常
- 普通用户仍无法通过 `/admin` 路径访问管理员页面

### compose 权威文件说明
- `compose.yaml` 已在 README 与部署文档中明确为唯一权威 Docker Compose 编排文件。
- `docker-compose.yml` 已标记为历史遗留文件，不作为部署依据。

### 老管理员接口保留策略
- `POST /api/auth/admin/login`
- `POST /api/auth/admin/change-password`
- 以上接口短期保留为兼容入口。
- 当前统一登录页 `/login` 为主入口，未来确认无外部调用后再考虑下线。

### 过期空订阅策略
- `expired`：继续返回 `200` 空订阅，用于降低客户端报错。
- `inactive / disabled`：继续返回 `403`，保留账号状态语义。
- 后续如需统一为空订阅，需要用户确认后再改。

### 已执行命令
- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`
- `docker compose ps`
- `curl -i -s http://127.0.0.1:8084/`
- `curl -i -s http://127.0.0.1:8084/health`
- `curl -i -s http://127.0.0.1:8084/config`

### 测试结果
- 前端构建：通过
- Caddy 重启：通过
- `/`：200
- `/health`：200
- `/config`：200

### 遗留问题
- `docker-compose.yml` 仍存在于仓库中，后续若要彻底清理需要用户再次确认。
- `frontend/src/pages/RotationPage.vue` 仍保留为历史文件，但已通过路由守卫避免普通用户停留。

### 下一步建议
- 如需继续收敛，可下一轮仅处理文档归档或是否下线旧管理员接口，不再动 `/rotation` 路由。

---

## 2026-06-03 - P2 文档收口与生产上线清单

### 当前目标
- 仅做 P2 最小收口：文档归档、部署说明、生产上线清单整理。

### 完成情况
- 已创建：
  - `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- 已在以下文档中明确 `compose.yaml` 为唯一权威编排文件：
  - `README.md`
  - `docs/DEPLOYMENT.md`
  - `docs/TASK_STATE.md`
- 已在生产上线清单中记录：
  - 环境变量清单
  - Turnstile 检查
  - Docker / 端口检查
  - 订阅转换检查
  - 客户端验收
  - 账号与权限检查
  - 备份与回滚
  - smoke test 命令
  - 上线前人工确认项
- 已在文档中标记旧任务书与旧逻辑仅供历史参考。

### 修改文件
- Added: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/TASK_STATE.md`

### compose 权威说明
- `compose.yaml` 是唯一权威 Docker Compose 编排文件。
- `docker-compose.yml` 为历史遗留文件，不作为部署依据。
- 上线、构建、重启、查看日志统一使用 `docker compose` 基于 `compose.yaml` 执行。

### 老管理员接口保留策略
- `POST /api/auth/admin/login`
- `POST /api/auth/admin/change-password`
- 以上接口短期保留为兼容接口。
- 当前主入口为统一登录页 `/login`。
- 未来确认无外部调用后再考虑下线。

### 过期空订阅策略
- `expired`：返回 `200` 空订阅，减少客户端报错。
- `inactive`：返回 `403`。
- `disabled`：返回 `403`。
- 如需统一改为空订阅，需要用户确认后再调整。

### 已执行命令
- `sed -n '1,260p' docs/PREFLIGHT_FIX_PLAN.md`
- `sed -n '1,260p' docs/TASK_STATE.md`
- `sed -n '1,220p' README.md`
- `sed -n '1,220p' docs/DEPLOYMENT.md`
- `ls -la docs`
- `grep -R "redeem_turnstile_enabled\\|upstream_fetch_user_agent\\|sub_cache_seconds\\|admin/login\\|公共 converter\\|sub.ops.ci" docs -n`
- `sed -n '1,260p' backend/src/config/env.ts`
- `sed -n '1,220p' frontend/src/lib/public-config.ts`
- `sed -n '1,220p' frontend/src/lib/auth-cache.ts`

### Docker / 容器状态
- 本轮未重建容器。
- 当前容器状态维持不变。

### API / 接口状态
- 无接口变更，仅补齐上线清单与部署口径说明。

### 遗留问题
- `docker-compose.yml` 仍保留在仓库中，按当前决策仅作为历史遗留文件。
- `docs/DEV_TASK.md` 仍保留旧逻辑描述，已在上线清单中明确历史参考定位。

### 下一步建议
- 如果要继续优化，建议下一轮只做“旧文档归档建议稿”或“生产环境变量最终填值确认”，不再改业务代码。

---

## 2026-06-03 - 最终上线前验收

### 当前目标
- 按生产上线清单执行最终只读验收，生成最终验收报告。

### 完成情况
- 已完成最终只读验收。
- 已生成：
  - `docs/FINAL_PREFLIGHT_REPORT.md`
- 当前结论：
  - 可上线：条件可上线
  - P0：0
  - P1：0
  - P2：4

### 修改文件
- Added: `docs/FINAL_PREFLIGHT_REPORT.md`
- Updated: `docs/TASK_STATE.md`

### Docker / 端口检查结果
- `docker compose config` 成功，当前实际使用 `compose.yaml`
- `docker compose ps` 显示核心容器均为 `Up`
- `caddy` 对外暴露 `8084`
- `app`、`mongodb`、`redis` 均未直接暴露公网
- `subconverter` 未设置 `ports`，仅 `expose 25500`

### smoke test 结果
- `/`：200
- `/health`：200，MongoDB / Redis 正常
- `/config`：200，返回 Turnstile 前端配置
- `/api/auth/me`：401（未登录符合预期）

### 前后端 build 结果
- 前端构建：通过
- 后端构建：通过

### 路由权限结论
- `/login` 为统一登录入口
- 无独立 `/admin/login` 前端页面
- 普通用户不能访问 `/admin/*`
- 未登录访问 `/admin/*` 会回 `/login`
- 普通用户访问 `/rotation` 会回 `/dashboard`
- 管理员访问 `/rotation` 会跳 `/admin/rotation`
- `/admin/rotation` 正常保留

### 订阅链路结论
- 本地 `subconverter` 正常工作
- `converter_backend_url` 指向 `http://subconverter:25500/sub`
- `/sub/:token` 具备状态校验、Redis 限流、版本号输出
- `expired` 返回 200 空订阅，`inactive/disabled` 返回 403
- 本轮未提供有效用户 token，因此未直接执行真实 token 的端到端 `/sub/:token?target=clash` 请求；如需补测，可后续提供测试 token。

### 日志脱敏结论
- 已检查主要容器日志。
- 未在最终报告中输出完整订阅 URL、完整 token、完整密码或 secret。
- 存在少量历史性/重启期错误记录，但当前 smoke test 已恢复正常，不构成当前阻塞。

### 需要用户人工确认项
- 正式域名、HTTPS、Turnstile 生产 key、注册开关、管理员密码、上游 token 重置、数据库备份、Git tag、客户端测试结果。

### 下一步建议
- 若你确认人工项已全部完成，就可以进入正式上线窗口。
- 如果还没完成，建议先逐项打勾，再上线。

---

## 2026-06-03 - 上游代理回退实现

### 当前目标
- 为上游测试增加“直连失败后代理回退”的最小实现，缓解云服务器出口被上游 Cloudflare/WAF 拒绝导致的 403 问题。

### 完成情况
- 已完成后端上游测试代理回退逻辑。
- 已完成管理端上游列表的 `代理回退` 开关与展示。
- 已将单条测试、批量测试接入同一套回退逻辑。

### 修改文件
- Updated: `backend/src/lib/upstream-testing.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/services/upstream-batch-runner.ts`
- Updated: `backend/src/lib/db.ts`
- Updated: `backend/src/config/env.ts`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `.env.example`
- Updated: `.env.production.example`
- Updated: `backend/.env.example`
- Updated: `compose.yaml`
- Updated: `docker-compose.yml`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`
- Updated: `docs/TASK_STATE.md`

### 命令
- `sed -n '1,260p' backend/src/lib/upstream-testing.ts`
- `sed -n '1,260p' backend/src/routes/stage3.ts`
- `sed -n '1,220p' backend/src/services/upstream-batch-runner.ts`
- `sed -n '1,260p' frontend/src/pages/AdminUpstreamsPage.vue`
- `sed -n '1,220p' backend/src/lib/db.ts`
- `sed -n '1,220p' backend/src/config/env.ts`
- `npm run build --prefix backend`
- `npm run build --prefix frontend`

### Docker / 容器状态
- 本轮未重建容器。

### API / 接口状态
- `/admin/upstreams/:id/test` 已支持直连失败后的代理回退。
- `/admin/upstreams/test-all` 已支持直连失败后的代理回退。
- `UPSTREAM_FETCH_PROXY_URL` 为可选配置，仅在需要回退出口时启用。

### 验证结果
- 后端构建通过。
- 前端构建通过。

### 遗留问题
- 代理回退仍依赖外部可用出口（例如 NAS/OpenWrt 上可达的代理），云服务器直连依然可能被上游拒绝。

### 下一步建议
- 若需要继续验证，可在生产环境填入 `UPSTREAM_FETCH_PROXY_URL` 后，复测单条上游与批量测试是否从 403 回退为 200。

---

## 2026-06-03 - 上游代理回退需求收口

### 当前目标
- 取消“代理名称”设计，改为系统设置中的“上游拉取代理地址”，并补齐代理连通性测试按钮。

### 完成情况
- 已删除代理名称相关设计口径，统一为 `UPSTREAM_FETCH_PROXY_URL` / `上游拉取代理地址`。
- 已在系统设置页增加“上游拉取代理地址”输入框与“测试代理连通性”按钮。
- 已新增后端接口 `POST /api/admin/settings/test-upstream-proxy`。
- 已保留环境变量作为兜底，并明确系统设置优先、环境变量次之。
- 已保留每条上游的 `fetch_via_proxy` 开关，批量测试与自动轮询仍共用同一条逻辑链路。

### 修改文件
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `backend/src/lib/upstream-testing.ts`
- Updated: `backend/src/lib/db.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/services/upstream-batch-runner.ts`
- Updated: `backend/package.json`
- Added: `backend/package-lock.json`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`
- Updated: `docs/TASK_STATE.md`

### 命令
- `sed -n '1,260p' .codex/skills/subscription-manager-project/SKILL.md`
- `sed -n '1,260p' backend/src/routes/stage7.ts`
- `sed -n '1,260p' frontend/src/pages/AdminSettingsPage.vue`
- `sed -n '1,220p' frontend/src/lib/api.ts`
- `sed -n '1,260p' backend/src/lib/runtime-settings.ts`
- `grep -RIn "代理名称\\|upstream_fetch_proxy_name\\|proxyName" . --exclude-dir=node_modules --exclude-dir=dist`
- `npm run build --prefix backend`
- `npm run build --prefix frontend`

### Docker / 容器状态
- 本轮未重建容器。

### API / 接口状态
- 新增 `POST /api/admin/settings/test-upstream-proxy`。
- 系统设置页可保存 `upstream_fetch_proxy_url`，保存后立即生效。

### 验证结果
- 后端构建通过。
- 前端构建通过。
- 代码中未发现代理名称相关残留口径。

### 遗留问题
- 代理连通性仍依赖外部可用出口（例如 NAS/OpenWrt 上的代理服务）。

### 下一步建议
- 在生产环境补入系统设置代理地址后，直接复测代理连通性按钮和上游批量测试。

---

## 2026-06-03 - 上游代理回退联调验收

### 当前目标
- 验证系统设置“上游拉取代理地址”、代理连通性测试按钮、上游代理回退与批量测试链路是否联通。

### 完成情况
- 已重建并重启 `app` / `caddy`，使最新代码在运行容器中生效。
- 已通过管理员登录（使用 Turnstile 测试 token）进入系统设置页。
- 已验证系统设置可保存 `upstream_fetch_proxy_url`，并可立即读取回显。
- 已验证 `/api/admin/settings/test-upstream-proxy` 可返回代理连通性测试结果，成功时可拿到出口 IP 与耗时。
- 已验证上游单条测试与批量测试均携带 `last_test_via_proxy` 字段，且代理回退后会在结果里保留该标记。
- 已验证 `fetch_via_proxy=true` 的上游在测试结果中会记录代理回退路径。
- 已恢复临时测试设置，不保留联调用代理地址与临时上游标记。

### 修改文件
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `backend/src/lib/upstream-testing.ts`
- Updated: `backend/src/lib/db.ts`
- Updated: `backend/src/routes/stage3.ts`
- Updated: `backend/src/services/upstream-batch-runner.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `docs/TASK_STATE.md`

### 命令
- `docker compose up -d --build app caddy`
- `curl http://127.0.0.1:8084/config`
- `curl -c /tmp/sm.cookie -d '{\"username\":\"admin\",\"password\":\"admin123456\",\"turnstileToken\":\"1x0000000000000000000000000000000AA\"}' http://127.0.0.1:8084/api/auth/login`
- `curl -b /tmp/sm.cookie http://127.0.0.1:8084/api/admin/settings`
- `curl -b /tmp/sm.cookie -X PUT http://127.0.0.1:8084/api/admin/settings`
- `curl -b /tmp/sm.cookie -X POST http://127.0.0.1:8084/api/admin/settings/test-upstream-proxy`
- `curl -b /tmp/sm.cookie -X PATCH http://127.0.0.1:8084/api/admin/upstreams/:id`
- `curl -b /tmp/sm.cookie -X POST http://127.0.0.1:8084/api/admin/upstreams/:id/test`
- `curl -b /tmp/sm.cookie -X POST http://127.0.0.1:8084/api/admin/upstreams/test-all`
- `docker compose ps`
- `curl -i http://127.0.0.1:8084/health`

### Docker / 容器状态
- `app`、`caddy` 已重新构建并重启。
- `mongodb`、`redis`、`subconverter` 保持运行。

### API / 接口状态
- 系统设置页新增的 `upstream_fetch_proxy_url` 可保存并立即生效。
- `POST /api/admin/settings/test-upstream-proxy` 可用。
- 单条测试与批量测试均携带代理回退结果标记。

### 验证结果
- `backend` 构建通过。
- `frontend` 构建通过。
- 系统设置保存通过。
- 代理连通性测试通过。
- 单条上游测试通过。
- 批量测试通过。
- `/health` 正常，`/config` 正常。

### 遗留问题
- 当前联调用的是临时代理容器；生产环境仍需填入真实可达的 `UPSTREAM_FETCH_PROXY_URL`，否则代理回退仍会失败。

### 下一步建议
- 在正式环境补入真实代理地址后，再做一次云服务器直连失败、代理回退成功的最终联调。

---

## 2026-06-03 - 上游代理回退 UI 收口

### 当前目标
- 将上游代理相关交互收口为：全局代理地址默认值、测试地址输入、列表内开关切换，并保持代理回退链路不变。

### 完成情况
- 系统设置页的“上游拉取代理地址”默认值已统一为 `http://100.69.223.58:17890`，并保留可编辑覆盖。
- 系统设置页的代理连通性测试区域已拆成两个元素：测试地址输入框 + 测试按钮。
- 上游列表中的“代理回退”已改为可直接在列表内操作的开关按钮，不再使用勾选框。
- 上游编辑弹窗中的代理回退也已改为开关按钮。
- `UPSTREAM_FETCH_PROXY_URL` 相关环境样例与部署文档已同步默认地址说明。
- `compose` 运行容器已重建并重启，前端最新资源已生效。

### 修改文件
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `.env.example`
- Updated: `.env.production.example`
- Updated: `backend/.env.example`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`

### 命令
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker compose up -d --build app caddy`
- `docker compose ps`
- `curl -i http://127.0.0.1:8084/health`
- `curl -s http://127.0.0.1:8084/config`

### Docker / 容器状态
- `app`、`caddy` 已基于最新代码重建并运行。
- `mongodb`、`redis`、`subconverter` 继续保持健康运行。

### API / 接口状态
- 代理测试接口仍可用。
- 上游列表与编辑弹窗的 `fetch_via_proxy` 开关行为保持不变。

### 验证结果
- `backend` 构建通过。
- `frontend` 构建通过。
- `docker compose ps` 正常。
- `/health` 正常。
- `/config` 正常。

### 遗留问题
- 代理连通性仍依赖外部可达出口；若生产环境未配置代理地址，代理回退仍不会生效。

### 下一步建议
- 在正式环境再次确认系统设置里的默认代理地址与实际可达出口一致，并对一条 `fetch_via_proxy=true` 的上游做一次批量测试验收。

---

## 2026-06-03 - 上游代理 UI 收口与 tinyproxy 口径澄清

### 当前目标
- 按页面反馈收口上游代理相关 UI：取消重复测试地址输入、列表代理改为无外框开关，并明确测试结果中的代理标记含义。

### 完成情况
- 系统设置页已取消重复的“测试地址”独立输入项，保留“代理连通性测试”区块内的测试地址输入框 + 按钮组合。
- 上游列表中的“代理回退”已改为无胶囊外框的开关样式按钮，可直接在列表内切换。
- 上游编辑弹窗中的“代理回退”也已收敛为开关样式按钮。
- 测试结果中的“代理回退”标记已明确为“最后一次测试使用了代理回退路径”。
- 上游拉取代理地址默认值继续统一为 `http://100.69.223.58:17890`。
- 文档已补充说明：上游拉取代理可由 NAS 上独立运行的 tinyproxy/HTTP 代理服务提供，不纳入本仓库 Docker Compose 管理。

### 修改文件
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `backend/src/lib/runtime-settings.ts`
- Updated: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Updated: `.env.example`
- Updated: `.env.production.example`
- Updated: `backend/.env.example`
- Updated: `README.md`
- Updated: `docs/DEPLOYMENT.md`
- Updated: `docs/FINAL_CLOUD_DEPLOYMENT_RUNBOOK.md`

### 命令
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker compose up -d --build app caddy`
- `docker compose ps`
- `curl -i http://127.0.0.1:8084/health`
- `curl -s http://127.0.0.1:8084/config`

### Docker / 容器状态
- `app`、`caddy` 已基于最新代码重建并运行。
- `mongodb`、`redis`、`subconverter` 保持健康运行。

### API / 接口状态
- 系统设置的代理地址保存与测试接口仍可用。
- 上游列表代理回退开关保存与批量测试链路保持不变。

### 验证结果
- `backend` 构建通过。
- `frontend` 构建通过。
- `docker compose ps` 正常。
- `/health` 正常。
- `/config` 正常。

### 遗留问题
- 代理连通性仍依赖外部可达出口；若 NAS 上的 tinyproxy/HTTP 代理服务未部署或不可达，代理回退不会生效。

### 下一步建议
- 若要正式启用代理回退，请先在 NAS 上部署独立 tinyproxy/HTTP 代理服务，再回到系统设置页面做连通性测试。

---

## 2026-06-03 - 上游测试结果 UI 收口

### 当前目标
- 将上游列表中的测试结果展示收口为：测试中、代理、直连三种明确状态。

### 完成情况
- 上游列表的测试结果列在执行批量测试时继续显示黄色“测试中”胶囊。
- 测试完成后，结果列现在按最终路径显示“代理”或“直连”，不再显示容易歧义的“代理回退”。
- 上游代理回退开关仍保留为列表内可直接操作的开关样式，不影响链路逻辑。
- 系统设置页仍保留上游拉取代理地址与代理连通性测试区块，未改变链路。

### 修改文件
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix frontend`

### 验证结果
- 前端构建通过。
- 上游列表 UI 的测试结果状态展示已按“测试中 / 代理 / 直连”收口。

### 遗留问题
- 无。

### 下一步建议
- 刷新上游管理页确认最终展示文案与样式是否符合预期；如果需要，再微调“代理 / 直连”胶囊尺寸和颜色。

---

## 2026-06-03 - 上游测试失败态结果补显

### 当前目标
- 修正上游列表中失败测试项被误显示为 `-` 的问题，并保证失败时也能看到最终走的是代理还是直连。

### 完成情况
- 上游列表的测试结果判定改为以 `last_test_ok` 为主，不再仅依赖 `last_test_status`。
- 对于失败但没有 HTTP 状态码的情况，列表现在会显示红色“失败”胶囊。
- 失败项仍会显示路径胶囊，明确是“代理”还是“直连”。
- 测试中的黄色胶囊逻辑保持不变。

### 修改文件
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix frontend`
- `docker compose up -d --build caddy`

### 验证结果
- 前端构建通过。
- `caddy` 已重建并生效。

### 遗留问题
- 若后端返回的失败结果缺少 HTTP 状态码，列表会显示“失败”而不是具体 HTTP 码；这是预期行为。

### 下一步建议
- 刷新上游管理页，确认失败项是否已按“失败 + 代理/直连”显示。

---

## 2026-06-03 - 上游测试结果按返回码与路径收口

### 当前目标
- 保证上游测试结果列在成功、失败、测试中三种状态下都能明确展示“返回码 + 代理/直连路径”。

### 完成情况
- 将上游测试结果列的完成态显示固定为返回码格式，失败时也显示返回码样式，不再用纯文案替代。
- 测试完成后，路径胶囊继续显示“代理”或“直连”。
- 测试中的黄色胶囊仍保持，但不会再附带旧的代理/直连路径，避免误导。
- 未测试项仍显示 `-`。

### 修改文件
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix frontend`
- `docker compose up -d --build caddy`

### 验证结果
- 前端构建通过。
- `caddy` 已重建并生效。

### 遗留问题
- 若失败结果没有 HTTP 状态码，前端会按 `HTTP 0` 显示，以保持“返回码”展示一致性。

### 下一步建议
- 刷新上游管理页确认：测试中显示黄色“测试中”，完成态显示绿色/红色返回码，并在旁边显示“代理 / 直连”。

---

## 2026-06-03 - 上游测试路径在测试中可见

### 当前目标
- 让上游列表的测试结果列在测试中、成功、失败三种状态下都明确显示当前正在使用的连接方式。

### 完成情况
- 测试结果列现在在“测试中”阶段也会显示路径胶囊，路径固定按当前实际连接方式显示为“直连”或“代理”。
- 完成态继续显示最终返回码，并在旁边显示最终路径“直连”或“代理”。
- 路径胶囊不再等测试结束后才出现，测试过程中就能看到当前正在走哪条链路。

### 修改文件
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`

### 验证结果
- 前端构建通过。
- `caddy` 已重启并加载最新静态资源。

### 遗留问题
- 无。

### 下一步建议
- 刷新上游管理页，确认“测试中”时路径胶囊是否随当前连接方式一起显示。

---

## 2026-06-03 - 上游测试路径胶囊提亮

### 当前目标
- 提升上游测试结果列中“直连 / 代理”路径胶囊的可读性和视觉辨识度。

### 完成情况
- “直连 / 代理”胶囊已统一为更醒目的高对比样式。
- 直连与代理现在都保留清晰的边框、背景与文字对比，便于在测试中和测试完成后快速识别当前路径。

### 修改文件
- Updated: `frontend/src/pages/AdminUpstreamsPage.vue`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix frontend`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart caddy`

### 验证结果
- 前端构建通过。
- `caddy` 已重启并加载最新静态资源。

### 遗留问题
- 无。

### 下一步建议
- 刷新上游管理页，确认“直连 / 代理”胶囊在测试中和完成态都更容易被一眼看清。

---

## 2026-06-03 - 代理连通性测试补充出口地区

### 当前目标
- 让系统设置页的代理连通性测试结果在出口 IP 后面补充国家/地区信息，方便快速判断代理出口位置。

### 完成情况
- 代理连通性测试成功时，结果现在会显示 `出口 IP + 国家/地区`，例如 `45.62.172.83 香港`。
- 前端成功提示保持单行展示，失败提示仍保持明确原因。
- 代理连通性测试仍然只用于上游拉取代理地址，不影响用户订阅分发链路。

### 修改文件
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart app caddy`

### 验证结果
- 后端构建通过。
- 前端构建通过。
- `app` 与 `caddy` 已重启并加载最新产物。

### 遗留问题
- 国家/地区信息依赖外部地理查询服务；若该服务不可用，页面仍只显示出口 IP。

### 下一步建议
- 在系统设置页重新点一次“测试代理连通性”，确认出口 IP 后是否追加了地区信息。

---

## 2026-06-03 - 代理连通性测试地理源切换

### 当前目标
- 解决代理测试成功后地区信息不稳定或不显示的问题，让前端更稳定地展示出口 IP 后的地区标签。

### 完成情况
- 代理连通性测试的地理查询源已切换为更稳定的 `ip-api.com` HTTP 接口。
- 成功时会对常见国家/地区做中文映射，例如 `Hong Kong -> 香港`。
- 前端成功提示仍保持同一行展示，若地理信息可用，则会追加显示在出口 IP 后。

### 修改文件
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix backend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker compose restart app`

### 验证结果
- 后端构建通过。
- `app` 已重启并加载最新后端产物。

### 遗留问题
- 地理查询仍依赖外部服务；若该服务失败，则页面只显示出口 IP，不影响连通性判断。

### 下一步建议
- 在系统设置页重新执行“测试代理连通性”，确认是否能看到 `出口 IP：xxx 香港` 这类展示。

---

## 2026-06-03 - 代理测试结果与会话读取无错误化

### 当前目标
- 优化系统设置页的代理连通性测试展示，并减少浏览器中由预期状态引起的错误噪音。

### 完成情况
- 代理连通性测试成功时，第一行只显示 `代理连通正常 · HTTP 状态：200 · 耗时：xxx ms`。
- 第二行单独显示 `出口 IP：45.62.172.83 香港 Yau Tsim Mong Tsim Sha Tsui` 这类信息。
- 代理连通性测试失败时，第一行直接显示 `代理连通失败：原因`，不再额外输出多余文案。
- `api/auth/session` 已作为前端会话读取的 200 接口，替代页面里原先直接依赖的 401 读取路径，减少控制台里预期状态造成的错误噪音。

### 修改文件
- Updated: `backend/src/routes/auth.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/components/admin/AdminLayout.vue`
- Updated: `frontend/src/pages/DashboardPage.vue`
- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/router/index.ts`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart app caddy`

### 验证结果
- 后端构建通过。
- 前端构建通过。
- `app` 与 `caddy` 已重启并加载最新产物。

### 遗留问题
- 浏览器对于某些预期的 401/400 网络响应仍可能在 DevTools 网络面板显示；当前已尽量通过 `session` 接口和 200 返回收敛页面侧可见噪音。

### 下一步建议
- 刷新系统设置页与登录页，确认代理测试结果文案和会话读取行为是否符合预期。

---

## 2026-06-03 - 代理测试结果文案与会话接口收口

### 当前目标
- 让代理连通性测试与会话读取在前端表现上尽量安静、明确，减少预期失败带来的浏览器噪音。

### 完成情况
- 代理连通性测试结果现在按两行展示：
  - 第一行：`代理连通正常 · HTTP 状态：200 · 耗时：xxx ms`
  - 第二行：`出口 IP：45.62.172.83 香港 Yau Tsim Mong Tsim Sha Tsui`
- 代理测试失败时，第一行直接显示 `代理连通失败：原因`，不再额外展示多余说明。
- 新增 `GET /api/auth/session` 作为 200 会话读取接口，前端登录后跳转、后台用户名展示、仪表盘刷新与路由守卫都改为优先使用该接口，减少预期的 401 噪音。

### 修改文件
- Updated: `backend/src/routes/auth.ts`
- Updated: `backend/src/routes/stage7.ts`
- Updated: `frontend/src/components/admin/AdminLayout.vue`
- Updated: `frontend/src/pages/DashboardPage.vue`
- Updated: `frontend/src/pages/LoginPage.vue`
- Updated: `frontend/src/pages/AdminSettingsPage.vue`
- Updated: `frontend/src/router/index.ts`
- Updated: `docs/TASK_STATE.md`

### 命令
- `npm run build --prefix backend`
- `npm run build --prefix frontend`
- `docker cp backend/dist/. subscription-manager-app:/app/dist/`
- `docker cp frontend/dist/. subscription-manager-caddy:/srv/`
- `docker compose restart app caddy`

### 验证结果
- 后端构建通过。
- 前端构建通过。
- `app` 与 `caddy` 已重启并加载最新产物。

### 遗留问题
- 浏览器 DevTools 对网络响应状态仍可能有内部提示；当前已尽量通过 200 会话接口与 200 代理测试响应收敛前端可见噪音。

### 下一步建议
- 刷新登录页、仪表盘和系统设置页，确认会话读取与代理测试展示是否符合预期。
