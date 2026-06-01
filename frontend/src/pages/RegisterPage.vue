<template>
  <AuthLayout title="创建账号">
    <form class="form" @submit.prevent="submit">
      <FormField
        v-model="username"
        label="用户名"
        placeholder="请输入用户名"
        autocomplete="username"
        :icon-src="usernameIcon"
      />
      <FormField
        v-model="password"
        label="密码"
        type="password"
        placeholder="至少 8 位密码"
        autocomplete="new-password"
        :icon-src="passwordIcon"
      />
      <FormField
        v-model="confirmPassword"
        label="确认密码"
        type="password"
        placeholder="请再次输入密码"
        autocomplete="new-password"
        :icon-src="passwordIcon"
      />
      <div class="turnstile-placeholder">[Cloudflare Turnstile 验证区域]</div>
      <LoadingButton
        :loading="loading"
        :disabled="!username || !password || !confirmPassword || password !== confirmPassword"
        loading-text="注册中..."
        @click="submit"
      >
        注册
      </LoadingButton>
      <p class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err' }">{{ msg }}</p>
      <hr class="divider" />
      <p class="switch">已有账号？<RouterLink to="/login">立即登录</RouterLink></p>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AuthLayout from '../components/auth/AuthLayout.vue';
import FormField from '../components/ui/FormField.vue';
import LoadingButton from '../components/ui/LoadingButton.vue';
import { api } from '../lib/api';
import { validatePassword, validateUsername } from '../lib/validators';
import usernameIcon from '../assets/icons/username.png';
import passwordIcon from '../assets/icons/password.png';

const router = useRouter();
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const msg = ref('');
const msgType = ref<'ok' | 'err' | ''>('');

async function submit() {
  if (!username.value || !password.value || !confirmPassword.value || loading.value) return;
  const uErr = validateUsername(username.value);
  if (uErr) { msg.value = uErr; msgType.value = "err"; return; }
  const pErr = validatePassword(password.value);
  if (pErr) { msg.value = pErr; msgType.value = "err"; return; }
  if (password.value !== confirmPassword.value) {
    msg.value = '两次输入的密码不一致';
    msgType.value = 'err';
    return;
  }
  loading.value = true;
  msg.value = '';
  msgType.value = '';

  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    msg.value = '注册成功，正在跳转登录页...';
    msgType.value = 'ok';
    setTimeout(() => {
      void router.push('/login');
    }, 500);
  } catch (e) {
    msg.value = (e as Error).message;
    msgType.value = 'err';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.form {
  display: grid;
  gap: 12px;
}

.turnstile-placeholder {
  min-height: 44px;
  border: 1px solid #dde1eb;
  border-radius: 8px;
  background: #f1f3fa;
  color: #475569;
  display: grid;
  place-items: center;
  font-size: 13px;
}

.divider {
  border: 0;
  border-top: 1px solid #d5dbe6;
  margin: 2px 0 0;
}

.msg {
  margin: 0;
  min-height: 18px;
  font-size: 13px;
  text-align: center;
}

.msg.ok {
  color: #15803d;
}

.msg.err {
  color: #b91c1c;
}

.switch {
  margin: 0;
  color: #111827;
  font-size: 13px;
  text-align: center;
}

.switch a {
  color: #1d4ed8;
  text-decoration: none;
  font-weight: 600;
}
</style>
