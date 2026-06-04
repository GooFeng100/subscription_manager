<template>
  <AdminLayout>
    <section class="admin-logs-page">
      <div class="logs-card">
        <header class="logs-toolbar">
          <div class="head">
            <div>
              <h1>日志中心</h1>
              <p class="sub">登录行为、授权码使用与订阅访问日志统一查询。</p>
            </div>
          </div>

          <p v-if="error" class="error">
            {{ error }}
            <button type="button" class="retry-btn" :disabled="currentLoading" @click="reloadCurrent">重新加载</button>
          </p>

          <div class="tabs">
            <button type="button" :class="{ active: tab === 'auth' }" @click="switchTab('auth')">登录日志</button>
            <button type="button" :class="{ active: tab === 'code' }" @click="switchTab('code')">授权码日志</button>
            <button type="button" :class="{ active: tab === 'sub' }" @click="switchTab('sub')">订阅访问日志</button>
          </div>

          <div class="filters" v-if="tab === 'auth'">
            <input id="log-auth-username" name="logAuthUsername" v-model="filters.auth.username" placeholder="筛选用户名" @keyup.enter="submitFilters" />
            <select id="log-auth-success" name="logAuthSuccess" v-model="filters.auth.success">
              <option value="">全部结果</option>
              <option value="true">成功</option>
              <option value="false">失败</option>
            </select>
            <button id="log-auth-submit" name="logAuthSubmit" type="button" :disabled="loadingAuth" @click="submitFilters">{{ loadingAuth ? '查询中...' : '查询' }}</button>
          </div>
          <div class="filters" v-else-if="tab === 'code'">
            <input id="log-code-username" name="logCodeUsername" v-model="filters.code.username" placeholder="筛选使用用户" @keyup.enter="submitFilters" />
            <select id="log-code-status" name="logCodeStatus" v-model="filters.code.status">
              <option value="">全部状态</option>
              <option value="used">已使用</option>
              <option value="revoked">已作废</option>
            </select>
            <button id="log-code-submit" name="logCodeSubmit" type="button" :disabled="loadingCode" @click="submitFilters">{{ loadingCode ? '查询中...' : '查询' }}</button>
          </div>
          <div class="filters" v-else>
            <input id="log-sub-username" name="logSubUsername" v-model="filters.sub.username" placeholder="筛选用户名" @keyup.enter="submitFilters" />
            <select id="log-sub-success" name="logSubSuccess" v-model="filters.sub.success">
              <option value="">全部结果</option>
              <option value="true">成功</option>
              <option value="false">失败</option>
            </select>
            <button id="log-sub-submit" name="logSubSubmit" type="button" :disabled="loadingSub" @click="submitFilters">{{ loadingSub ? '查询中...' : '查询' }}</button>
          </div>
        </header>

        <div class="logs-table-wrap" v-if="tab === 'auth'">
          <table class="table logs-table">
            <thead>
              <tr>
                <th>时间</th><th>用户名</th><th>动作</th><th>结果</th><th>来源IP</th><th>消息</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in authRows" :key="r.id">
                <td>{{ fmtDayTime(r.created_at) }}</td>
                <td>{{ r.username }}</td>
                <td>{{ authActionLabel(r.action) }}</td>
                <td><span class="status" :class="r.success ? 'is-ok' : 'is-bad'">{{ r.success ? '成功' : '失败' }}</span></td>
                <td>{{ r.ip }}</td>
                <td>{{ logMessageLabel(r.message) }}</td>
              </tr>
              <tr v-if="loadingAuth" class="empty-row"><td colspan="6">加载中...</td></tr>
              <tr v-else-if="authRows.length === 0" class="empty-row"><td colspan="6">暂无日志</td></tr>
            </tbody>
          </table>
        </div>

        <div class="logs-table-wrap" v-else-if="tab === 'code'">
          <table class="table logs-table">
            <thead>
              <tr>
                <th>时间</th><th>授权码</th><th>模式</th><th>原到期日</th><th>新到期日</th><th>状态</th><th>使用用户</th><th>备注</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in codeRows" :key="r.id">
                <td>{{ fmtDayTime(codeEventTime(r)) }}</td>
                <td class="mono">{{ r.code }}</td>
                <td>{{ codeModeLabel(r) }}</td>
                <td>{{ fmtDay(r.oldExpireAt) }}</td>
                <td>{{ fmtDay(r.newExpireAt) }}</td>
                <td><span class="status" :class="r.status === 'used' ? 'is-ok' : 'is-bad'">{{ codeStatusLabel(r) }}</span></td>
                <td>{{ r.used_by_username || '-' }}</td>
                <td>{{ r.note || '-' }}</td>
              </tr>
              <tr v-if="loadingCode" class="empty-row"><td colspan="8">加载中...</td></tr>
              <tr v-else-if="codeRows.length === 0" class="empty-row"><td colspan="8">暂无日志</td></tr>
            </tbody>
          </table>
        </div>

        <div class="logs-table-wrap" v-else>
          <table class="table logs-table">
            <thead>
              <tr>
                <th>时间</th><th>用户名</th><th>token</th><th>目标</th><th>IP</th><th>状态码</th><th>结果</th><th>消息</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in subRows" :key="r.id">
                <td>{{ fmtDayTime(r.created_at) }}</td>
                <td>{{ r.username || '-' }}</td>
                <td class="mono">{{ maskToken(r.token) }}</td>
                <td>{{ r.target }}</td>
                <td>{{ r.ip }}</td>
                <td>{{ r.status_code }}</td>
                <td><span class="status" :class="r.success ? 'is-ok' : 'is-bad'">{{ r.success ? '成功' : '失败' }}</span></td>
                <td>{{ logMessageLabel(r.message) }}</td>
              </tr>
              <tr v-if="loadingSub" class="empty-row"><td colspan="8">加载中...</td></tr>
              <tr v-else-if="subRows.length === 0" class="empty-row"><td colspan="8">暂无日志</td></tr>
            </tbody>
          </table>
        </div>

        <footer class="logs-pagination">
          <span>{{ rangeText }}</span>
          <div class="pager">
            <button type="button" :disabled="currentLoading || currentPage <= 1" @click="goPage(currentPage - 1)">上一页</button>
            <strong>{{ currentPage }} / {{ totalPages }}</strong>
            <button type="button" :disabled="currentLoading || currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页</button>
          </div>
        </footer>
      </div>
    </section>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { api, fmtDateOnly } from '../lib/api';

