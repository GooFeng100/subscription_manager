<template>
  <AdminLayout>
    <div class="head">
      <div>
        <h1>日志中心</h1>
        <p class="sub">登录行为、授权码使用与订阅访问日志统一查询。</p>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'auth' }" @click="switchTab('auth')">登录日志</button>
      <button type="button" :class="{ active: tab === 'code' }" @click="switchTab('code')">授权码日志</button>
      <button type="button" :class="{ active: tab === 'sub' }" @click="switchTab('sub')">订阅访问日志</button>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2>筛选条件</h2>
      </div>
      <div class="panel-body filters" v-if="tab === 'auth'">
        <input v-model="filters.auth.username" placeholder="筛选用户名" />
        <select v-model="filters.auth.success">
          <option value="">全部结果</option>
          <option value="true">成功</option>
          <option value="false">失败</option>
        </select>
        <button type="button" :disabled="loadingAuth" @click="loadAuth">{{ loadingAuth ? '查询中...' : '查询' }}</button>
      </div>
      <div class="panel-body filters" v-else-if="tab === 'code'">
        <input v-model="filters.code.username" placeholder="筛选使用用户" />
        <select v-model="filters.code.status">
          <option value="">全部状态</option>
          <option value="used">已使用</option>
          <option value="revoked">已作废</option>
        </select>
        <button type="button" :disabled="loadingCode" @click="loadCode">{{ loadingCode ? '查询中...' : '查询' }}</button>
      </div>
      <div class="panel-body filters" v-else>
        <input v-model="filters.sub.username" placeholder="筛选用户名" />
        <select v-model="filters.sub.success">
          <option value="">全部结果</option>
          <option value="true">成功</option>
          <option value="false">失败</option>
        </select>
        <button type="button" :disabled="loadingSub" @click="loadSub">{{ loadingSub ? '查询中...' : '查询' }}</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>日志列表</h2>
      </div>
      <div class="table-wrap" v-if="tab === 'auth'">
        <table class="table">
          <thead>
            <tr>
              <th>编号</th><th>用户名</th><th>动作</th><th>结果</th><th>来源IP</th><th>消息</th><th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in authRows" :key="r.id">
              <td class="mono">A{{ String(idx + 1).padStart(3, '0') }}</td>
              <td>{{ r.username }}</td>
              <td>{{ r.action }}</td>
              <td><span class="status" :class="r.success ? 'is-ok' : 'is-bad'">{{ r.success ? '成功' : '失败' }}</span></td>
              <td>{{ r.ip }}</td>
              <td>{{ r.message }}</td>
              <td>{{ fmtDayTime(r.created_at) }}</td>
            </tr>
            <tr v-if="loadingAuth" class="empty-row"><td colspan="7">加载中...</td></tr>
            <tr v-else-if="authRows.length === 0" class="empty-row"><td colspan="7">暂无登录日志</td></tr>
          </tbody>
        </table>
      </div>

      <div class="table-wrap" v-else-if="tab === 'code'">
        <table class="table">
          <thead>
            <tr>
              <th>编号</th><th>授权码</th><th>状态</th><th>使用用户</th><th>使用时间</th><th>作废时间</th><th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in codeRows" :key="r.id">
              <td class="mono">C{{ String(idx + 1).padStart(3, '0') }}</td>
              <td class="mono">{{ r.code }}</td>
              <td><span class="status" :class="r.status === 'used' ? 'is-ok' : 'is-bad'">{{ r.status === 'used' ? '已使用' : '已作废' }}</span></td>
              <td>{{ r.used_by_username || '-' }}</td>
              <td>{{ fmtDayTime(r.used_at) }}</td>
              <td>{{ fmtDayTime(r.revoked_at) }}</td>
              <td>{{ r.note || '-' }}</td>
            </tr>
            <tr v-if="loadingCode" class="empty-row"><td colspan="7">加载中...</td></tr>
            <tr v-else-if="codeRows.length === 0" class="empty-row"><td colspan="7">暂无授权码日志</td></tr>
          </tbody>
        </table>
      </div>

      <div class="table-wrap" v-else>
        <table class="table">
          <thead>
            <tr>
              <th>编号</th><th>用户名</th><th>token</th><th>目标</th><th>IP</th><th>状态码</th><th>结果</th><th>消息</th><th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in subRows" :key="r.id">
              <td class="mono">S{{ String(idx + 1).padStart(3, '0') }}</td>
              <td>{{ r.username || '-' }}</td>
              <td class="mono">{{ maskToken(r.token) }}</td>
              <td>{{ r.target }}</td>
              <td>{{ r.ip }}</td>
              <td>{{ r.status_code }}</td>
              <td><span class="status" :class="r.success ? 'is-ok' : 'is-bad'">{{ r.success ? '成功' : '失败' }}</span></td>
              <td>{{ r.message }}</td>
              <td>{{ fmtDayTime(r.created_at) }}</td>
            </tr>
            <tr v-if="loadingSub" class="empty-row"><td colspan="9">加载中...</td></tr>
            <tr v-else-if="subRows.length === 0" class="empty-row"><td colspan="9">暂无订阅访问日志</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { api } from '../lib/api';

