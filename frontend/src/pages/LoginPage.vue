<template>
  <AuthLayout title="订阅分发系统">
    <form class="form" @submit.prevent="submit">
      <FormField
        v-model="username"
        label="用户名"
        id="login-username"
        name="username"
        placeholder="请输入用户名"
        autocomplete="username"
        :icon-src="usernameIcon"
      />
      <FormField
        v-model="password"
        label="密码"
        id="login-password"
        name="password"
        type="password"
        placeholder="请输入密码"
        autocomplete="current-password"
        :icon-src="passwordIcon"
      />
      <LoadingButton :loading="loading" :disabled="!username || !password" loading-text="登录中..." @click="submit">
        登录
      </LoadingButton>
      <p class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err' }">{{ msg }}</p>
      <hr class="divider" />
      <p class="switch">没有账号？<RouterLink to="/register">立即注册</RouterLink></p>
      <div class="actions">
        <RouterLink class="help-button" to="/help">使用帮助</RouterLink>
      </div>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AuthLayout from '../components/auth/AuthLayout.vue';
import FormField from '../components/ui/FormField.vue';
import LoadingButton from '../components/ui/LoadingButton.vue';
import { api } from '../lib/api';
import { postAuthJson } from '../lib/auth-request';
import { getHomePath } from '../lib/auth-navigation';
import usernameIcon from '../assets/icons/username.png';
import passwordIcon from '../assets/icons/password.png';

type Session = {
  authenticated?: boolean;
  userType?: 'admin' | 'user';
  dashboard?: string;
};

const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);
const msg = ref('');
const msgType = ref<'ok' | 'err' | ''>('');

function clearMessage() {
  if (!msg.value) return;
  msg.value = '';
  msgType.value = '';
}

watch([username, password], () => {
  if (msgType.value === 'err') {
    clearMessage();
  }
});

async function redirectIfAuthenticated() {
  try {
    const session = await api<Session>('/api/auth/session');
    if (session.authenticated && session.userType) {
      await router.replace(getHomePath(session.userType, session.dashboard));
    }
  } catch {
    // No active session, stay on the login page.
  }
}

async function submit() {
  if (!username.value || !password.value || loading.value) return;
  if (!username.value.trim()) {
    msg.value = '请输入用户名';
    msgType.value = 'err';
    return;
  }
  loading.value = true;
  clearMessage();

  const result = await postAuthJson<{ message?: string; dashboard?: string; userType?: string }>('login', '/api/auth/login', {
    username: username.value.trim(),
    password: password.value
  });
  if (!result.ok) {
    msg.value = result.message;
    msgType.value = 'err';
    loading.value = false;
    return;
  }

  msg.value = '登录成功，正在跳转...';
  msgType.value = 'ok';
  await router.replace(getHomePath(result.data.userType as 'admin' | 'user' | undefined, result.data.dashboard));
  loading.value = false;
}

onMounted(() => {
  void redirectIfAuthenticated();
});
</script>

<style scoped>
.form {
  display: grid;
  gap: 12px;
}

.divider {
  border: 0;
  border-top: 1px solid #d5dbe6;
  margin: 2px 0 0;
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

.actions {
  display: flex;
  justify-content: center;
  margin-top: 6px;
}

.help-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid #1d4ed8;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
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

@media (max-width: 640px) {
  .msg,
  .switch {
    font-size: 14px;
  }

  .divider {
    margin-top: 4px;
  }

  .help-button {
    width: 100%;
    font-size: 15px;
  }
}
</style>
