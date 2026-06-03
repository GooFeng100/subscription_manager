<template>
  <section class="user-shell">
    <header class="user-head">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </header>
    <div class="user-body">
      <slot />
    </div>
    <nav class="user-nav">
      <RouterLink to="/dashboard">订阅</RouterLink>
      <RouterLink to="/redeem">兑换</RouterLink>
      <RouterLink to="/password">改密</RouterLink>
      <RouterLink to="/help">帮助</RouterLink>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";

defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<style scoped>
.user-shell {
  max-width: 640px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #d8deea;
  border-radius: 16px;
  overflow: hidden;
  min-height: calc(100vh - 24px);
}

.user-head {
  padding: 18px 18px 12px;
  border-bottom: 1px solid #e6ebf5;
  background: #f8faff;
}

.user-head h1 {
  margin: 0;
  font-size: 22px;
  color: #0f3e98;
}

.user-head p {
  margin: 6px 0 0;
  color: #5f6f8a;
  font-size: 13px;
}

.user-body {
  padding: 14px 16px;
}

.user-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid #e6ebf5;
  background: #fbfcff;
}

.user-nav a {
  text-align: center;
  text-decoration: none;
  color: #4a5e82;
  padding: 10px 8px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.16s ease;
}

.user-nav a.router-link-active {
  color: #1357d8;
  background: #eef4ff;
}
.user-nav a:hover {
  background: #f1f5ff;
  color: #1f4fb8;
}
.user-nav a:active {
  transform: translateY(1px);
  background: #e6eeff;
}

@media (max-width: 640px) {
  .user-shell {
    max-width: none;
    width: 100%;
    min-height: 100dvh;
    margin: 0;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    display: flex;
    flex-direction: column;
  }

  .user-body {
    flex: 1 1 auto;
    padding-bottom: 76px;
    box-sizing: border-box;
  }

  .user-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    padding-bottom: env(safe-area-inset-bottom);
    background: #fbfcff;
  }

  .user-head {
    padding: 20px 20px 14px;
  }

  .user-head h1 {
    font-size: 24px;
    line-height: 1.15;
  }

  .user-head p {
    font-size: 14px;
  }

  .user-body {
    padding: 16px 18px 84px;
  }

  .user-nav a {
    font-size: 15px;
    padding: 12px 8px;
  }
}
</style>