type AuthRow = { id: string; username: string; action: string; success: boolean; message: string; ip: string; created_at: string };
type CodeRow = { id: string; code: string; status: 'used' | 'revoked' | string; used_by_username: string | null; used_at: string | null; revoked_at: string | null; note: string | null };
type SubRow = { id: string; username: string | null; token: string; target: string; ip: string; status_code: number; success: boolean; message: string; created_at: string };

const mockAuthRows: AuthRow[] = [
  { id: 'a1', username: 'admin', action: 'admin_login', success: true, message: 'login success', ip: '192.168.10.21', created_at: '2026-06-02T09:10:00+08:00' },
  { id: 'a2', username: 'alice001', action: 'user_login', success: false, message: 'password mismatch', ip: '192.168.10.36', created_at: '2026-06-02T09:16:00+08:00' },
  { id: 'a3', username: 'bob_user', action: 'user_login', success: true, message: 'login success', ip: '192.168.10.51', created_at: '2026-06-02T09:22:00+08:00' }
];

const mockCodeRows: CodeRow[] = [
  { id: 'c1', code: 'H1PT9Q', status: 'used', used_by_username: 'alice001', used_at: '2026-06-01T18:20:00+08:00', revoked_at: null, note: '新用户首充' },
  { id: 'c2', code: '92SAZZ', status: 'revoked', used_by_username: null, used_at: null, revoked_at: '2026-06-01T20:05:00+08:00', note: '误发作废' },
  { id: 'c3', code: 'EPY226', status: 'used', used_by_username: 'bob_user', used_at: '2026-06-02T08:11:00+08:00', revoked_at: null, note: null }
];

const mockSubRows: SubRow[] = [
  { id: 's1', username: 'alice001', token: 'subtk_a1b2c3d4e5f6g7h8', target: 'clash', ip: '192.168.10.36', status_code: 200, success: true, message: 'ok', created_at: '2026-06-02T08:32:00+08:00' },
  { id: 's2', username: 'bob_user', token: 'subtk_z9y8x7w6v5u4t3s2', target: 'mihomo', ip: '192.168.10.51', status_code: 429, success: false, message: 'rate limited', created_at: '2026-06-02T08:33:00+08:00' },
  { id: 's3', username: null, token: 'subtk_xxxxxyyyyyzzzz', target: 'sing-box', ip: '192.168.10.88', status_code: 401, success: false, message: 'invalid token', created_at: '2026-06-02T08:39:00+08:00' }
];

const tab = ref<'auth' | 'code' | 'sub'>('auth');
const error = ref('');

const filters = reactive({
  auth: { username: '', success: '' },
  code: { username: '', status: '' },
  sub: { username: '', success: '' }
});

const authRows = ref<AuthRow[]>([]);
const codeRows = ref<CodeRow[]>([]);
const subRows = ref<SubRow[]>([]);
const loadingAuth = ref(false);
const loadingCode = ref(false);
const loadingSub = ref(false);

