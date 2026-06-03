<template>
  <AdminLayout>
    <div class="head">
      <div>
        <h1>授权码管理</h1>
        <p class="sub">授权码生成、使用状态与作废删除管理。</p>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="filters">
      <input v-model="qCode" placeholder="筛选授权码" />
      <input v-model="qUser" placeholder="筛选使用用户" />
      <button type="button" class="add-btn" @click="openCreate">生成授权码</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>授权码</th>
            <th>授权天数</th>
            <th>创建日期</th>
            <th>使用日期</th>
            <th>使用用户</th>
            <th>状态</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filteredItems" :key="c.id">
            <td>
              <button class="copy-code" type="button" @click="copyCode(c.code)">{{ c.code }}</button>
            </td>
            <td>{{ c.days }}</td>
            <td>{{ fmtDay(c.created_at) }}</td>
            <td>{{ fmtDay(c.used_at) }}</td>
            <td>{{ c.used_by_username || '-' }}</td>
            <td><span class="status" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span></td>
            <td>{{ c.note || '-' }}</td>
            <td>
              <div class="actions">
                <button type="button" class="warn" :disabled="c.status === 'used' || c.status === 'revoked'" @click="openRevoke(c)">作废</button>
                <button type="button" class="danger" :disabled="c.status === 'used'" @click="openDelete(c)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredItems.length === 0" class="empty-row">
            <td colspan="8">暂无授权码数据</td>
          </tr>
        </tbody>
      </table>
      <p class="copy-msg">{{ copyMsg }}</p>
    </div>

    <div v-if="createOpen" class="modal-mask">
      <div class="modal create-modal">
        <div class="modal-head">
          <h3>生成授权码</h3>
          <button type="button" class="icon-close" @click="createOpen = false">×</button>
        </div>
        <div class="modal-form">
          <label>生成数量<input v-model.number="createCount" type="number" min="1" max="100" placeholder="请输入生成数量，例如 10" /></label>
          <label>授权天数</label>
          <div class="day-quick">
            <button type="button" :class="{ active: createDays === 30 }" @click="setDays(30)">30天</button>
            <button type="button" :class="{ active: createDays === 90 }" @click="setDays(90)">90天</button>
            <button type="button" :class="{ active: createDays === 180 }" @click="setDays(180)">180天</button>
            <button type="button" :class="{ active: createDays === 365 }" @click="setDays(365)">365天</button>
            <button type="button" :class="{ active: customDays }" @click="customDays = true">自定义</button>
          </div>
          <input v-if="customDays" v-model.number="createDays" type="number" min="1" max="3650" placeholder="请输入自定义天数" />
          <label>备注<textarea v-model="createNote" rows="3" placeholder="可选，用于记录本次生成用途"></textarea></label>
        </div>
        <div class="modal-actions modal-foot">
          <button type="button" @click="createOpen = false">取消</button>
          <button type="button" class="add-btn" @click="submitCreate">确认生成</button>
        </div>
      </div>
    </div>

    <div v-if="successOpen" class="modal-mask">
      <div class="modal success-modal">
        <div class="modal-content">
          <h3>生成成功</h3>
          <p class="sub">共生成 {{ createdCodes.length }} 个授权码</p>
          <textarea readonly :value="createdCodes.join('\n')" rows="8"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" @click="successOpen = false">关闭</button>
          <button type="button" class="add-btn" @click="copyAllCreated">复制全部</button>
        </div>
      </div>
    </div>

    <div v-if="confirmOpen" class="modal-mask">
      <div class="modal confirm-modal">
        <div class="modal-content">
          <h3>{{ confirmMode === 'delete' ? '删除授权码' : '作废授权码' }}</h3>
          <p class="sub">确认对授权码 {{ selectedCode?.code }} 执行该操作？</p>
        </div>
        <div class="modal-actions">
          <button type="button" @click="confirmOpen = false">取消</button>
          <button type="button" :class="confirmMode === 'delete' ? 'danger' : 'warn'" @click="submitConfirm">确认</button>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { api } from '../lib/api';

type Item = {
  id: string;
  code: string;
  days: number;
  status: 'unused' | 'used' | 'revoked' | string;
  used_by_username: string | null;
  used_at: string | null;
  created_at: string;
  note?: string | null;
};
type ApiCodeItem = {
  id: string;
  code: string;
  duration_days: number;
  status: 'unused' | 'used' | 'revoked' | string;
  used_by_username: string | null;
  used_at: string | null;
  created_at: string;
  note?: string | null;
};
type CreateCodeResponse = {
  items: Array<{
    code: string;
    duration_days: number;
    grace_days: number;
    status: string;
  }>;
};

