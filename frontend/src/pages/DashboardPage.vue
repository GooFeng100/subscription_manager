<template>
  <section class="card">
    <h2>我的订阅</h2>
    <p>状态：{{ me?.status || "-" }}</p>
    <p>到期：{{ fmtDate(me?.expire_at) }}</p>
    <p>失效：{{ fmtDate(me?.disable_after) }}</p>
    <div class="form">
      <input :value="subUrl" readonly />
      <button @click="copyLink">复制订阅链接</button>
      <button class="ghost" @click="refresh">刷新</button>
      <p class="msg">{{ msg }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { API_BASE, api, fmtDate } from "../lib/api";

type Me = {
  username: string;
  status: string;
  expire_at: string | null;
  disable_after: string | null;
  sub_token: string;
};

const me = ref<Me | null>(null);
const msg = ref("");

const subUrl = computed(() => {
  if (!me.value?.sub_token) return "请先登录";
  return `${API_BASE}/sub/${me.value.sub_token}?target=clash`;
});

async function refresh() {
  try {
    me.value = await api<Me>("/api/auth/me");
    msg.value = "已刷新";
  } catch (e) {
    msg.value = (e as Error).message;
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(subUrl.value);
    msg.value = "已复制";
  } catch {
    msg.value = "复制失败";
  }
}

void refresh();
</script>
