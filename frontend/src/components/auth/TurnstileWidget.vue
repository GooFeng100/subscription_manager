<template>
  <div class="turnstile-shell">
    <div ref="container" class="turnstile-host"></div>
    <p v-if="!siteKey" class="turnstile-hint">Turnstile 暂未配置</p>
    <p v-else-if="loading" class="turnstile-hint">验证组件加载中...</p>
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
}>();

const container = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const widgetId = ref<string | number | null>(null);
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
        emit("update:modelValue", token);
      },
      "expired-callback": () => {
        emit("update:modelValue", "");
      },
      "error-callback": () => {
        emit("update:modelValue", "");
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

@media (max-width: 640px) {
  .turnstile-host {
    min-height: 78px;
  }
}
</style>
