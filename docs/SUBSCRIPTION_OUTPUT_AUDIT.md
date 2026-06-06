# Subscription Output Audit

> 说明：第 1-16 节为 2026-06-06 修复前审查快照；第 17 节记录 2026-06-07 修复后的复核结论。

## 1. 审查时间

- 时间：2026-06-06 23:56:05 CST
- 范围：只审查当前订阅输出机制；未修改业务代码。

## 2. 测试环境

- 项目目录：`/vol1/1000/docker/subscription_manager`
- 测试入口：`http://127.0.0.1:8084`
- 对外 NAS 入口：`http://192.168.10.3:8084`
- Compose 文件：`compose.yaml`
- 容器状态：
  - `subscription-manager-app`: Up
  - `subscription-manager-caddy`: Up, `0.0.0.0:8084->80/tcp`
  - `subscription-manager-mongodb`: Up, healthy
  - `subscription-manager-redis`: Up, healthy
  - `subscription_manager_subconverter`: Up
- 当前订阅版本：`26.6.104`
- 当前文件名模板：`{{username}}_云域数字`
- 当前节点池：63 条 `trojan://` 节点；`ss://`、`vmess://`、`vless://` 等为 0。

## 3. 测试 token 脱敏说明

- active 用户：`test0003`，token `qDI0****1B`
- grace 用户：`codexExpired1780674926`，token `RLqZ****1j`
- expired 用户：`test0001`，token `nEFh****qh`
- inactive/disabled：本轮临时插入 `codexAuditInactive` / `codexAuditDisabled` 测试用户，测试后已删除；token 只输出脱敏形式。
- 报告不包含完整 token、节点正文、节点密码、上游 URL 或代理密码。

## 4. 当前订阅接口列表

- 主入口：`GET /sub/:token?target=<target>`
- 内部源入口：`GET /api/internal/converter-source/:cacheKey?secret=...&format=base64`
- 直接输出目标：
  - `target=shadowrocket`：后端从节点池直出 Base64。
  - `target=ss`：后端从节点池生成 raw 节点列表，再整体 Base64 输出。
- subconverter 输出目标：
  - `target=clash`：传给 subconverter。
  - `target=mihomo`：后端映射为 subconverter `target=clash`，响应后再返回。
  - `target=sing-box`：后端映射为 subconverter `target=singbox`。
  - 其他 target：原样传给 subconverter。

## 5. 各 target 响应头对比

| target | HTTP | body bytes | X-Subscription-Version | Subscription-Userinfo | Content-Disposition | Content-Type | Cache-Control | profile-title |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| clash | 200 | 202880 | `26.6.104` | `expire=1781971199` | `attachment; ... test0003_云域数字.yaml` | `text/plain; charset=utf-8` | `no-store, no-cache, must-revalidate, proxy-revalidate` | absent |
| mihomo | 200 | 202880 | `26.6.104` | `expire=1781971199` | `attachment; ... test0003_云域数字.yaml` | `text/plain; charset=utf-8` | same | absent |
| ss | 200 | 13760 | `26.6.104` | `expire=1781971199` | `inline; ... test0003_云域数字.txt` | `text/plain; charset=utf-8` | same | absent |
| shadowrocket | 200 | 13824 | `26.6.104` | `expire=1781971199` | `attachment; ... test0003_云域数字.yaml` | `text/plain; charset=utf-8` | same | absent |
| sing-box | 200 | 84968 | `26.6.104` | `expire=1781971199` | `attachment; ... test0003_云域数字.yaml` | `text/plain; charset=utf-8` | same | absent |

说明：`filename="test0003_____.yaml"` 是 ASCII fallback；`filename*=UTF-8''test0003_%E4%BA%91%E5%9F%9F%E6%95%B0%E5%AD%97.yaml` 保留中文文件名，现代客户端/浏览器应优先使用 `filename*`。

## 6. subscription-userinfo 当前状态

