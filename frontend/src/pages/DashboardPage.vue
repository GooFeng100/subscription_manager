<template>
  <UserMobileLayout title="我的订阅" subtitle="查看状态并复制订阅链接">
    <div class="meta">
      <div class="meta-item">
        <span>账号</span>
        <strong>{{ me?.username || "-" }}</strong>
      </div>
      <div class="meta-item">
        <span>状态</span>
        <strong>{{ statusLabel(me?.status) }}</strong>
      </div>
      <div class="meta-item">
        <span>到期日</span>
        <strong>
          <span>{{ fmtDateShort(me?.expire_at) }}</span>
          <span v-if="me?.expire_at" class="day-pill" :class="dayMeta(me.expire_at).klass">剩余{{ dayMeta(me.expire_at).days }}天</span>
        </strong>
      </div>
      <div class="meta-item">
        <span>失效日</span>
        <strong>
          <span>{{ fmtDateShort(me?.disable_after) }}</span>
          <span v-if="me?.disable_after" class="day-pill" :class="dayMeta(me.disable_after).klass">剩余{{ dayMeta(me.disable_after).days }}天</span>
        </strong>
      </div>
    </div>

    <div class="label">客户端模板</div>
    <div class="target-buttons">
      <button
        v-for="opt in targetOptions"
        :key="opt.value"
        type="button"
        class="target-btn"
        :class="{ active: target === opt.value }"
        @click="target = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>

    <label class="label" for="dashboard-subscription-url">订阅链接</label>
    <input id="dashboard-subscription-url" name="dashboardSubscriptionUrl" ref="subInput" class="control mono" :value="subUrl" readonly />

    <div class="actions">
      <button class="btn primary" @click="copyLink">{{ copyState === "copied" ? "已复制" : copyButtonText }}</button>
      <button class="btn" @click="refresh">刷新状态</button>
      <button class="btn danger" @click="logout">退出登录</button>
    </div>
    <p class="msg" :class="{ err: error }">{{ msg }}</p>
  </UserMobileLayout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { API_BASE, api, fmtDateOnly } from "../lib/api";
import { takeBootMeCache } from "../lib/auth-cache";
import UserMobileLayout from "../components/user/UserMobileLayout.vue";

type Me = {
  username: string;
  status: string;
  expire_at: string | null;
  disable_after: string | null;
  sub_token: string;
  sub_version?: string | null;
};

const targetOptions = [
  { label: "Clash", value: "clash" },
  { label: "Surge", value: "surge" },
  { label: "Quantumult X", value: "quanx" },
  { label: "Shadowsocks", value: "ss" },
  { label: "Surfboard", value: "surfboard" },
  { label: "Loon", value: "loon" }
] as const;

const me = ref<Me | null>(null);
const msg = ref("");
const error = ref(false);
const target = ref("clash");
const copyState = ref<"idle" | "copied">("idle");
const subInput = ref<HTMLInputElement | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;
const router = useRouter();

const subUrl = computed(() => {
  if (!me.value?.sub_token) return "当前账号未激活，暂无订阅链接";
  return `${API_BASE}/sub/${me.value.sub_token}?target=${target.value}`;
});

const copyButtonText = computed(() => {
  const version = (me.value?.sub_version || "").trim();
  return version ? `复制链接_V${version}` : "复制链接";
});

function statusLabel(status?: string | null) {
  if (!status) return "-";
  if (status === "inactive") return "未授权";
  if (status === "active") return "正常";
  if (status === "grace") return "宽限期";
  if (status === "expired") return "已过期";
  if (status === "disabled") return "已禁用";
  return status;
}

function fmtDateShort(value?: string | null) {
  return fmtDateOnly(value);
}

function dayMeta(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { days: 0, klass: "red" as const };
  const nowDay = fmtDateOnly(new Date().toISOString());
  const targetDay = fmtDateOnly(value);
  const startNow = Date.parse(`${nowDay}T00:00:00.000Z`);
  const startTarget = Date.parse(`${targetDay}T00:00:00.000Z`);
  const diff = Math.floor((startTarget - startNow) / 86400000);
  if (diff < 0) return { days: 0, klass: "red" as const };
  if (diff <= 7) return { days: diff, klass: "yellow" as const };
  return { days: diff, klass: "green" as const };
}

