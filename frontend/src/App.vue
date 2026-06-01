<template>
  <main class="layout">
    <header class="top">
      <h1>Subscription Manager</h1>
      <nav>
        <RouterLink to="/register">注册</RouterLink>
        <RouterLink to="/login">登录</RouterLink>
        <RouterLink to="/dashboard">我的订阅</RouterLink>
        <RouterLink to="/redeem">兑换</RouterLink>
        <RouterLink to="/password">改密</RouterLink>
        <RouterLink to="/help">说明</RouterLink>
      </nav>
    </header>
    <RouterView />
  </main>
</template>

<style scoped>
.layout {
  max-width: 860px;
  margin: 0 auto;
  padding: 12px;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.top {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
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
  padding: 4px 10px;
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