type Tab = 'auth' | 'code' | 'sub';
type AuthRow = { id: string; username: string; action: string; success: boolean; message: string; ip: string; created_at: string };
type CodeRow = { id: string; code: string; mode?: 'add_days' | 'fixed_expire_date' | string; duration_days?: number; fixedExpireDate?: string | null; oldExpireAt?: string | null; newExpireAt?: string | null; revokeReason?: string | null; status: 'used' | 'revoked' | string; used_by_username: string | null; used_at: string | null; revoked_at: string | null; note: string | null };
type SubRow = { id: string; username: string | null; token: string; target: string; ip: string; status_code: number; success: boolean; message: string; created_at: string };
type PaginatedResponse<T> = { items: T[]; total?: number; page?: number; pageSize?: number };

const PAGE_SIZE = 10;
const tab = ref<Tab>('auth');
const error = ref('');

const filters = reactive({
  auth: { username: '', success: '' },
  code: { username: '', status: '' },
  sub: { username: '', success: '' }
});

const pages = reactive<Record<Tab, { page: number; total: number }>>({
  auth: { page: 1, total: 0 },
  code: { page: 1, total: 0 },
  sub: { page: 1, total: 0 }
});

const authRows = ref<AuthRow[]>([]);
const codeRows = ref<CodeRow[]>([]);
const subRows = ref<SubRow[]>([]);
const loadingAuth = ref(false);
const loadingCode = ref(false);
const loadingSub = ref(false);