async function refresh() {
  try {
    const cached = takeBootMeCache();
    if (cached && cached.userType === "user" && cached.username) {
      me.value = {
        username: cached.username,
        status: cached.status || "inactive",
        expire_at: cached.expire_at ?? null,
        disable_after: cached.disable_after ?? null,
        sub_token: cached.sub_token || "",
        sub_version: cached.sub_version ?? null
      };
    } else {
      const session = await api<Me & { authenticated?: boolean }>("/api/auth/session");
      if (!session.authenticated) {
        throw new Error("未登录");
      }
      me.value = session;
    }
    msg.value = "已刷新";
    error.value = false;
  } catch (e) {
    msg.value = (e as Error).message;
    error.value = true;
  }
}

async function copyLink() {
  if (!me.value?.sub_token) {
    msg.value = "当前无可复制订阅链接";
    error.value = true;
    return;
  }
  try {
    const text = subUrl.value;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      copied = document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (!copied) {
      if (subInput.value) {
        subInput.value.focus();
        subInput.value.select();
      }
      msg.value = "已选中链接，请手动复制";
      error.value = true;
      copyState.value = "idle";
      return;
    }
    msg.value = "已复制到剪切板";
    error.value = false;
    copyState.value = "copied";
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyState.value = "idle";
    }, 5000);
  } catch {
    msg.value = "复制失败";
    error.value = true;
    copyState.value = "idle";
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    await router.push("/login");
  } catch (e) {
    msg.value = (e as Error).message;
    error.value = true;
  }
}

void refresh();
</script>

<style scoped>
.meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.meta-item {
  border: 1px solid #d6deef;
  background: #f8faff;
  border-radius: 10px;
  padding: 8px 10px;
  display: grid;
  gap: 4px;
}

.meta-item span {
  font-size: 12px;
  color: #5d6d88;
}

.meta-item strong {
  font-size: 14px;
  color: #142c52;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.day-pill {
  display: inline-block;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.day-pill.green {
  background: #ecfdf3;
  color: #15803d;
}

.day-pill.yellow {
  background: #fffbeb;
  color: #a16207;
}

.day-pill.red {
  background: #fef2f2;
  color: #b91c1c;
}

.label {
  display: block;
  font-size: 13px;
  color: #364a70;
  margin: 10px 0 6px;
}

.control {
  width: 100%;
  min-height: 42px;
  border: 1px solid #c8d4ea;
  border-radius: 10px;
  padding: 9px 11px;
  box-sizing: border-box;
}

.target-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 2px;
}

.target-btn {
  min-height: 40px;
  border-radius: 10px;
  border: 1px solid #c8d4ea;
  background: #fff;
  color: #2f4672;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
}

.target-btn.active {
  border-color: #2c63de;
  background: #edf3ff;
  color: #1f4fb8;
}
.target-btn:hover {
  border-color: #7aa2ef;
  background: #f3f7ff;
  color: #1f4fb8;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}
.target-btn:active {
  transform: translateY(1px) scale(0.99);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.25);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.actions {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.btn {
  min-height: 42px;
  border-radius: 10px;
  border: 1px solid #bfd0ef;
  background: #fff;
  color: #27406d;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
}
.btn:hover {
  border-color: #7aa2ef;
  background: #f3f7ff;
  color: #1f4fb8;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}
.btn:active {
  transform: translateY(1px) scale(0.99);
}

.btn.primary {
  background: #2c63de;
  border-color: #2c63de;
  color: #fff;
}
.btn.primary:hover {
  background: #1f4fb8;
  border-color: #1f4fb8;
  color: #fff;
}
.btn.primary:active {
  background: #1e46a3;
  border-color: #1e46a3;
}

.btn.danger {
  color: #c73b3b;
  border-color: #f0c6c6;
}
.btn.danger:hover {
  border-color: #f4aaaa;
  background: #fff5f5;
  color: #b83232;
  box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.12);
}
.btn.danger:active {
  background: #ffecec;
}

.msg {
  margin: 10px 0 2px;
  color: #3760af;
  font-size: 13px;
}

.msg.err {
  color: #cc3f3f;
}

@media (max-width: 640px) {
  .meta {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .meta-item span {
    font-size: 13px;
  }
  .meta-item strong {
    font-size: 16px;
  }
  .label {
    font-size: 14px;
  }
  .mono {
    font-size: 14px;
  }
  .msg {
    font-size: 14px;
  }
  .target-buttons {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }
  .actions {
    grid-template-columns: 1fr;
    gap: 7px;
  }
  .target-btn,
  .btn,
  .control {
    min-height: 44px;
  }
  .target-btn,
  .btn {
    font-size: 16px;
  }
}
</style>
