<template>
  <button :disabled="disabled || loading" :class="['btn', { busy: loading }]" type="button">
    <span v-if="loading">{{ loadingText }}</span>
    <span v-else><slot /></span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    loading?: boolean;
    disabled?: boolean;
    loadingText?: string;
  }>(),
  {
    loading: false,
    disabled: false,
    loadingText: '提交中...'
  }
);
</script>

<style scoped>
.btn {
  width: 100%;
  min-height: 44px;
  border: 1px solid #2f64df;
  border-radius: 8px;
  background: #2f64df;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.btn.busy {
  filter: saturate(0.8);
}

@media (max-width: 640px) {
  .btn {
    min-height: 48px;
    font-size: 16px;
  }
}
</style>
