<template>
  <main class="shell">
    <h1>Subscription Manager</h1>
    <p>阶段 0 初始化完成，前后端脚手架已创建。</p>
    <p class="hint">域名入口变量：`APP_BASE_URL`（在根目录 `.env` 或容器环境中配置）。</p>
    <p class="hint">前端调试变量：`VITE_APP_BASE_URL={{ appBaseUrl }}`。</p>
  </main>
</template>

<script setup lang="ts">
const appBaseUrl = import.meta.env.VITE_APP_BASE_URL || "http://192.168.10.3:8084";
</script>

<style scoped>
.shell {
  max-width: 720px;
  margin: 64px auto;
  padding: 24px;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.6;
}

h1 {
  margin: 0 0 12px;
}

.hint {
  color: #4b5563;
}
</style>
