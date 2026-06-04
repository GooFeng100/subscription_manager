<template>
  <UserMobileLayout title="修改密码" subtitle="修改后需要重新登录">
    <label class="label" for="password-old-password">旧密码</label>
    <input id="password-old-password" name="oldPassword" v-model.trim="oldPassword" class="control" type="password" autocomplete="current-password" placeholder="请输入旧密码" />
    <label class="label" for="password-new-password">新密码</label>
    <input id="password-new-password" name="newPassword" v-model.trim="newPassword" class="control" type="password" autocomplete="new-password" placeholder="至少8位" />
    <p class="hint">密码至少 8 位。</p>
    <button class="btn primary" :disabled="loading" @click="submit">
      {{ loading ? "提交中..." : "确认修改" }}
    </button>
    <p class="msg" :class="{ err: error }">{{ msg }}</p>
  </UserMobileLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";
import UserMobileLayout from "../components/user/UserMobileLayout.vue";

const oldPassword = ref("");
const newPassword = ref("");
const msg = ref("");
const loading = ref(false);
const error = ref(false);
const router = useRouter();

async function submit() {
  if (oldPassword.value.length < 8) {
    msg.value = "旧密码至少 8 位";
    error.value = true;
    return;
  }
  if (newPassword.value.length < 8) {
    msg.value = "新密码至少 8 位";
    error.value = true;
    return;
  }
  try {
    loading.value = true;
    const data = await api<{ ok?: boolean; message?: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword: oldPassword.value, newPassword: newPassword.value })
    });
    if (data.ok === false) {
      msg.value = data.message || "修改失败，请检查旧密码";
      error.value = true;
      return;
    }
    msg.value = data.message || "密码已修改，请重新登录";
    error.value = false;
    setTimeout(() => {
      void router.push("/login");
    }, 600);
  } catch (e) {
    const message = (e as Error).message;
    msg.value = message === "Invalid request payload" ? "请输入 8-128 位的新旧密码" : message;
    error.value = true;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.label {
  display: block;
  font-size: 13px;
  color: #364a70;
  margin: 2px 0 6px;
}

.control {
  width: 100%;
  min-height: 42px;
  border: 1px solid #c8d4ea;
  border-radius: 10px;
  padding: 9px 11px;
  box-sizing: border-box;
}

.hint {
  margin: 6px 0 10px;
  color: #6c7f9f;
  font-size: 12px;
}

.btn {
  width: 100%;
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid #2c63de;
  background: #2c63de;
  color: #fff;
  font-weight: 700;
}

.btn:disabled {
  opacity: 0.6;
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
  .label {
    font-size: 15px;
  }

  .hint {
    font-size: 13px;
  }

  .btn,
  .control {
    font-size: 16px;
  }

  .msg {
    font-size: 14px;
  }
}
</style>
