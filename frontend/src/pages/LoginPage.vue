<template>
  <section class="card">
    <h2>用户登录</h2>
    <div class="form">
      <input v-model="username" placeholder="用户名" />
      <input v-model="password" placeholder="密码" type="password" />
      <button @click="submit">登录</button>
      <p class="msg">{{ msg }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";

const router = useRouter();
const username = ref("");
const password = ref("");
const msg = ref("");

async function submit() {
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    msg.value = "登录成功";
    await router.push("/dashboard");
  } catch (e) {
    msg.value = (e as Error).message;
  }
}
</script>
