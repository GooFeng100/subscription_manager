#!/usr/bin/env bash
set -euo pipefail

ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123456}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8084}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/submgr.cookies}"
UPSTREAM_ID="${UPSTREAM_ID:-}"
SUB_TOKEN="${SUB_TOKEN:-}"
TARGET="${TARGET:-clash}"

trap 'echo "FAIL: 第 ${STEP_NO} 步失败：${STEP_DESC:-未知步骤}" >&2' ERR

STEP_NO=0
STEP_DESC=""

log_pass() {
  echo "PASS: $1"
}

run_step() {
  STEP_NO=$((STEP_NO + 1))
  STEP_DESC="$1"
  shift
  echo "STEP ${STEP_NO}: ${STEP_DESC}"
  "$@"
  log_pass "$STEP_DESC"
}

need_node() {
  command -v node >/dev/null 2>&1 || {
    echo "FAIL: 缺少 node，无法解析 JSON" >&2
    exit 1
  }
}

test_upstream() {
  local upstream_id="$1"
  local upstream_name="$2"
  local upstream_type="$3"
  local resp_file code resp
  resp_file=$(mktemp)
  code=$(curl -sS -o "$resp_file" -w "%{http_code}" -b "$COOKIE_JAR" -X POST "${BASE_URL}/api/admin/upstreams/${upstream_id}/test")
  resp=$(cat "$resp_file")
  rm -f "$resp_file"
  if [[ "$code" != "200" ]]; then
    local error_message
    error_message="$(
      node -e '
        const fs=require("fs");
        const input=fs.readFileSync(0,"utf8");
        try {
          const data=JSON.parse(input);
          const error=data.error || data.message || `HTTP ${data.status || process.env.CODE || "?"}`;
          process.stdout.write(String(error));
        } catch {
          process.stdout.write(input.trim() || `HTTP ${process.env.CODE || "?"}`);
        }
      ' <<<"$resp"
    )"
    printf 'FAIL\t%s\t%s' "$code" "$error_message"
    return 1
  fi
  echo "$resp" | node -e '
    const fs=require("fs");
    const data=JSON.parse(fs.readFileSync(0,"utf8"));
    const required=["message","status","type","nodeCount","source_url_masked"];
    for (const key of required) {
      if (!(key in data)) {
        console.error("missing field:", key);
        process.exit(1);
      }
    }
    if (data.status !== 200) {
      console.error("unexpected test status:", data.status, data.message || "");
      process.exit(1);
    }
    process.stdout.write(`OK\t${data.status}\t${data.type}\t${data.nodeCount}\t${data.message || ""}`);
  '
}

test_all_upstreams() {
  local total=0
  local success=0
  local nodes=0
  local failed=0
  local idx=0
  local upstream_id=""
  local upstream_name=""
  local upstream_type=""
  local result=""
  local status_code=""
  local test_type=""
  local test_nodes="0"
  local test_message=""
  local error_message=""
  local summary_lines=()

  mapfile -t UPSTREAM_LINES < /tmp/submgr-upstreams.tsv
  for upstream_line in "${UPSTREAM_LINES[@]}"; do
    IFS=$'\t' read -r upstream_id upstream_name upstream_type <<< "$upstream_line"
    [[ -n "$upstream_id" ]] || continue
    idx=$((idx + 1))
    total=$((total + 1))
    printf '订阅%d %s (%s): ' "$idx" "${upstream_name:-未命名}" "$upstream_type"
    if result="$(test_upstream "$upstream_id" "$upstream_name" "$upstream_type")"; then
      IFS=$'\t' read -r result_kind status_code test_type test_nodes test_message <<< "$result"
      if [[ "$result_kind" != "OK" ]]; then
        echo "unexpected success result format: $result" >&2
        return 1
      fi
      success=$((success + 1))
      nodes=$((nodes + test_nodes))
      summary_lines+=("订阅${idx} ${upstream_name:-未命名}: 成功，HTTP ${status_code}，${test_nodes} 节点（${test_type}）")
      printf '成功，HTTP %s，%s 节点（%s）\n' "$status_code" "$test_nodes" "$test_type"
    else
      IFS=$'\t' read -r result_kind status_code error_message <<< "$result"
      if [[ "$result_kind" != "FAIL" ]]; then
        echo "unexpected failure result format: $result" >&2
        return 1
      fi
      failed=$((failed + 1))
      summary_lines+=("订阅${idx} ${upstream_name:-未命名}: 失败，HTTP ${status_code} - ${error_message}")
      printf '失败，HTTP %s - %s\n' "$status_code" "$error_message"
    fi
  done

  echo "=== 订阅汇总 ==="
  echo "共 ${total} 条订阅，${success} 条成功，共 ${nodes} 个节点"
  printf '%s\n' "${summary_lines[@]}"

  if (( failed > 0 )); then
    return 1
  fi
}

