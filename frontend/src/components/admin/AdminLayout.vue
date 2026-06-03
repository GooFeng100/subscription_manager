<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="brand">
        <img :src="markIcon" alt="mark" />
        <div>
          <h2>订阅分发系统</h2>
          <p>管理后台</p>
        </div>
      </div>

      <nav class="menu">
        <RouterLink to="/admin/users">👥 用户管理</RouterLink>
        <RouterLink to="/admin/codes">🗝️ 订阅代码</RouterLink>
        <RouterLink to="/admin/upstreams">🛰️ 上游配置</RouterLink>
        <RouterLink to="/admin/rotation">🔁 轮询设置</RouterLink>
        <RouterLink to="/admin/settings">⚙️ 系统设置</RouterLink>
        <RouterLink to="/admin/logs">🕘 系统日志</RouterLink>
      </nav>

      <div class="footer">
        <div class="userline">
          <span class="avatar">{{ userInitial }}</span>
          <span>{{ username || '未登录' }}</span>
        </div>
        <button type="button" @click="logout">退出登录</button>
      </div>
    </aside>

    <main class="content">
      <section class="body">
        <slot />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../../lib/api';
import markIcon from '../../assets/icons/mark.png';

const router = useRouter();
const username = ref('');

const userInitial = computed(() => (username.value ? username.value[0].toUpperCase() : 'A'));

onMounted(async () => {
  try {
    const me = await api<{ username?: string }>('/api/auth/me');
    username.value = me.username || '';
  } catch {
    username.value = '';
  }
});

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    await router.push('/login');
  }
}
</script>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: calc(100vh - 24px);
  gap: 14px;
}

.sidebar {
  background: #fff;
  border-radius: 14px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 24px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 12px;
}

.brand img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.brand h2 {
  margin: 0;
  color: #0452d2;
  font-size: 24px;
  line-height: 1.1;
}

.brand p {
  margin: 2px 0 0;
  color: #334155;
  font-size: 13px;
}

.menu {
  display: grid;
  gap: 6px;
}

.menu a {
  text-decoration: none;
  color: #1e293b;
  border-radius: 10px;
  padding: 10px 12px;
  font-weight: 500;
  border: 0;
}

.menu a.router-link-active {
  color: #0b4dd6;
  background: #eef4ff;
  box-shadow: 0 0 0 1px #c7d7ff inset, 0 6px 18px rgba(37, 99, 235, 0.22);
}

.footer {
  margin-top: auto;
  padding: 14px 8px 4px;
  display: grid;
  gap: 10px;
}

.userline {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #0f172a;
  font-weight: 600;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #2563eb;
  color: #fff;
  font-size: 13px;
}

.footer button {
  border: 1px solid #2c63de;
  background: #2c63de;
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 600;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.08s ease,
    filter 0.16s ease;
}

.footer button:hover {
  border-color: #1f4fb8;
  background: #1f4fb8;
  box-shadow: 0 0 0 2px rgba(44, 99, 222, 0.14);
  filter: brightness(1.02);
}

.footer button:active {
  transform: translateY(1px) scale(0.98);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.footer button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(44, 99, 222, 0.22);
}

.content {
  display: grid;
}

.body {
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 10px;
  padding: 14px;
  overflow-x: auto;
}

@media (max-width: 1024px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    min-height: auto;
  }

  .menu {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
