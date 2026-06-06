<template>
  <div class="turnstile-shell">
    <div ref="container" class="turnstile-host"></div>
    <p v-if="!siteKey" class="turnstile-hint">Turnstile 暂未配置</p>
    <p v-else-if="loading" class="turnstile-hint">验证组件加载中...</p>
    <p v-else-if="statusMessage" class="turnstile-hint is-error">{{ statusMessage }}</p>
    <button v-if="needsRetry" class="turnstile-retry" type="button" @click="resetWidget">重新验证</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  action?: string;
  cData?: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  "timeout-callback"?: () => void;
  retry?: string;
  "refresh-expired"?: string;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | number;
  reset?: (widgetId: string | number) => void;
  remove?: (widgetId: string | number) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const props = defineProps<{
  siteKey: string;
  modelValue?: string;
  theme?: "light" | "dark" | "auto";
  action?: string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "verified"): void;
  (event: "expired"): void;
  (event: "error"): void;
  (event: "timeout"): void;
}>();

const container = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const widgetId = ref<string | number | null>(null);
const statusMessage = ref("");
const needsRetry = ref(false);
let scriptPromise: Promise<void> | null = null;

const safeSiteKey = computed(() => String(props.siteKey || "").trim());

function loadScript() {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Turnstile script load failed")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Turnstile script load failed"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

function clearWidget() {
  if (widgetId.value !== null && window.turnstile?.remove) {
    window.turnstile.remove(widgetId.value);
  }
  widgetId.value = null;
  if (container.value) {
    container.value.innerHTML = "";
  }
}

function resetWidget() {
  emit("update:modelValue", "");
  statusMessage.value = "";
  needsRetry.value = false;
  if (widgetId.value !== null && window.turnstile?.reset) {
    window.turnstile.reset(widgetId.value);
    return;
  }
  void renderWidget();
}

async function renderWidget() {
  if (!container.value || !safeSiteKey.value) {
    emit("update:modelValue", "");
    return;
  }
  loading.value = true;
  statusMessage.value = "";
  needsRetry.value = false;
  try {
    await loadScript();
    if (!window.turnstile || !container.value) {
      throw new Error("Turnstile not available");
    }
    clearWidget();
    widgetId.value = window.turnstile.render(container.value, {
      sitekey: safeSiteKey.value,
      theme: props.theme || "auto",
      action: props.action,
      retry: "auto",
      "refresh-expired": "auto",
      callback: (token: string) => {
        statusMessage.value = "";
        needsRetry.value = false;
        emit("update:modelValue", token);
        emit("verified");
      },
      "expired-callback": () => {
        emit("update:modelValue", "");
        statusMessage.value = "安全验证已过期";
        needsRetry.value = true;
        emit("expired");
      },
      "error-callback": () => {
        emit("update:modelValue", "");
        statusMessage.value = "安全验证加载失败";
        needsRetry.value = true;
        emit("error");
      },
      "timeout-callback": () => {
        emit("update:modelValue", "");
        statusMessage.value = "安全验证超时";
        needsRetry.value = true;
        emit("timeout");
      }
    });
  } finally {
    loading.value = false;
  }
}

watch(safeSiteKey, async () => {
  await renderWidget();
});

onMounted(async () => {
  try {
    await renderWidget();
  } catch {
    emit("update:modelValue", "");
    statusMessage.value = "安全验证加载失败";
    needsRetry.value = true;
    emit("error");
  }
});

onBeforeUnmount(() => {
  clearWidget();
});

defineExpose({
  resetWidget
});
</script>

<style scoped>
.turnstile-shell {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.turnstile-host {
  min-height: 72px;
  width: 100%;
  display: grid;
  place-items: center;
}

.turnstile-hint {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  text-align: center;
}

.turnstile-hint.is-error {
  color: #b91c1c;
}

.turnstile-retry {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #1d4ed8;
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 640px) {
  .turnstile-host {
    min-height: 78px;
  }
}
</style>
