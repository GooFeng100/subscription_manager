<template>
  <AuthLayout title="创建账号">
    <form class="form" @submit.prevent="submit">
      <FormField
        v-model="username"
        label="用户名"
        id="register-username"
        name="username"
        placeholder="请输入用户名"
        autocomplete="username"
        :icon-src="usernameIcon"
      />
      <FormField
        v-model="password"
        label="密码"
        id="register-password"
        name="password"
        type="password"
        placeholder="至少 8 位密码"
        autocomplete="new-password"
        :icon-src="passwordIcon"
      />
      <FormField
        v-model="confirmPassword"
        label="确认密码"
        id="register-confirm-password"
        name="confirmPassword"
        type="password"
        placeholder="请再次输入密码"
        autocomplete="new-password"
        :icon-src="passwordIcon"
      />
      <TurnstileWidget
        v-if="turnstileRegisterEnabled && turnstileSiteKey"
        ref="turnstileWidget"
        v-model="turnstileToken"
        :site-key="turnstileSiteKey"
        action="register"
        @expired="handleTurnstileExpired"
        @error="handleTurnstileError"
        @timeout="handleTurnstileTimeout"
        @verified="handleTurnstileVerified"
      />
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
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AuthLayout from '../components/auth/AuthLayout.vue';
import FormField from '../components/ui/FormField.vue';
import LoadingButton from '../components/ui/LoadingButton.vue';
import TurnstileWidget from '../components/auth/TurnstileWidget.vue';
import { postAuthJson } from '../lib/auth-request';
import { getPublicConfig } from '../lib/public-config';
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
const turnstileRegisterEnabled = ref(false);
const turnstileSiteKey = ref('');
const turnstileToken = ref('');
const turnstileWidget = ref<InstanceType<typeof TurnstileWidget> | null>(null);

const turnstileRequired = computed(() => turnstileRegisterEnabled.value && Boolean(turnstileSiteKey.value));

function clearMessage() {
  if (!msg.value) return;
  msg.value = '';
  msgType.value = '';
}

watch([username, password, confirmPassword, turnstileToken], () => {
  if (msgType.value === 'err') {
    clearMessage();
  }
});

async function loadPublicConfig() {
  try {
    const config = await getPublicConfig();
    turnstileRegisterEnabled.value = !!config.turnstileRegisterEnabled;
    turnstileSiteKey.value = String(config.turnstileSiteKey || '').trim();
  } catch {
    turnstileRegisterEnabled.value = false;
    turnstileSiteKey.value = '';
  }
}

function handleTurnstileExpired() {
  if (!turnstileRequired.value) return;
  msg.value = '安全验证已过期，请重新验证';
  msgType.value = 'err';
}

function handleTurnstileError() {
  if (!turnstileRequired.value) return;
  msg.value = '安全验证加载失败，请重新验证';
  msgType.value = 'err';
}

function handleTurnstileTimeout() {
  if (!turnstileRequired.value) return;
  msg.value = '安全验证超时，请重新验证';
  msgType.value = 'err';
}

function handleTurnstileVerified() {
  if (msgType.value === 'err' && msg.value.includes('安全验证')) {
    clearMessage();
  }
}

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
  if (turnstileRequired.value && !turnstileToken.value) {
    msg.value = '请先完成 Turnstile 验证';
    msgType.value = 'err';
    return;
  }
  loading.value = true;
  clearMessage();

  const result = await postAuthJson('register', '/api/auth/register', {
    username: username.value.trim(),
    password: password.value,
    turnstileToken: turnstileRequired.value ? turnstileToken.value || undefined : undefined
  });
  turnstileToken.value = '';
  if (!result.ok) {
    msg.value = result.message;
    msgType.value = 'err';
    if (turnstileRequired.value) {
      turnstileWidget.value?.resetWidget();
    }
    loading.value = false;
    return;
  }

  try {
    msg.value = '注册成功，正在跳转登录页...';
    msgType.value = 'ok';
    setTimeout(() => {
      void router.push('/login');
    }, 500);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadPublicConfig();
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

@media (max-width: 640px) {
  .msg,
  .switch {
    font-size: 14px;
  }

  .divider {
    margin-top: 4px;
  }
}
</style>
