<template>
  <AdminLayout>
    <div class="head">
      <div>
        <h1>用户管理</h1>
        <p class="sub">用户状态、到期时间、续期和禁用管理。</p>
      </div>
      <span class="badge" v-if="usingMock">演示数据 6 条</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="filters">
      <input v-model="qUsername" placeholder="筛选用户名" />
      <input v-model="qContact" placeholder="筛选联系方式" />
      <select v-model="qStatus">
        <option value="">全部状态</option>
        <option value="inactive">inactive</option>
        <option value="active">active</option>
        <option value="grace">grace</option>
        <option value="expired">expired</option>
        <option value="disabled">disabled</option>
      </select>
      <button type="button" class="add-user-btn" @click="openAdd">增加用户</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>用户编号</th>
            <th>用户名</th>
            <th>联系方式</th>
            <th>到期日</th>
            <th>实际失效日</th>
            <th>状态</th>
            <th>订阅token</th>
            <th>备注</th>
            <th>操作区</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, idx) in filteredItems" :key="u.id">
            <td class="mono">U{{ String(idx + 1).padStart(3, '0') }}</td>
            <td class="user">{{ u.username }}</td>
            <td>{{ u.contact || '-' }}</td>
            <td>
              <div class="day-cell">
                <span>{{ fmtDay(u.expire_at) }}</span>
                <span v-if="u.expire_at" class="day-pill" :class="dayMeta(u.expire_at).klass">剩余{{ dayMeta(u.expire_at).days }}天</span>
              </div>
            </td>
            <td>
              <div class="day-cell">
                <span>{{ fmtDay(u.disable_after) }}</span>
                <span v-if="u.disable_after" class="day-pill" :class="dayMeta(u.disable_after).klass">剩余{{ dayMeta(u.disable_after).days }}天</span>
              </div>
            </td>
            <td><span class="status" :class="statusClass(u.status)">{{ statusLabel(u.status) }}</span></td>
            <td class="mono">{{ maskToken(u.sub_token) }}</td>
            <td>{{ u.note || '-' }}</td>
            <td>
              <div class="actions">
                <button type="button" @click="openView(u)">查看</button>
                <button type="button" @click="openEdit(u)">修改</button>
                <button type="button" class="danger" @click="openDelete(u)">删除</button>
                <button type="button" class="warn" @click="resetToken(u)">重置token</button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredItems.length === 0" class="empty-row">
            <td colspan="9">暂无用户数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="viewOpen" class="modal-mask">
      <div class="modal user-view-modal">
        <div class="modal-head">
          <h3>用户详情</h3>
          <button class="icon-close" type="button" @click="viewOpen = false">×</button>
        </div>
        <div class="modal-body view-grid">
          <label class="field"><span>用户名</span><div class="value">{{ selected?.username || '-' }}</div></label>
          <label class="field"><span>联系方式</span><div class="value">{{ selected?.contact || '-' }}</div></label>
          <label class="field"><span>到期时间</span><div class="value">{{ fmtDay(selected?.expire_at) }}</div></label>
          <label class="field"><span>实际失效时间</span><div class="value">{{ fmtDay(selected?.disable_after) }}</div></label>
          <label class="field token-field">
            <span>订阅 Token</span>
            <div class="value mono">{{ selected?.sub_token || '-' }}</div>
          </label>
          <label class="field token-field">
            <span>状态</span>
            <div class="status-line">
              <span class="status" :class="statusClass(selected?.status || '')">{{ selected ? statusLabel(selected.status) : '-' }}</span>
            </div>
          </label>
          <label class="field token-field">
            <span>备注</span>
            <div class="value">{{ selected?.note || '-' }}</div>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" @click="viewOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="editOpen" class="modal-mask">
      <div class="modal user-view-modal">
        <div class="modal-head">
          <h3>编辑用户</h3>
          <button class="icon-close" type="button" @click="editOpen = false">×</button>
        </div>
        <div class="modal-body view-grid">
          <label class="field"><span>用户名</span><div class="value">{{ editForm.username || '-' }}</div></label>
          <label class="field">
            <span>密码</span>
            <div class="password-row edit-input-shell" :class="{ 'is-error-wrap': !!editFieldError.password }">
              <input
                v-model="editForm.password"
                :type="showEditPassword ? 'text' : 'password'"
                placeholder="留空则不修改密码"
                :class="{ 'is-error': !!editFieldError.password }"
                @focus="clearEditFieldError('password')"
              />
              <button type="button" class="toggle-pwd" @click="showEditPassword = !showEditPassword">{{ showEditPassword ? '隐藏' : '显示' }}</button>
            </div>
            <span v-if="editFieldError.password" class="field-error-bubble">{{ editFieldError.password }}</span>
          </label>
          <label class="field"><span>联系方式</span><input class="edit-input" v-model="editForm.contact" placeholder="邮箱或手机号（可选）" /></label>
          <label class="field"><span>到期时间</span><input class="edit-input" v-model="editForm.expire_at" type="date" /></label>
          <div class="field token-field" @click.stop>
            <span>订阅 Token</span>
            <div class="token-row">
              <div class="value mono token-readonly" tabindex="-1">{{ editForm.sub_token || '-' }}</div>
              <button type="button" class="primary" @click.stop="resetTokenInEdit">重置</button>
            </div>
          </div>
          <label class="field token-field">
            <span>状态</span>
            <div class="status-line">
              <span class="status" :class="statusClass(editForm.status || '')">{{ statusLabel(editForm.status || '') }}</span>
            </div>
          </label>
          <label class="field token-field"><span>备注</span><textarea class="edit-input" v-model="editForm.note" rows="3" placeholder="可修改备注"></textarea></label>
        </div>
        <div class="modal-actions">
          <p v-if="editError" class="modal-error">{{ editError }}</p>
          <button type="button" @click="editOpen = false">取消</button>
          <button type="button" class="primary" @click="submitEdit">保存</button>
        </div>
      </div>
    </div>

    <div v-if="addOpen" class="modal-mask">
      <div class="modal">
        <div class="modal-head">
          <h3>新增用户</h3>
          <button class="icon-close" type="button" @click="addOpen = false">×</button>
        </div>
        <div class="modal-body form-single">
          <label>用户名
            <input
              v-model="addForm.username"
              placeholder="输入唯一的用户名"
              :class="{ 'is-error': !!addFieldError.username }"
              @focus="clearAddFieldError('username')"
            />
            <span v-if="addFieldError.username" class="field-error-bubble">{{ addFieldError.username }}</span>
          </label>
          <label>密码
            <div class="password-row" :class="{ 'is-error-wrap': !!addFieldError.password }">
              <input
                v-model="addForm.password"
                :type="showAddPassword ? 'text' : 'password'"
                placeholder="设置初始密码"
                :class="{ 'is-error': !!addFieldError.password }"
                @focus="clearAddFieldError('password')"
              />
              <button type="button" class="toggle-pwd" @click="showAddPassword = !showAddPassword">{{ showAddPassword ? '隐藏' : '显示' }}</button>
            </div>
            <span v-if="addFieldError.password" class="field-error-bubble">{{ addFieldError.password }}</span>
          </label>
          <label>联系方式<input v-model="addForm.contact" placeholder="邮箱或手机号（可选）" /></label>
          <label>到期时间<input v-model="addForm.expire_at" type="date" /></label>
          <label>备注<textarea v-model="addForm.note" rows="3" placeholder="选填，添加用户相关备注信息"></textarea></label>
        </div>
        <div class="modal-actions">
          <p v-if="addError" class="modal-error">{{ addError }}</p>
          <button type="button" @click="addOpen = false">取消</button>
          <button type="button" class="primary" @click="submitAdd">确认新增</button>
        </div>
      </div>
    </div>

    <div v-if="deleteOpen" class="modal-mask">
      <div class="modal confirm-modal">
        <div class="modal-content">
          <h3>删除用户</h3>
          <p class="sub">确认删除用户 {{ deleteTarget?.username || '-' }} 吗？此操作不可撤销。</p>
        </div>
        <div class="modal-actions">
          <button type="button" @click="deleteOpen = false">取消</button>
          <button type="button" class="danger" @click="confirmDelete">确认</button>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { api } from '../lib/api';
