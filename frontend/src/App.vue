<template>
  <main class="layout">
    <header v-if="!isAuthPage && !isAdminPage" class="top">
      <h1>Subscription Manager</h1>
      <nav>
        <RouterLink to="/dashboard">我的订阅</RouterLink>
        <RouterLink to="/redeem">兑换</RouterLink>
        <RouterLink to="/password">改密</RouterLink>
        <RouterLink to="/help">说明</RouterLink>
        <RouterLink to="/rotation">轮换</RouterLink>
      </nav>
    </header>
    <RouterView />
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

const route = useRoute();
const isAuthPage = computed(() => route.path === '/login' || route.path === '/register');
const isAdminPage = computed(() => route.path.startsWith('/admin'));
</script>

<style scoped>
.layout {
  min-height: 100vh;
  margin: 0 auto;
  padding: 12px;
  background: #e5e7eb;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.top {
  display: grid;
  gap: 10px;
  max-width: 980px;
  margin: 0 auto 12px;
}

.top h1 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

a {
  text-decoration: none;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 6px 12px;
  background: #ffffff;
}

a.router-link-active {
  background: #0f172a;
  color: #fff;
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
  }
}
</style>