const items = ref<Item[]>([]);
const error = ref('');
const copyMsg = ref('');
const qCode = ref('');
const qUser = ref('');

const createOpen = ref(false);
const createCount = ref(5);
const createDays = ref(30);
const customDays = ref(false);
const createNote = ref('');
const successOpen = ref(false);
const createdCodes = ref<string[]>([]);

const confirmOpen = ref(false);
const confirmMode = ref<'revoke' | 'delete'>('revoke');
const selectedCode = ref<Item | null>(null);

function normalizeCodeItem(i: ApiCodeItem): Item {
  return {
    id: i.id,
    code: i.code,
    days: i.duration_days,
    status: i.status,
    used_by_username: i.used_by_username,
    used_at: i.used_at,
    created_at: i.created_at,
    note: i.note ?? null
  };
}

const filteredItems = computed(() => items.value.filter((c) => {
  const okCode = qCode.value ? c.code.toLowerCase().includes(qCode.value.toLowerCase()) : true;
  const okUser = qUser.value ? (c.used_by_username || '').toLowerCase().includes(qUser.value.toLowerCase()) : true;
  return okCode && okUser;
}));

function fmtDay(value: string | null | undefined) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function statusClass(status: string) {
  if (status === 'unused') return 'is-unused';
  if (status === 'used') return 'is-used';
  if (status === 'revoked') return 'is-revoked';
  return 'is-used';
}

function statusLabel(status: string) {
  if (status === 'unused') return '未使用';
  if (status === 'used') return '已使用';
  if (status === 'revoked') return '已作废';
  return status;
}

async function copyCode(code: string) {
  const copied = await copyText(code);
  copyMsg.value = copied ? `已复制：${code}` : '复制失败，请手动复制';
}

function openCreate() {
  customDays.value = false;
  createOpen.value = true;
}

function setDays(days: number) {
  createDays.value = days;
  customDays.value = false;
}

async function submitCreate() {
  const count = Math.max(1, Math.min(100, Number(createCount.value) || 1));
  const days = Math.max(1, Math.min(3650, Number(createDays.value) || 30));
  const note = createNote.value.trim();

  try {
    const created = await api<CreateCodeResponse>('/api/admin/codes', {
      method: 'POST',
      body: JSON.stringify({ count, durationDays: days, graceDays: 3, note })
    });
    const latest = await api<{ items: ApiCodeItem[] }>('/api/admin/codes');
    items.value = (latest.items || []).map(normalizeCodeItem);
    createdCodes.value = (created.items || []).map((i) => i.code);
  } catch (e) {
    error.value = `生成失败：${(e as Error).message}`;
    return;
  }

  createOpen.value = false;
  createNote.value = '';
  successOpen.value = true;
}

async function copyAllCreated() {
  const copied = await copyText(createdCodes.value.join('\n'));
  copyMsg.value = copied ? '已复制全部授权码' : '复制失败，请手动复制';
  if (copied) successOpen.value = false;
}