import { validatePassword, validateUsername } from '../lib/validators';

type Item = {
  id: string;
  username: string;
  contact?: string | null;
  note?: string | null;
  status: 'inactive' | 'active' | 'grace' | 'expired' | 'disabled' | string;
  expire_at: string | null;
  disable_after: string | null;
  sub_token: string;
  created_at: string;
};

const mockUsers: Item[] = [
  { id: 'mock-1', username: 'alice', contact: 'alice@example.com', note: '企业账号', status: 'active', expire_at: '2026-12-30', disable_after: '2027-01-06', sub_token: 'subtk_a1b2c3d4e5f6g7h8', created_at: '2026-05-10' },
  { id: 'mock-2', username: 'bob', contact: '138****1001', note: '促销批次', status: 'grace', expire_at: '2026-06-01', disable_after: '2026-06-05', sub_token: 'subtk_h1i2j3k4l5m6n7o8', created_at: '2026-05-08' },
  { id: 'mock-3', username: 'charlie', contact: 'charlie@example.com', note: null, status: 'inactive', expire_at: null, disable_after: null, sub_token: 'subtk_p1q2r3s4t5u6v7w8', created_at: '2026-05-15' },
  { id: 'mock-4', username: 'david', contact: '139****2208', note: '已提醒续期', status: 'expired', expire_at: '2026-05-20', disable_after: '2026-05-27', sub_token: 'subtk_x1y2z3a4b5c6d7e8', created_at: '2026-04-01' },
  { id: 'mock-6', username: 'frank', contact: '137****7788', note: '年付用户', status: 'active', expire_at: '2026-09-10', disable_after: '2026-09-17', sub_token: 'subtk_n1o2p3q4r5s6t7u8', created_at: '2026-05-26' }
];

