<template>
  <UserMobileLayout title="兑换" subtitle="授权码兑换/续费商城">
    <section class="panel redeem-panel" aria-labelledby="redeem-form-title">
      <h2 id="redeem-form-title" class="section-title">授权码兑换</h2>
      <label class="label" for="redeem-code">授权码</label>
      <input
        id="redeem-code"
        name="redeemCode"
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
    </section>

    <section class="panel shop-panel" aria-labelledby="shop-title">
      <h2 id="shop-title" class="section-title">商城</h2>
      <div class="shop-list">
        <a class="shop-item" href="https://www.qianxun1688.com/details/54940682" target="_blank" rel="noreferrer">
          <img :src="buy1Image" alt="商城图片1" loading="eager" />
        </a>
        <a class="shop-item" href="https://www.qianxun1688.com/details/2B2F0B12" target="_blank" rel="noreferrer">
          <img :src="buy2Image" alt="商城图片2" loading="eager" />
        </a>
      </div>
    </section>
  </UserMobileLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api, fmtDateOnly } from "../lib/api";
import UserMobileLayout from "../components/user/UserMobileLayout.vue";

const code = ref("");
const msg = ref("");
const loading = ref(false);
const error = ref(false);
const buy1Image = "/redeem-assets/buy-1.png";
const buy2Image = "/redeem-assets/buy-2.png";

async function submit() {
  if (!code.value) {
    msg.value = "请输入授权码";
    error.value = true;
    return;
  }
  try {
    loading.value = true;
    const data = await api<{ expire_at: string; expireDate?: string; message?: string }>("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ code: code.value.trim().toUpperCase() })
    });
    msg.value = data.message || `兑换成功，到期 ${data.expireDate || fmtDateOnly(data.expire_at)}`;
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
.panel {
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  border: 1px solid #d9e3f2;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(42, 83, 151, 0.06);
}

.panel + .panel {
  margin-top: 14px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 18px;
  line-height: 1.2;
  color: #173c85;
}

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

.shop-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.shop-item {
  display: block;
  text-decoration: none;
  border: 1px solid #d7e1f2;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.shop-item:hover {
  transform: translateY(-2px);
  border-color: #9cb8ef;
  box-shadow: 0 12px 24px rgba(31, 71, 166, 0.12);
}

.shop-item:active {
  transform: translateY(0);
  box-shadow: 0 6px 16px rgba(31, 71, 166, 0.1);
}

.shop-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: linear-gradient(180deg, #edf3ff 0%, #f8fbff 100%);
}

@media (max-width: 640px) {
  .panel {
    padding: 14px;
    border-radius: 14px;
  }

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

  .section-title {
    font-size: 19px;
  }
}
</style>
