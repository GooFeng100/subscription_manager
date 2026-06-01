<template>
  <AuthLayout title="订阅分发系统">
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
        placeholder="请输入密码"
        autocomplete="current-password"
        :icon-src="passwordIcon"
      />
      <div class="turnstile-placeholder">[Cloudflare Turnstile 验证区域]</div>
      <LoadingButton :loading="loading" :disabled="!username || !password" loading-text="登录中..." @click="submit">
        登录
      </LoadingButton>
      <p class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err' }">{{ msg }}</p>
      <hr class="divider" />
      <p class="switch">没有账号？<RouterLink to="/register">立即注册</RouterLink></p>
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

type Me = {
  dashboard?: string;
};

const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);
const msg = ref('');
const msgType = ref<'ok' | 'err' | ''>('');

async function submit() {
  if (!username.value || !password.value || loading.value) return;
  const uErr = validateUsername(username.value);
  if (uErr) { msg.value = uErr; msgType.value = "err"; return; }
  const pErr = validatePassword(password.value);
  if (pErr) { msg.value = pErr; msgType.value = "err"; return; }
  loading.value = true;
  msg.value = '';
  msgType.value = '';

  try {
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.value, password: password.value })
      });
    } catch (userErr) {
      await api('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.value, password: password.value })
      }).catch(() => {
        throw userErr;
      });
    }

    const me = await api<Me>('/api/auth/me');
    msg.value = '登录成功，正在跳转...';
    msgType.value = 'ok';
    await router.push(me.dashboard || '/dashboard');
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