const currentPage = computed(() => pages[tab.value].page);
const currentTotal = computed(() => pages[tab.value].total);
const currentLoading = computed(() => {
  if (tab.value === 'auth') return loadingAuth.value;
  if (tab.value === 'code') return loadingCode.value;
  return loadingSub.value;
});
const totalPages = computed(() => Math.max(1, Math.ceil(currentTotal.value / PAGE_SIZE)));
const rangeText = computed(() => {
  const total = currentTotal.value;
  if (total <= 0) return '第 0-0 条 / 共 0 条';
  const start = (currentPage.value - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage.value * PAGE_SIZE, total);
  return `第 ${start}-${end} 条 / 共 ${total} 条`;
});

function fmtDayTime(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDay(v: string | null | undefined) {
  return fmtDateOnly(v);
}

function maskToken(token: string) {
  if (!token) return '-';
  if (token.length <= 10) return token;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function codeEventTime(row: CodeRow) {
  return row.used_at || row.revoked_at;
}

function codeModeLabel(row: CodeRow) {
  if (row.mode === 'fixed_expire_date') return `固定到期 ${row.fixedExpireDate || '-'}`;
  return `增加 ${row.duration_days || 0} 天`;
}

function codeStatusLabel(row: CodeRow) {
  if (row.status === 'used') return '已使用';
  if (row.status === 'revoked' && row.revokeReason === 'expired_fixed_date') return '自动作废';
  if (row.status === 'revoked') return '已作废';
  return row.status || '-';
}

function authActionLabel(action: string) {
  const labels: Record<string, string> = {
    admin_login: '管理员登录',
    user_login: '用户登录',
    register: '用户注册',
    logout: '退出登录',
    user_change_password: '用户修改密码',
    admin_change_password: '管理员修改密码'
  };
  return labels[action] || action;
}

function logMessageLabel(message: string) {
  const labels: Record<string, string> = {
    ok: '成功',
    registered: '注册成功',
    redeemed: '兑换成功',
    renewed: '续期成功',
    'password updated': '密码已更新',
    'old password incorrect': '原密码错误',
    'invalid credentials or disabled': '用户名或密码错误，或账号已禁用',
    'login locked by rate limit': '登录失败次数过多，请稍后再试',
    'register ip limit exceeded': '注册过于频繁，请稍后再试',
    'username already exists': '用户名已存在',
    'Turnstile token required': '请完成 Turnstile 验证',
    'Turnstile secret key not configured': 'Turnstile 密钥未配置',
    'Turnstile verification failed': 'Turnstile 验证失败',
    'Turnstile request error': 'Turnstile 验证请求失败'
  };
  return labels[message] || message || '-';
}

function buildQuery(obj: Record<string, string | number>) {
  const q = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (String(v || '').trim()) q.set(k, String(v).trim()); });
  return q.toString();
}

function applyPageMeta(target: Tab, data: PaginatedResponse<unknown>) {
  pages[target].total = Number(data.total || 0);
  pages[target].page = Number(data.page || pages[target].page || 1);
}

async function loadAuth() {
  loadingAuth.value = true;
  try {
    const query = buildQuery({ ...filters.auth, page: pages.auth.page, pageSize: PAGE_SIZE });
    const res = await api<PaginatedResponse<AuthRow>>(`/api/admin/logs/auth?${query}`);
    authRows.value = res.items || [];
    applyPageMeta('auth', res);
    error.value = '';
  } catch (e) {
    error.value = `日志加载失败，请重试：${(e as Error).message}`;
    authRows.value = [];
    pages.auth.total = 0;
  } finally {
    loadingAuth.value = false;
  }
}

async function loadCode() {
  loadingCode.value = true;
  try {
    const query = buildQuery({ ...filters.code, page: pages.code.page, pageSize: PAGE_SIZE });
    const res = await api<PaginatedResponse<CodeRow>>(`/api/admin/logs/code-usage?${query}`);
    codeRows.value = res.items || [];
    applyPageMeta('code', res);
    error.value = '';
  } catch (e) {
    error.value = `日志加载失败，请重试：${(e as Error).message}`;
    codeRows.value = [];
    pages.code.total = 0;
  } finally {
    loadingCode.value = false;
  }
}