- 当前已返回 header 名：`Subscription-Userinfo`，HTTP header 大小写不敏感。
- 当前内容只有：`expire=<unix seconds>`。
- 未返回：`upload=...; download=...; total=...`。
- active/grace/expired/disabled 且有 `expire_at` 的用户会返回 `expire`。
- inactive 用户 `expire_at=null`，当前不返回 `Subscription-Userinfo`。
- `expire` 来源：`backend/src/routes/stage4.ts` 的 `buildSubscriptionUserInfo()`，使用用户真实 `expire_at` 的 Unix 秒级时间戳。
- upload/download/total 来源：当前系统没有实现，没有数据库字段或运行时计算链路。

结论：客户端卡片上的有效期更可能来自 `Subscription-Userinfo: expire=...`；客户端卡片上的流量信息当前不可能来自本系统响应头，因为 upload/download/total 未返回。

## 7. Content-Disposition / 文件名当前状态

- 文件名生成位置：`backend/src/routes/stage4.ts` 的 `buildSubscriptionFilename()`。
- 默认模板位置：
  - `backend/src/lib/runtime-settings.ts`
  - `frontend/src/pages/AdminSettingsPage.vue`
  - MongoDB `system_state.runtime_settings.payload.subscription_filename_template`
- 当前模板：`{{username}}_云域数字`。
- 后端兼容旧默认模板：如果运行时模板仍是 `{{username}}_V{{version}}`，会映射为 `{{username}}_云域数字`。
- `Content-Disposition`：
  - Clash/Mihomo/Sing-box/Shadowrocket 使用 `attachment; filename=...yaml; filename*=...yaml`。
  - SS 使用 `inline; filename=...txt; filename*=...txt`。
- subconverter 请求参数 `filename`：只用于经过 subconverter 的目标，当前为 `test0003_云域数字`。
- 前端复制订阅链接：只拼接 `/sub/:token?target=<target>`，没有拼接 `filename`、`name`、`version` 参数。
- 客户端刷新订阅时配置名是否跟随 `Content-Disposition` 实时更新：这是客户端行为，不可完全由后端控制；不少客户端只在首次导入时使用文件名或 URL 名称。

## 8. X-Subscription-Version 当前状态

- 当前所有已测 target 均返回：`X-Subscription-Version: 26.6.104`。
- 来源：`backend/src/services/subscription-version.ts` 的 `getCurrentSubVersion()`，读取 MongoDB `system_state` 中 `key=subscription_version` 的 `sub_version`。
- 更新路径：
  - `upstream-batch-runner` 在批量上游测试成功后调用 `bumpCurrentSubVersion()`。
  - `stage6` 手动轮换执行时调用 `bumpCurrentSubVersion()`。
- 因此，上游轮询/手动轮换使版本 +1 后，此 header 会变化；所有 target 在同一次读取中应一致。

## 9. Clash/Mihomo YAML 检查结果

| 项目 | clash | mihomo |
| --- | --- | --- |
| YAML 解析 | pass | pass |
| proxy-groups | 20 个 | 20 个 |
| 第一个 proxy-group | `📌 订阅信息｜V26.6.104｜到期 2026-06-20` | same |
| 最后一个 proxy-group | `🇺🇸 美国自动` | same |
| 订阅信息组数量 | 1 | 1 |
| 信息组位置 | 第 1 个，index 0 | 第 1 个，index 0 |
| 信息组 proxies | `["DIRECT"]` | `["DIRECT"]` |
| rules 引用信息组 | false | false |
| `🚀 出站节点` 是否存在 | true | true |
| `🚀 出站节点` 是否改名 | false | false |

设计影响判断：动态信息组是一个只含 `DIRECT` 的 select 组，且 `rules` 不引用它；真实分流仍引用原 `🚀 出站节点`，当前设计不会改变实际分流路径。

## 10. SS/Shadowrocket base64 节点检查结果

| 项目 | ss | shadowrocket |
| --- | --- | --- |
| body 是否 Base64 | true | true |
| Base64 解码后行数 | 63 | 63 |
| 解码后是否节点列表 | true | true |
| 首个节点协议 | `trojan` | `trojan` |
| 首个节点名 | `📌 V26.6.104｜到期 2026-06-20｜节点` | same |
| 首个 fragment 是否百分号编码 | false | true |
| 是否只改第一个真实节点 | 是 | 是 |
| 后续节点是否保持原名 | 是，抽样为 `Hong Kong \| 01` 等 | 是 |