const items = ref<Item[]>([]);
const error = ref('');
const usingMock = ref(false);
const qUsername = ref('');
const qContact = ref('');
const qStatus = ref('');

const viewOpen = ref(false);
const editOpen = ref(false);
const addOpen = ref(false);
const deleteOpen = ref(false);
const showAddPassword = ref(false);
const showEditPassword = ref(false);
const selected = ref<Item | null>(null);
const deleteTarget = ref<Item | null>(null);
const rotationDays = ref(0);
const addError = ref('');
const editError = ref('');
const addFieldError = ref<{ username?: string; password?: string }>({});
const editFieldError = ref<{ password?: string }>({});

const editForm = ref({ username: '', password: '', contact: '', status: 'inactive', expire_at: '', disable_after: '', sub_token: '', note: '' });
const addForm = ref({ username: '', password: '', contact: '', expire_at: '', note: '' });

const filteredItems = computed(() => items.value.filter((u) => {
  const okUsername = qUsername.value ? u.username.toLowerCase().includes(qUsername.value.toLowerCase()) : true;
  const okContact = qContact.value ? (u.contact || '').toLowerCase().includes(qContact.value.toLowerCase()) : true;
  const okStatus = qStatus.value ? u.status === qStatus.value : true;
  return okUsername && okContact && okStatus;
}));

