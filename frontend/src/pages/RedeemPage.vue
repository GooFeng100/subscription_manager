<template>
  <section class="card">
    <h2>授权码兑换</h2>
    <div class="form">
      <input v-model="code" placeholder="SM-XXXXXXXXXX" />
      <button @click="submit">兑换</button>
      <p class="msg">{{ msg }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api, fmtDate } from "../lib/api";

const code = ref("");
const msg = ref("");

async function submit() {
  try {
    const data = await api<{ expire_at: string }>("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ code: code.value })
    });
    msg.value = `兑换成功，到期 ${fmtDate(data.expire_at)}`;
  } catch (e) {
    msg.value = (e as Error).message;
  }
}
</script>