function fmtDayTime(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function maskToken(token: string) {
  if (!token) return '-';
  if (token.length <= 10) return token;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function buildQuery(obj: Record<string, string>) {
  const q = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (String(v || '').trim()) q.set(k, String(v).trim()); });
  return q.toString();
}

async function loadAuth() {
  loadingAuth.value = true;
  try {
    const query = buildQuery({ ...filters.auth, limit: '100' });
    const res = await api<{ items: AuthRow[] }>(`/api/admin/logs/auth${query ? `?${query}` : ''}`);
    authRows.value = (res.items && res.items.length > 0) ? res.items : mockAuthRows;
    error.value = '';
  } catch (e) {
    error.value = `读取登录日志失败，已切换演示数据：${(e as Error).message}`;
    authRows.value = mockAuthRows;
  } finally {
    loadingAuth.value = false;
  }
}

async function loadCode() {
  loadingCode.value = true;
  try {
    const query = buildQuery({ ...filters.code, limit: '100' });
    const res = await api<{ items: CodeRow[] }>(`/api/admin/logs/code-usage${query ? `?${query}` : ''}`);
    codeRows.value = (res.items && res.items.length > 0) ? res.items : mockCodeRows;
    error.value = '';
  } catch (e) {
    error.value = `读取授权码日志失败，已切换演示数据：${(e as Error).message}`;
    codeRows.value = mockCodeRows;
  } finally {
    loadingCode.value = false;
  }
}

async function loadSub() {
  loadingSub.value = true;
  try {
    const query = buildQuery({ ...filters.sub, limit: '100' });
    const res = await api<{ items: SubRow[] }>(`/api/admin/logs/sub-access${query ? `?${query}` : ''}`);
    subRows.value = (res.items && res.items.length > 0) ? res.items : mockSubRows;
    error.value = '';
  } catch (e) {
    error.value = `读取订阅访问日志失败，已切换演示数据：${(e as Error).message}`;
    subRows.value = mockSubRows;
  } finally {
    loadingSub.value = false;
  }
}

async function switchTab(next: 'auth' | 'code' | 'sub') {
  tab.value = next;
  if (next === 'auth' && authRows.value.length === 0) await loadAuth();
  if (next === 'code' && codeRows.value.length === 0) await loadCode();
  if (next === 'sub' && subRows.value.length === 0) await loadSub();
}

onMounted(async () => {
  await loadAuth();
});
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.error { color: #b91c1c; margin: 0 0 10px; }

.tabs { display: inline-flex; gap: 8px; margin-bottom: 12px; }
.tabs button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 999px; padding: 7px 14px; cursor: pointer; font-size: 13px; }
.tabs button.active { border-color: #1d4ed8; background: #2563eb; color: #fff; }

.panel { border: 1px solid #dbe3ef; background: #fff; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.panel-head { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
.panel-head h2 { margin: 0; font-size: 16px; color: #0f172a; }
.panel-body { padding: 12px 14px; }

.filters { display: grid; grid-template-columns: 1fr 180px 90px; gap: 8px; }
.filters input,.filters select,.filters button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }
.filters button { cursor: pointer; min-width: 88px; color: #1f2937; font-weight: 600; white-space: nowrap; }
.filters button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.filters button:disabled { cursor: not-allowed; opacity: 0.65; box-shadow: none; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; min-width: 1080px; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 14px; vertical-align: middle; }
th { color: #64748b; font-weight: 600; background: #f8fafc; }
tbody tr:hover { background: #f3f7ff; }
.empty-row td { text-align: center; color: #94a3b8; padding: 22px 8px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
.status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.status.is-ok { background: #ecfdf3; color: #15803d; }
.status.is-bad { background: #fef2f2; color: #b91c1c; }

@media (max-width: 980px) {
  .filters { grid-template-columns: 1fr 1fr; }
  .filters button { grid-column: 1 / -1; min-height: 40px; }
}
</style>
