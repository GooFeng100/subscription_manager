<template>
  <div class="auth-shell">
    <section class="auth-card">
      <img class="logo-mark" :src="markIcon" alt="system mark" />
      <div class="auth-brand">
        <h1>{{ title }}</h1>
      </div>
      <hr class="divider" />
      <slot />
    </section>
  </div>
</template>

<script setup lang="ts">
import markIcon from '../../assets/icons/mark.png';

defineProps<{
  title: string;
  description?: string;
}>();
</script>

<style scoped>
.auth-shell {
  min-height: calc(100vh - 24px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  margin: 0 auto;
  padding: 18px 10px;
}

.auth-card {
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid #d0d5dd;
  border-radius: 10px;
  width: 100%;
  max-width: 420px;
  padding: 16px 14px 14px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.logo-mark {
  width: 104px;
  height: 104px;
  margin: 0 auto 8px;
  display: block;
  object-fit: contain;
}

.auth-brand {
  text-align: center;
}

h1 {
  margin: 0;
  color: #0452d2;
  font-size: clamp(18px, 3.1vw, 30px);
  line-height: 1.2;
}

.divider {
  border: 0;
  border-top: 1px solid #d5dbe6;
  margin: 18px 0 14px;
}

@media (min-width: 768px) {
  .auth-shell {
    padding-top: 26px;
  }
}

@media (max-width: 640px) {
  .auth-shell {
    padding: 12px 10px;
  }

  .auth-card {
    padding: 16px 12px 14px;
    border-radius: 12px;
  }

  .logo-mark {
    width: 84px;
    height: 84px;
    margin-bottom: 8px;
  }

  h1 {
    font-size: clamp(20px, 6vw, 28px);
  }

  .divider {
    margin: 16px 0 12px;
  }
}
</style>