说明：当前首条上游节点本身没有原始 fragment，因此系统追加的是 `节点`，不是某个已有原节点名。若首条节点原本有名称，代码会拼成 `📌 V...｜到期 ...｜原节点名`。

## 11. 用户状态 active/expired/inactive 测试结果

| status | target | HTTP | 是否泄露节点 | Subscription-Userinfo | body 行为 |
| --- | --- | --- | --- | --- | --- |
| active | clash/ss/shadowrocket | 200 | active 应返回真实节点 | `expire=1781971199` | 正常订阅 |
| grace | clash/ss/shadowrocket | 200 | grace 应返回真实节点 | `expire=1780272000` | 正常订阅 |
| expired | clash | 200 | false | `expire=1778803200` | 空 Clash YAML |
| expired | ss | 200 | false | `expire=1778803200` | `# 订阅已过期，请联系管理员` |
| expired | shadowrocket | 200 | false | `expire=1778803200` | 空正文 |
| inactive | clash | 200 | false | absent | 空 Clash YAML |
| inactive | ss | 200 | false | absent | `# 账号未授权，请兑换授权码` |
| inactive | shadowrocket | 200 | false | absent | 空正文 |
| disabled | clash | 200 | false | `expire=1798675200` | 空 Clash YAML |
| disabled | ss | 200 | false | `expire=1798675200` | `# 账号已禁用，请联系管理员` |
| disabled | shadowrocket | 200 | false | `expire=1798675200` | 空正文 |

结论：expired/inactive/disabled 均返回 200 且不泄露节点。非 active 状态下 `target=ss` 没有保持 Base64 格式，而是返回明文提示。

## 12. 安全脱敏检查

- 订阅访问日志 `sub_access_logs` 中 token 使用 `maskToken()` 存储，抽查为 `qDI0k6****` 形式。
- app 容器日志抽查未发现完整 token、节点正文、节点密码、代理密码、Turnstile secret、SESSION_SECRET 或 CONVERTER_SOURCE_SECRET。
- 上游批量测试日志使用 `maskUrlForLog()` 输出 `source_url_masked`。
- 管理员页面仍会在用户详情/编辑区域显示完整 `sub_token`，这是已登录管理员功能面；不属于公共泄露，但属于可进一步收紧的暴露面。
- 用户前端 Dashboard 必然展示/复制包含 token 的订阅链接，这是订阅功能本身所需。
- 本轮临时测试响应体保存在 `/tmp/sub-audit`，报告未展开节点正文。

## 13. 当前已符合项

- active/grace 用户可获取真实订阅。
- expired/inactive/disabled 不返回真实节点。
- Clash/Mihomo YAML 可解析。
- Clash/Mihomo 只有一个动态信息组，且位于 `proxy-groups` 第一个。
- 动态信息组只含 `DIRECT`，`rules` 不引用它。
- `🚀 出站节点` 保留且未改名。
- `X-Subscription-Version` 所有已测 target 一致。
- 文件名主体已改为 `用户名_云域数字`，并通过 `filename*` 支持 UTF-8 中文。
- 前端复制订阅链接没有拼接 `filename/name/version` 参数。

## 14. 当前不符合项

- `Subscription-Userinfo` 缺少 `upload/download/total`，客户端无法从当前 header 显示流量。
- `profile-title` 和 `profile-update-interval` 当前未返回。
- `sing-box` 返回 JSON，但 `Content-Disposition` 后缀仍为 `.yaml`，`Content-Type` 也是 `text/plain`。
- `shadowrocket` 返回 Base64 节点订阅，但 `Content-Disposition` 后缀仍为 `.yaml`。
- 非 active 状态下 `target=ss` 返回明文提示，不是 Base64 空订阅格式。
- 用户 Dashboard 的 target 选项没有 `mihomo`、`shadowrocket`、`sing-box`，但包含 `surge/quanx/surfboard/loon` 等未经本轮重点验证的目标。