async function loadSub() {
  loadingSub.value = true;
  try {
    const query = buildQuery({ ...filters.sub, page: pages.sub.page, pageSize: PAGE_SIZE });
    const res = await api<PaginatedResponse<SubRow>>(`/api/admin/logs/sub-access?${query}`);
    subRows.value = res.items || [];
    applyPageMeta('sub', res);
    error.value = '';
  } catch (e) {
    error.value = `日志加载失败，请重试：${(e as Error).message}`;
    subRows.value = [];
    pages.sub.total = 0;
  } finally {
    loadingSub.value = false;
  }
}

async function loadCurrent() {
  if (tab.value === 'auth') return loadAuth();
  if (tab.value === 'code') return loadCode();
  return loadSub();
}

async function submitFilters() {
  pages[tab.value].page = 1;
  await loadCurrent();
}

async function reloadCurrent() {
  await loadCurrent();
}

async function goPage(nextPage: number) {
  const bounded = Math.min(Math.max(1, nextPage), totalPages.value);
  if (bounded === currentPage.value || currentLoading.value) return;
  pages[tab.value].page = bounded;
  await loadCurrent();
}

async function switchTab(next: Tab) {
  if (tab.value === next) return;
  tab.value = next;
  pages[next].page = 1;
  await loadCurrent();
}

onMounted(async () => {
  await loadAuth();
});
</script>

<style scoped>
.admin-logs-page {
  height: calc(100vh - 52px);
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.logs-card {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #dbe3ef;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 12px;
}

.logs-toolbar {
  flex: 0 0 auto;
  padding: 14px 14px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.error { color: #b91c1c; margin: 0 0 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.retry-btn { border-color: #fecaca !important; background: #fff !important; color: #b91c1c !important; }

.tabs { display: inline-flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.tabs button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 999px; padding: 7px 14px; cursor: pointer; font-size: 13px; }
.tabs button.active { border-color: #1d4ed8; background: #2563eb; color: #fff; }

.filters { display: grid; grid-template-columns: 1fr 180px 90px; gap: 8px; }
.filters input,.filters select,.filters button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }
.filters button { cursor: pointer; min-width: 88px; color: #1f2937; font-weight: 600; white-space: nowrap; }
.filters button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.filters button:disabled { cursor: not-allowed; opacity: 0.65; box-shadow: none; }

.logs-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.table { width: 100%; min-width: 1080px; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 14px; vertical-align: middle; }
th {
  position: sticky;
  top: 0;
  z-index: 2;
  color: #64748b;
  font-weight: 600;
  background: rgba(248, 250, 252, 0.98);
  backdrop-filter: blur(10px);
}
tbody tr:hover { background: #f3f7ff; }
.empty-row td { text-align: center; color: #94a3b8; padding: 28px 8px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
.status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.status.is-ok { background: #ecfdf3; color: #15803d; }
.status.is-bad { background: #fef2f2; color: #b91c1c; }

.logs-pagination {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid #e2e8f0;
  background: rgba(248, 250, 252, 0.96);
  color: #475569;
  font-size: 13px;
}

.pager { display: inline-flex; align-items: center; gap: 10px; }
.pager strong { color: #0f172a; min-width: 64px; text-align: center; }
.pager button { border: 1px solid #cbd5e1; background: #fff; color: #1f2937; border-radius: 8px; padding: 7px 12px; cursor: pointer; font-weight: 600; }
.pager button:disabled { cursor: not-allowed; opacity: 0.55; }

@media (max-width: 1024px) {
  .admin-logs-page { height: calc(100vh - 44px); }
}

@media (max-width: 640px) {
  .admin-logs-page { height: calc(100vh - 32px); }
  .filters { grid-template-columns: 1fr 1fr; }
  .filters button { grid-column: 1 / -1; min-height: 40px; }
  .logs-pagination { align-items: stretch; flex-direction: column; }
  .pager { justify-content: space-between; }
}
</style>
