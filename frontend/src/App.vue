<template>
  <main class="layout">
    <RouterView />
  </main>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<style scoped>
.layout {
  min-height: 100vh;
  margin: 0 auto;
  padding: 12px;
  background: #e5e7eb;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

:deep(.card) {
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
}

:deep(.form) {
  display: grid;
  gap: 8px;
}

:deep(input) {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}

:deep(button) {
  border: 1px solid #111827;
  background: #111827;
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
}

:deep(button.ghost) {
  background: #fff;
  color: #111827;
}

:deep(.msg) {
  color: #475569;
}

@media (max-width: 640px) {
  .layout {
    padding: 10px;
    font-size: 16px;
  }

  :deep(input),
  :deep(select),
  :deep(textarea),
  :deep(button) {
    font-size: 16px !important;
  }
}
</style>