## 15. 建议修改项

1. 增加完整 `Subscription-Userinfo`：`upload=0; download=0; total=...; expire=...`，至少保证客户端能稳定显示有效期和流量占位。
2. 增加 `profile-title: 用户名_云域数字` 和合适的 `profile-update-interval`，提升 Clash/Mihomo 客户端卡片名称稳定性。
3. 按 target 设置 Content-Disposition 后缀：
   - `clash/mihomo`: `.yaml`
   - `sing-box`: `.json`
   - `ss/shadowrocket`: 可考虑 `.txt` 或客户端更兼容的扩展。
4. 非 active 状态下，让 `target=ss` / `target=shadowrocket` 返回客户端可接受的空 Base64 或空正文规范，保持同一 target 格式一致。
5. 用户 Dashboard target 列表与后端支持矩阵对齐，补充 `Mihomo`、`Shadowrocket`、`sing-box`，或明确隐藏未稳定支持的目标。
6. 管理员用户详情中的完整 token 可增加“点击显示/复制”交互，降低旁观泄露风险。

## 16. P0/P1/P2 分级

### P0

- 未发现。

### P1

- `Subscription-Userinfo` 不完整：active/grace 仅返回 `expire`，没有 `upload/download/total`，客户端流量卡片无法从当前系统获取数据。
- target 格式一致性不足：非 active 状态下 `target=ss` 返回明文提示，不是 Base64 格式；部分客户端可能按 Base64 解析失败。

### P2

- `sing-box` JSON 使用 `.yaml` 文件名和 `text/plain` Content-Type。
- `shadowrocket` Base64 订阅使用 `.yaml` 文件名。
- 未返回 `profile-title` / `profile-update-interval`。
- 用户 Dashboard target 列表与后端实际重点支持目标不完全一致。
- 管理端完整 token 展示可进一步做显隐控制。

## 17. 2026-06-07 修复后复核

本节为第 1-16 节审查后的最小修复复核，保留前文作为历史快照。

### 已修复项

- `Subscription-Userinfo` 保留真实 `expire=<用户 expire_at Unix 秒>`。
- 当前系统不统计真实流量，因此不返回 `upload/download/total`，不再将缺少这些字段标记为 P1。
- 已新增 `Profile-Title: 用户名_云域数字`，用户名为空时使用 `云域数字`。
- 已新增 `Profile-Update-Interval: 24`。
- `target=ss` 在 expired/inactive/disabled 等非 active 状态下返回 200 空正文，不再返回明文中文提示，不泄露节点。
- `target=ss` active/grace 返回 Base64 节点订阅，首节点 fragment 使用 URL 百分号编码，客户端解码后显示正常中文，避免 Base64 解码文本出现 mojibake。
- `target=shadowrocket` active/grace 返回 Base64 节点订阅，文件后缀已改为 `.txt`。
- `target=sing-box` 文件后缀已改为 `.json`，`Content-Type` 已改为 `application/json; charset=utf-8`。

### 修复后 target 输出矩阵

| target | 后缀 | Content-Type | 正文格式 |
| --- | --- | --- | --- |
| clash | `.yaml` | `text/plain; charset=utf-8` | Clash YAML |
| mihomo | `.yaml` | `text/plain; charset=utf-8` | Mihomo/Clash YAML |
| sing-box | `.json` | `application/json; charset=utf-8` | sing-box JSON |
| ss | `.txt` | `text/plain; charset=utf-8` | Base64 节点订阅；非 active 为空正文 |
| shadowrocket | `.txt` | `text/plain; charset=utf-8` | Base64 节点订阅；非 active 为空正文 |

### 修复后风险分级

### P0

- 未发现。

### P1

- 未发现。

### P2

- 用户 Dashboard target 列表与后端重点支持目标仍可进一步对齐；本轮按要求未修改。
- 管理端完整 token 展示可进一步做显隐控制；本轮按要求未修改。