need_node

run_step "管理员登录" curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" \
  "${BASE_URL}/api/auth/admin/login" >/dev/null

run_step "读取系统设置并确认已移除上游UA" bash -lc '
  resp=$(curl -fsS -b "'"$COOKIE_JAR"'" "'"$BASE_URL"'/api/admin/settings")
  echo "$resp" | node -e '"'"'
    const fs=require("fs");
    const data=JSON.parse(fs.readFileSync(0,"utf8"));
    const required=["converter_backend_url","converter_default_target","converter_default_config_url"];
    for (const key of required) {
      if (!(key in data)) {
        console.error("missing setting:", key);
        process.exit(1);
      }
    }
    if ("upstream_fetch_user_agent" in data) {
      console.error("unexpected upstream_fetch_user_agent in settings");
      process.exit(1);
    }
  '"'"'
'

run_step "读取上游列表" bash -lc '
  resp=$(curl -fsS -b "'"$COOKIE_JAR"'" "'"$BASE_URL"'/api/admin/upstreams")
  echo "$resp" | node -e '"'"'
    const fs=require("fs");
    const data=JSON.parse(fs.readFileSync(0,"utf8"));
    const items=data.items || [];
    if (!items.length) {
      console.error("no upstreams found");
      process.exit(1);
    }
    const enabled = items.filter((item) => item.enabled);
    if (!enabled.length) {
      console.error("no enabled upstreams found");
      process.exit(1);
    }
    fs.writeFileSync(
      "/tmp/submgr-upstreams.tsv",
      enabled.map((item) => {
        if (!item.id) {
          console.error("upstream item missing id");
          process.exit(1);
        }
        if (!item.source_type) {
          console.error("upstream item missing source_type");
          process.exit(1);
        }
        return `${item.id}\t${item.name || ""}\t${item.source_type}`;
      }).join("\n")
    );
    console.log("enabled upstreams:", enabled.length);
  '"'"'
'

if [[ -z "$SUB_TOKEN" ]]; then
  echo "STEP ${STEP_NO}: 自动查找可用订阅 token"
  SUB_TOKEN="$(
    curl -fsS -b "$COOKIE_JAR" "${BASE_URL}/api/admin/users" |
      node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); const items=data.items || []; const user=items.find((item) => item.sub_token); if (!user || !user.sub_token) { console.error("no user with sub_token found"); process.exit(1); } process.stdout.write(String(user.sub_token));'
  )"
  log_pass "自动查找可用订阅 token"
fi

run_step "测试所有上游并汇总" test_all_upstreams

run_step "请求最终订阅" bash -lc '
  resp_file=$(mktemp)
  code=$(curl -sS -o "$resp_file" -w "%{http_code}" "'"$BASE_URL"'/sub/'"$SUB_TOKEN"'?target='"$TARGET"'")
  body=$(cat "$resp_file")
  rm -f "$resp_file"
  if [[ "$code" != "200" ]]; then
    echo "subscription http code: $code" >&2
    echo "$body" >&2
    exit 1
  fi
  if ! grep -q "proxies:" <<<"$body"; then
    echo "final subscription missing proxies:" >&2
    exit 1
  fi
  if ! grep -q "rules:" <<<"$body"; then
    echo "final subscription missing rules:" >&2
    exit 1
  fi
  printf "%s\n" "$body" | sed -n '1,20p'
'

echo "ALL PASS"
