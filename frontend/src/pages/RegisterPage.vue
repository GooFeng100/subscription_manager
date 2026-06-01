<template>
  <section class="card">
    <h2>用户注册</h2>
    <div class="form">
      <input v-model="username" placeholder="用户名" />
      <input v-model="password" placeholder="密码（至少8位）" type="password" />
      <button @click="submit">注册</button>
      <p class="msg">{{ msg }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/api";

const username = ref("");
const password = ref("");
const msg = ref("");

async function submit() {
  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    msg.value = "注册成功，请前往登录";
  } catch (e) {
    msg.value = (e as Error).message;
  }
}
</script>
