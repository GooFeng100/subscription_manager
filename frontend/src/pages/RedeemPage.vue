<template>
  <UserMobileLayout title="兑换授权码" subtitle="输入授权码延长订阅时长">
    <label class="label">授权码</label>
    <input
      v-model.trim="code"
      class="control mono"
      placeholder="请输入授权码"
      maxlength="6"
      inputmode="text"
      autocomplete="one-time-code"
      @input="normalizeCode"
    />
    <p class="hint">格式示例：AB12CD</p>
    <button class="btn primary" :disabled="loading" @click="submit">
      {{ loading ? "兑换中..." : "立即兑换" }}
    </button>
    <p class="msg" :class="{ err: error }">{{ msg }}</p>
  </UserMobileLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api, fmtDate } from "../lib/api";
import UserMobileLayout from "../components/user/UserMobileLayout.vue";

const code = ref("");
const msg = ref("");
const loading = ref(false);
const error = ref(false);

async function submit() {
  if (!code.value) {
    msg.value = "请输入授权码";
    error.value = true;
    return;
  }
  try {
    loading.value = true;
    const data = await api<{ expire_at: string }>("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ code: code.value.trim().toUpperCase() })
    });
    msg.value = `兑换成功，到期 ${fmtDate(data.expire_at)}`;
    error.value = false;
    code.value = "";
  } catch (e) {
    msg.value = (e as Error).message;
    error.value = true;
  } finally {
    loading.value = false;
  }
}

function normalizeCode() {
  code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
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

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