function maskToken(token: string) {
  if (!token) return '-';
  if (token.length <= 10) return token;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function fmtDay(value: string | null | undefined) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayMeta(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { days: 0, klass: 'red' as const };
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.floor((startTarget - startNow) / 86400000);
  if (diff < 0) return { days: 0, klass: 'red' as const };
  if (diff <= 7) return { days: diff, klass: 'yellow' as const };
  return { days: diff, klass: 'green' as const };
}

function statusClass(status: string) {
  if (status === 'active') return 'is-active';
  if (status === 'grace') return 'is-grace';
  if (status === 'expired') return 'is-expired';
  if (status === 'inactive') return 'is-inactive';
  if (status === 'disabled') return 'is-disabled';
  return 'is-inactive';
}

function statusLabel(status: string) {
  if (status === 'inactive') return '未授权';
  if (status === 'active') return '正常';
  if (status === 'grace') return '宽限期';
  if (status === 'expired') return '已过期';
  if (status === 'disabled') return '已禁用';
  return status;
}

function openView(u: Item) {
  selected.value = { ...u };
  viewOpen.value = true;
}

function openEdit(u: Item) {
  selected.value = u;
  editForm.value = {
    username: u.username,
    password: '',
    contact: u.contact || '',
    status: u.status,
    expire_at: (u.expire_at || '').slice(0, 10),
    disable_after: (u.disable_after || '').slice(0, 10),
    sub_token: u.sub_token || '',
    note: u.note || ''
  };
  showEditPassword.value = false;
  editError.value = '';
  editFieldError.value = {};
  editOpen.value = true;
}

function submitEdit() {
  if (!selected.value) return;
  if (editForm.value.password.trim()) {
    const pErr = validatePassword(editForm.value.password.trim());
    if (pErr) {
      editFieldError.value.password = pErr;
      return;
    }
  }
  editError.value = '';
  editFieldError.value = {};
  items.value = items.value.map((u) =>
    u.id === selected.value!.id
      ? {
          ...u,
          contact: editForm.value.contact.trim() || null,
          expire_at: editForm.value.expire_at || null,
          disable_after: calcDisableAfter(editForm.value.expire_at || null, rotationDays.value),
          sub_token: editForm.value.sub_token,
          note: editForm.value.note.trim() || null
        }
      : u
  );
  editOpen.value = false;
}

function resetTokenInEdit() {
  if (!selected.value) return;
  const next = `subtk_${Math.random().toString(36).slice(2, 14)}`;
  editForm.value.sub_token = next;
  selected.value = { ...selected.value, sub_token: next };
}

function openAdd() {
  addForm.value = { username: '', password: '', contact: '', expire_at: '', note: '' };
  showAddPassword.value = false;
  addError.value = '';
  addFieldError.value = {};
  addOpen.value = true;
}

function submitAdd() {
  const uErr = validateUsername(addForm.value.username);
  if (uErr) {
    addFieldError.value.username = uErr;
    return;
  }
  const pErr = validatePassword(addForm.value.password);
  if (pErr) {
    addFieldError.value.password = pErr;
    return;
  }
  addError.value = '';
  addFieldError.value = {};
  const now = new Date().toISOString().slice(0, 10);
  const token = `subtk_${Math.random().toString(36).slice(2, 14)}`;
  const expireAt = addForm.value.expire_at || null;
  const disableAfter = calcDisableAfter(expireAt, rotationDays.value);
  items.value.unshift({
    id: `mock-new-${Date.now()}`,
    username: addForm.value.username.trim(),
    contact: addForm.value.contact.trim() || null,
    note: addForm.value.note.trim() || null,
    status: 'inactive',
    expire_at: expireAt,
    disable_after: disableAfter,
    sub_token: token,
    created_at: now
  });
  usingMock.value = true;
  addOpen.value = false;
}

function removeUser(u: Item) {
  items.value = items.value.filter((x) => x.id !== u.id);
}

function openDelete(u: Item) {
  deleteTarget.value = u;
  deleteOpen.value = true;
}

function confirmDelete() {
  if (!deleteTarget.value) return;
  removeUser(deleteTarget.value);
  deleteOpen.value = false;
  deleteTarget.value = null;
}

function resetToken(u: Item) {
  items.value = items.value.map((x) => (x.id === u.id ? { ...x, sub_token: `subtk_${Math.random().toString(36).slice(2, 14)}` } : x));
}

function calcDisableAfter(expireAt: string | null, days: number) {
  if (!expireAt) return null;
  const base = new Date(expireAt);
  if (Number.isNaN(base.getTime())) return expireAt;
  if (!days || days <= 0) return expireAt;
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function clearAddFieldError(field: 'username' | 'password') {
  addFieldError.value[field] = '';
}

function clearEditFieldError(field: 'password') {
  editFieldError.value[field] = '';
}

onMounted(async () => {
  try {
    try {
      const settings = await api<Record<string, unknown>>('/api/admin/settings');
      const v = Number(settings.rotation_grace_days ?? settings.user_disable_after_days ?? 0);
      rotationDays.value = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    } catch {
      rotationDays.value = 0;
    }
    const data = await api<{ items: Item[] }>('/api/admin/users');
    if (data.items?.length) {
      items.value = data.items;
      return;
    }
    items.value = mockUsers;
    usingMock.value = true;
  } catch (e) {
    error.value = `接口读取失败，已切换演示数据：${(e as Error).message}`;
    items.value = mockUsers;
    usingMock.value = true;
  }
});
</script>

<style scoped>
.filters { display: grid; grid-template-columns: 1fr 1fr 180px 110px; gap: 8px; margin-bottom: 12px; }
.filters input, .filters select, .filters button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }
.filters button { cursor: pointer; min-width: 96px; }
.add-user-btn { border-color: #1d4ed8 !important; background: #2563eb !important; color: #fff; font-weight: 600; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.badge { border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
.error { color: #b91c1c; margin: 0 0 10px; }
.table-wrap { overflow-x: auto; }
.table { width: 100%; min-width: 1080px; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 14px; vertical-align: middle; }
th { color: #64748b; font-weight: 600; background: #f8fafc; }
.empty-row td { text-align: center; color: #94a3b8; padding: 22px 8px; }
tbody tr { transition: background-color 0.16s ease; }
tbody tr:hover { background: #f3f7ff; }
tbody tr:has(.actions button:hover) { background: #edf4ff; }
.user { font-weight: 600; color: #0f172a; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
.status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.status.is-inactive,.status.is-disabled { background: #e5e7eb; color: #374151; }
.status.is-active { background: #ecfdf3; color: #15803d; }
.status.is-grace { background: #fef9c3; color: #a16207; }
.status.is-expired { background: #fef2f2; color: #b91c1c; }
.day-cell { display: inline-flex; align-items: center; gap: 8px; }
.day-pill { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
.day-pill.green { background: #ecfdf3; color: #15803d; }
.day-pill.yellow { background: #fffbeb; color: #a16207; }
.day-pill.red { background: #fef2f2; color: #b91c1c; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions button { border: 1px solid #cbd5e1; background: #fff; color: #1f2937; border-radius: 6px; padding: 4px 8px; font-size: 12px; line-height: 1.2; min-width: 52px; cursor: pointer; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease; }
.actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.actions .warn { border-color: #fcd34d; color: #92400e; background: #fffbeb; }
.actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }

.modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 80; }
.modal { width: 58%; max-width: 500px; min-width: 320px; background: #fff; border: 1px solid #dbe3ef; border-radius: 12px; overflow: hidden; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #f5f7ff; }
.modal-head h3 { margin: 0; }
.icon-close { border: 0; background: transparent; color: #475569; font-size: 26px; line-height: 1; cursor: pointer; }
.modal-body { padding: 14px 16px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.grid2 p { margin: 0; display: grid; gap: 4px; }
.grid2 strong { color: #475569; font-size: 12px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
.form-grid label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.form-grid input,.form-grid select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.form-single { display: grid; gap: 10px; }
.form-single label { position: relative; display: grid; gap: 6px; font-size: 13px; color: #334155; }
.form-single input,.form-single textarea { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.password-row { position: relative; }
.password-row input { width: 100%; box-sizing: border-box; padding-right: 64px; }
.toggle-pwd { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: 0; background: transparent; color: #2563eb; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; padding: 0; }
.form-single input.is-error { border-color: #ef4444 !important; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.12); }
.password-row.is-error-wrap input.is-error { border-color: #ef4444 !important; }
.field-error-bubble {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  z-index: 12;
  display: inline-block;
  width: max-content;
  max-width: min(360px, calc(100vw - 64px));
  padding: 4px 8px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.3;
  pointer-events: none;
  box-shadow: 0 2px 10px rgba(185, 28, 28, 0.08);
}
.modal-actions { border-top: 1px solid #e2e8f0; padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; background: #f8faff; }
.modal-error { margin: 0 auto 0 0; color: #b91c1c; font-size: 12px; }
.modal-actions button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.modal-actions .primary { border-color: #1d4ed8; background: #2563eb; color: #fff; }
.modal-actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.modal-actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.modal-actions .primary:hover { background: #1d4ed8; color: #fff; }
.modal-actions .danger:hover { border-color: #fca5a5; background: #fee2e2; color: #991b1b; }
.confirm-modal { width: 58%; max-width: 500px; min-width: 320px; }
.modal-content { padding: 14px 16px; }
.confirm-modal .sub { margin: 8px 0 0; color: #64748b; font-size: 16px; line-height: 1.5; }
.confirm-modal .modal-actions { margin-top: 0; padding: 0 16px 14px; border-top: 0; background: transparent; }
.user-view-modal { max-width: 500px; }
.view-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: grid; gap: 6px; }
.field > span { color: #475569; font-size: 12px; }
.value { border: 1px solid #cbd5e1; border-radius: 8px; background: #f3f5fb; padding: 10px 12px; color: #1f2937; min-height: 18px; display: flex; align-items: center; }
.edit-input-shell { position: relative; width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; min-height: 40px; box-sizing: border-box; }
.edit-input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1f2937; min-height: 40px; padding: 8px 10px; font-size: 14px; font-family: inherit; }
.token-field { grid-column: 1 / -1; }
.token-row { display: grid; grid-template-columns: 1fr auto; gap: 0; }
.token-row .value { border-right: 0; border-radius: 8px 0 0 8px; }
.token-readonly { user-select: text; pointer-events: auto; }
.token-row .primary { border-radius: 0 8px 8px 0; padding: 0 14px; min-height: 40px; border: 1px solid #1d4ed8; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
.token-row .primary:hover { background: #1d4ed8; color: #fff; }
.status-line { min-height: 40px; display: flex; align-items: center; }
.view-grid .password-row { padding: 0; }
.view-grid .password-row input { border: 0; background: transparent; width: 100%; height: 100%; padding: 10px 64px 10px 12px; font-size: 14px; box-sizing: border-box; outline: none; }
.view-grid textarea.edit-input { resize: vertical; min-height: 88px; align-items: initial; padding-top: 10px; }

@media (max-width: 1100px) {
  .filters { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .filters { grid-template-columns: 1fr; }
  .filters button { min-height: 40px; }
  .modal { width: calc(100vw - 24px); min-width: 0; }
  .grid2, .form-grid, .view-grid { grid-template-columns: 1fr; }
  .token-row { grid-template-columns: 1fr; gap: 8px; }
  .token-row .value { border-right: 1px solid #cbd5e1; border-radius: 8px; }
  .token-row .primary { border-radius: 8px; min-height: 40px; }
}
</style>
