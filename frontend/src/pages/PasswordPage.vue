<template>
  <section class="card">
    <h2>修改密码</h2>
    <div class="form">
      <input v-model="oldPassword" type="password" placeholder="旧密码" />
      <input v-model="newPassword" type="password" placeholder="新密码" />
      <button @click="submit">提交</button>
      <p class="msg">{{ msg }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/api";

const oldPassword = ref("");
const newPassword = ref("");
const msg = ref("");

async function submit() {
  try {
    await api("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword: oldPassword.value, newPassword: newPassword.value })
    });
    msg.value = "密码已修改，请重新登录";
  } catch (e) {
    msg.value = (e as Error).message;
  }
}
</script>