async function copyText(text: string) {
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea method for HTTP/NAS browser contexts.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

function openRevoke(c: Item) {
  if (c.status === 'used' || c.status === 'revoked') return;
  selectedCode.value = c;
  confirmMode.value = 'revoke';
  confirmOpen.value = true;
}

function openDelete(c: Item) {
  if (c.status === 'used') return;
  selectedCode.value = c;
  confirmMode.value = 'delete';
  confirmOpen.value = true;
}

async function submitConfirm() {
  const target = selectedCode.value;
  if (!target) return;
  if (target.status === 'used' || (confirmMode.value === 'revoke' && target.status === 'revoked')) {
    confirmOpen.value = false;
    return;
  }

  try {
    if (confirmMode.value === 'revoke') {
      await api(`/api/admin/codes/${target.id}/revoke`, { method: 'POST' });
    } else {
      await api(`/api/admin/codes/${target.id}`, { method: 'DELETE' });
    }
    const latest = await api<{ items: ApiCodeItem[] }>('/api/admin/codes');
    items.value = (latest.items || []).map(normalizeCodeItem);
  } catch (e) {
    error.value = `操作失败：${(e as Error).message}`;
  }

  confirmOpen.value = false;
  selectedCode.value = null;
}

onMounted(async () => {
  try {
    const data = await api<{ items: ApiCodeItem[] }>('/api/admin/codes');
    items.value = (data.items || []).map(normalizeCodeItem);
  } catch (e) {
    error.value = `接口读取失败：${(e as Error).message}`;
    items.value = [];
  }
});
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.error { color: #b91c1c; margin: 0 0 10px; }
.badge { border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }

.filters { display: grid; grid-template-columns: 1fr 1fr 120px; gap: 8px; margin-bottom: 12px; }
.filters input, .filters button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }
.filters button { min-width: 96px; white-space: nowrap; }
.add-btn { border-color: #1d4ed8 !important; background: #2563eb !important; color: #fff; font-weight: 600; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; min-width: 1080px; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 14px; vertical-align: middle; }
th { color: #64748b; font-weight: 600; background: #f8fafc; }
.empty-row td { text-align: center; color: #94a3b8; padding: 22px 8px; }

tbody tr { transition: background-color 0.16s ease; }
tbody tr:hover { background: #f3f7ff; }
tbody tr:has(.actions button:hover),
tbody tr:has(.copy-code:hover) { background: #edf4ff; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }

.copy-code { border: 1px dashed #93c5fd; background: #eff6ff; color: #1d4ed8; border-radius: 8px; padding: 4px 8px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; cursor: pointer; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.08s ease; }
.copy-code:hover { border-style: solid; border-color: #2563eb; background: #dbeafe; color: #1e40af; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14); }
.copy-code:active { transform: translateY(1px) scale(0.98); background: #bfdbfe; }
.copy-msg { margin: 8px 0 0; color: #0f766e; font-size: 12px; }

.status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.status.is-unused { background: #ecfdf3; color: #15803d; }
.status.is-used { background: #e5e7eb; color: #374151; }
.status.is-revoked { background: #fef2f2; color: #b91c1c; }

.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions button { border: 1px solid #cbd5e1; background: #fff; color: #1f2937; border-radius: 6px; padding: 4px 10px; font-size: 12px; line-height: 1.2; min-width: 56px; cursor: pointer; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease; }
.actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.actions .warn { border-color: #fcd34d; color: #92400e; background: #fffbeb; }
.actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.actions button:disabled { border-color: #e5e7eb; background: #f3f4f6; color: #9ca3af; cursor: not-allowed; box-shadow: none; }
.actions button:disabled:hover { border-color: #e5e7eb; background: #f3f4f6; color: #9ca3af; box-shadow: none; }

.modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 60; }
.modal { width: 58%; max-width: 500px; min-width: 320px; background: #fff; border: 1px solid #dbe3ef; border-radius: 12px; padding: 0; overflow: hidden; }
.modal h3 { margin: 0; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #f5f7ff; }
.icon-close { border: 0 !important; background: transparent !important; color: #475569 !important; font-size: 28px; font-weight: 400; line-height: 1; cursor: pointer; padding: 0 4px !important; min-width: auto !important; min-height: auto !important; }
.modal-form { display: grid; gap: 10px; padding: 14px 16px; }
.modal-form label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.modal-form input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.modal-form textarea { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; resize: vertical; }
.day-quick { display: flex; flex-wrap: wrap; gap: 8px; }
.day-quick button { border: 1px solid #d4d9e4; background: #f8fafc; color: #334155; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
.day-quick button.active { border-color: #2563eb; background: #2563eb; color: #fff; }
 .day-quick button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
.modal textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
.modal-actions { box-sizing: border-box; margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 14px; }
.modal-foot { margin-top: 0; border-top: 1px solid #e2e8f0; padding: 12px 16px; background: #f8faff; }
.modal-actions button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; padding: 8px 12px; cursor: pointer; min-width: 88px; max-width: 140px; white-space: nowrap; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.08s ease; }
.modal-actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.modal-actions button:active { transform: translateY(1px) scale(0.98); }
.modal-actions .add-btn { border-color: #1d4ed8 !important; background: #2563eb !important; color: #fff !important; }
.modal-actions .add-btn:hover { background: #1d4ed8 !important; color: #fff !important; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); }
.modal-actions .warn { border-color: #fcd34d; color: #92400e; background: #fffbeb; }
.modal-actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.modal-content { padding: 14px 16px; }
.success-modal .sub,
.confirm-modal .sub {
  margin: 8px 0 0;
  line-height: 1.45;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.confirm-modal .modal-actions {
  box-sizing: border-box;
  padding: 0 16px 14px;
}
.confirm-modal .modal-actions button {
  min-width: 64px;
}

@media (max-width: 1100px) {
  .filters { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .filters { grid-template-columns: 1fr; }
  .filters button { min-height: 40px; }
  .modal { width: calc(100vw - 24px); }
  .modal-actions { flex-wrap: wrap; }
  .modal-actions button { flex: 1 1 auto; min-width: 96px; }
}
</style>
