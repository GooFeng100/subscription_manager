<template>
  <main class="shell">
    <h1>Subscription Manager - Stage 2</h1>
    <p class="hint">API: {{ apiBase }}</p>

    <section class="card">
      <h2>1) 登录</h2>
      <div class="row">
        <input v-model="auth.username" placeholder="username" />
        <input v-model="auth.password" placeholder="password" type="password" />
        <button @click="loginAdmin">管理员登录</button>
        <button @click="loginUser">用户登录</button>
        <button class="ghost" @click="logout">退出</button>
      </div>
      <p class="hint">{{ authState }}</p>
    </section>

    <section class="card">
      <h2>2) 用户管理（管理员）</h2>
      <div class="row">
        <button @click="loadUsers">刷新用户</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>用户名</th>
            <th>状态</th>
            <th>到期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.username }}</td>
            <td>{{ u.status }}</td>
            <td>{{ fmt(u.expire_at) }}</td>
            <td class="row">
              <button @click="setStatus(u.id, 'active')">激活</button>
              <button @click="setStatus(u.id, 'disabled')">禁用</button>
              <button @click="renewUser(u.id)">续期30天</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card">
      <h2>3) 授权码（管理员）</h2>
      <div class="row">
        <button @click="createCode">生成 1 个授权码</button>
        <button @click="loadCodes">刷新授权码</button>
      </div>
      <p class="hint">最新可用：{{ latestCode || "-" }}</p>
      <ul>
        <li v-for="c in codes" :key="c.id">
          {{ c.code }} | {{ c.status }} | {{ c.duration_days }}d + {{ c.grace_days }}d
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>4) 授权码兑换（用户）</h2>
      <div class="row">
        <input v-model="redeemCode" placeholder="SM-XXXXXXXXXX" />
        <button @click="redeem">兑换</button>
      </div>
      <p class="hint">{{ redeemResult }}</p>
    </section>

    <section class="card">
      <h2>5) 续期记录（管理员）</h2>
      <div class="row">
        <button @click="loadRenewLogs">刷新记录</button>
      </div>
      <ul>
        <li v-for="log in renewLogs" :key="log.id">
          {{ log.username }} | {{ log.source }} | {{ fmt(log.next_expire_at) }} | {{ log.operator_username }}
        </li>
      </ul>
    </section>

    <p class="hint">{{ message }}</p>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";

type UserItem = {
  id: string;
  username: string;
  status: string;
  expire_at: string | null;
};

type CodeItem = {
  id: string;
  code: string;
  status: string;
  duration_days: number;
  grace_days: number;
};

type RenewLogItem = {
  id: string;
  username: string;
  source: string;
  next_expire_at: string;
  operator_username: string;
};

const apiBase = import.meta.env.VITE_APP_BASE_URL || "http://192.168.10.3:8084";
const auth = ref({ username: "admin", password: "admin123456" });
const authState = ref("未登录");
const users = ref<UserItem[]>([]);
const codes = ref<CodeItem[]>([]);
const renewLogs = ref<RenewLogItem[]>([]);
const latestCode = ref("");
const redeemCode = ref("");
const redeemResult = ref("");
const message = ref("");

function fmt(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

async function req(path: string, init?: RequestInit) {
  const resp = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.message || `HTTP ${resp.status}`);
  }
  return data;
}

async function loginAdmin() {
  try {
    await req("/api/auth/admin/login", {
      method: "POST",
      body: JSON.stringify(auth.value)
    });
    authState.value = "管理员已登录";
  } catch (error) {
    authState.value = (error as Error).message;
  }
}

async function loginUser() {
  try {
    await req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(auth.value)
    });
    authState.value = "用户已登录";
  } catch (error) {
    authState.value = (error as Error).message;
  }
}

async function logout() {
  await req("/api/auth/logout", { method: "POST" });
  authState.value = "已退出";
}

async function loadUsers() {
  const data = await req("/api/admin/users");
  users.value = data.items || [];
}

async function setStatus(userId: string, status: string) {
  await req(`/api/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadUsers();
}

async function renewUser(userId: string) {
  await req(`/api/admin/users/${userId}/renew`, {
    method: "POST",
    body: JSON.stringify({ durationDays: 30, graceDays: 3 })
  });
  await loadUsers();
  await loadRenewLogs();
}

async function createCode() {
  const data = await req("/api/admin/codes", {
    method: "POST",
    body: JSON.stringify({ count: 1, durationDays: 30, graceDays: 3 })
  });
  latestCode.value = data.items?.[0]?.code || "";
  await loadCodes();
}

async function loadCodes() {
  const data = await req("/api/admin/codes?limit=50");
  codes.value = data.items || [];
  latestCode.value = codes.value.find((c) => c.status === "unused")?.code || latestCode.value;
}

async function redeem() {
  try {
    const data = await req("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ code: redeemCode.value })
    });
    redeemResult.value = `兑换成功，到期 ${fmt(data.expire_at)}`;
  } catch (error) {
    redeemResult.value = (error as Error).message;
  }
}

async function loadRenewLogs() {
  const data = await req("/api/admin/renew-logs");
  renewLogs.value = data.items || [];
}

void loadUsers().catch((error) => {
  message.value = (error as Error).message;
});
</script>

<style scoped>
.shell {
  max-width: 1080px;
  margin: 24px auto;
  padding: 16px;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.card {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}

.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

input {
  padding: 6px 8px;
}

button {
  border: 1px solid #374151;
  background: #111827;
  color: #fff;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}

button.ghost {
  background: #fff;
  color: #111827;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  padding: 6px 4px;
  text-align: left;
}

.hint {
  color: #4b5563;
}
</style>
