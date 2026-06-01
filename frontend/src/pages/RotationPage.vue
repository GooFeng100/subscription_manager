<template>
  <section class="card">
    <h2>手动轮换</h2>
    <p>当前订阅版本：{{ status?.sub_version ?? "-" }}</p>
    <p>受影响有效用户：{{ status?.active_user_count ?? "-" }}</p>
    <p>启用上游数：{{ status?.enabled_upstream_count ?? "-" }}</p>

    <div class="form">
      <input v-model="reason" placeholder="轮换原因" />
      <input v-model="confirmText" :placeholder="`输入 ${status?.confirm_text || 'ROTATE'} 确认`" />
      <button @click="execute">执行轮换</button>
      <button class="ghost" @click="refresh">刷新状态</button>
      <p class="msg">{{ msg }}</p>
    </div>

    <h3>轮换日志</h3>
    <ul>
      <li v-for="log in logs" :key="log.id">
        v{{ log.from_version }} -> {{ log.to_version === null ? 'FAILED' : 'v' + log.to_version }} |
        {{ log.reason }} |
        {{ log.operator_username }} |
        {{ log.success ? 'success' : 'failed' }} |
        impacted {{ log.impacted_user_count }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/api";

type RotationStatus = {
  sub_version: string;
  active_user_count: number;
  enabled_upstream_count: number;
  confirm_text: string;
};

type RotationLog = {
  id: string;
  from_version: string;
  to_version: string | null;
  reason: string;
  operator_username: string;
  impacted_user_count: number;
  success: boolean;
};

const status = ref<RotationStatus | null>(null);
const logs = ref<RotationLog[]>([]);
const reason = ref("manual rotate");
const confirmText = ref("");
const msg = ref("");

async function refresh() {
  try {
    status.value = await api<RotationStatus>("/api/admin/rotation/status");
    const data = await api<{ items: RotationLog[] }>("/api/admin/rotation/logs");
    logs.value = data.items;
    msg.value = "已刷新";
  } catch (e) {
    msg.value = (e as Error).message;
  }
}

async function execute() {
  try {
    const data = await api<{ message: string }>("/api/admin/rotation/execute", {
      method: "POST",
      body: JSON.stringify({ reason: reason.value, confirmText: confirmText.value })
    });
    msg.value = data.message;
    await refresh();
  } catch (e) {
    msg.value = (e as Error).message;
  }
}

void refresh();
</script>
