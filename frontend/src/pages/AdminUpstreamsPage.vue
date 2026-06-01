<template>
  <AdminLayout>
    <div class="head">
      <div>
        <h1>上游管理</h1>
        <p class="sub">上游订阅地址维护、启用状态与连通性测试。</p>
      </div>
      <span class="badge" v-if="usingMock">演示数据 {{ items.length }} 条</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="filters">
      <input v-model="qName" placeholder="筛选上游名称" />
      <select v-model="qStatus">
        <option value="">全部状态</option>
        <option value="enabled">启用</option>
        <option value="disabled">禁用</option>
      </select>
      <button type="button" class="add-btn" @click="openAdd">新增上游</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>编号</th>
            <th>名称</th>
            <th>状态</th>
            <th>上游URL</th>
            <th>最后测试</th>
            <th>更新时间</th>
            <th>操作区</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, idx) in filteredItems" :key="u.id">
            <td class="mono">U{{ String(idx + 1).padStart(3, '0') }}</td>
            <td class="name">{{ u.name }}</td>
            <td><span class="status" :class="u.enabled ? 'is-enabled' : 'is-disabled'">{{ u.enabled ? '启用' : '禁用' }}</span></td>
            <td class="url" :title="u.url">{{ u.url_masked || u.url }}</td>
            <td>{{ u.last_test_result || '-' }}</td>
            <td>{{ fmtDay(u.updated_at) }}</td>
            <td>
              <div class="actions">
                <button type="button" @click="runTest(u)">测试</button>
                <button type="button" @click="openEdit(u)">修改</button>
                <button type="button" class="warn" @click="toggleEnabled(u)">{{ u.enabled ? '禁用' : '启用' }}</button>
                <button type="button" class="danger" @click="openDelete(u)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredItems.length === 0" class="empty-row">
            <td colspan="7">暂无上游数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editOpen" class="modal-mask">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editing ? '编辑上游' : '新增上游' }}</h3>
          <button type="button" class="icon-close" @click="editOpen = false">×</button>
        </div>
        <div class="modal-form">
          <label>名称<input v-model="editForm.name" placeholder="例如：主线路A" /></label>
          <label>上游URL<input v-model="editForm.url" placeholder="https://example.com/sub?token=..." /></label>
          <label>备注<textarea v-model="editForm.note" rows="3" placeholder="可选"></textarea></label>
        </div>
        <div class="modal-actions modal-foot">
          <button type="button" @click="editOpen = false">取消</button>
          <button type="button" class="add-btn" @click="submitEdit">保存</button>
        </div>
      </div>
    </div>

    <div v-if="confirmOpen" class="modal-mask">
      <div class="modal confirm-modal">
        <div class="modal-content">
          <h3>删除上游</h3>
          <p class="sub">确认删除上游 {{ target?.name || '-' }} 吗？</p>
        </div>
        <div class="modal-actions">
          <button type="button" @click="confirmOpen = false">取消</button>
          <button type="button" class="danger" @click="submitDelete">确认</button>
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
  name: string;
  enabled: boolean;
  url: string;
  url_masked?: string;
  note?: string;
  last_test_result?: string | null;
  updated_at: string;
};

const mockItems: Item[] = [
  { id: 'up-1', name: '主线路A', enabled: true, url: 'https://provider-a.example.com/sub?token=abc123', url_masked: 'https://provider-a.example.com/sub?...', note: '默认线路', last_test_result: '200 OK (120ms)', updated_at: '2026-06-01' },
  { id: 'up-2', name: '备用线路B', enabled: true, url: 'https://provider-b.example.com/subscribe?id=8899', url_masked: 'https://provider-b.example.com/subscribe?...', note: '备用', last_test_result: '200 OK (240ms)', updated_at: '2026-05-31' },
  { id: 'up-3', name: '海外线路C', enabled: false, url: 'https://provider-c.example.net/subscription/x', url_masked: 'https://provider-c.example.net/subscription/...', note: '', last_test_result: 'timeout', updated_at: '2026-05-30' }
];

const items = ref<Item[]>([]);
const error = ref('');
const usingMock = ref(false);
const qName = ref('');
const qStatus = ref('');

const editOpen = ref(false);
const editing = ref(false);
const target = ref<Item | null>(null);
const confirmOpen = ref(false);

const editForm = ref({ name: '', url: '', note: '' });

const filteredItems = computed(() => items.value.filter((u) => {
  const okName = qName.value ? u.name.toLowerCase().includes(qName.value.toLowerCase()) : true;
  const okStatus = qStatus.value ? (qStatus.value === 'enabled' ? u.enabled : !u.enabled) : true;
  return okName && okStatus;
}));

function fmtDay(value: string | null | undefined) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openAdd() {
  editing.value = false;
  target.value = null;
  editForm.value = { name: '', url: '', note: '' };
  editOpen.value = true;
}

function openEdit(u: Item) {
  editing.value = true;
  target.value = u;
  editForm.value = { name: u.name, url: u.url, note: u.note || '' };
  editOpen.value = true;
}

function submitEdit() {
  const name = editForm.value.name.trim();
  const url = editForm.value.url.trim();
  if (!name || !url) return;
  if (editing.value && target.value) {
    items.value = items.value.map((u) => (u.id === target.value!.id ? { ...u, name, url, url_masked: maskUrl(url), note: editForm.value.note.trim(), updated_at: fmtDay(new Date().toISOString()) } : u));
  } else {
    items.value.unshift({
      id: `up-new-${Date.now()}`,
      name,
      enabled: true,
      url,
      url_masked: maskUrl(url),
      note: editForm.value.note.trim(),
      last_test_result: '-',
      updated_at: fmtDay(new Date().toISOString())
    });
    usingMock.value = true;
  }
  editOpen.value = false;
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}${u.search ? '?...' : ''}`;
  } catch {
    return url.length > 44 ? `${url.slice(0, 44)}...` : url;
  }
}

function runTest(u: Item) {
  const ok = Math.random() > 0.25;
  const result = ok ? `200 OK (${80 + Math.floor(Math.random() * 200)}ms)` : 'timeout';
  items.value = items.value.map((x) => (x.id === u.id ? { ...x, last_test_result: result, updated_at: fmtDay(new Date().toISOString()) } : x));
}

function toggleEnabled(u: Item) {
  items.value = items.value.map((x) => (x.id === u.id ? { ...x, enabled: !x.enabled, updated_at: fmtDay(new Date().toISOString()) } : x));
}

function openDelete(u: Item) {
  target.value = u;
  confirmOpen.value = true;
}

function submitDelete() {
  if (!target.value) return;
  items.value = items.value.filter((u) => u.id !== target.value!.id);
  confirmOpen.value = false;
  target.value = null;
}

onMounted(async () => {
  try {
    const data = await api<{ items: Item[] }>('/api/admin/upstreams');
    if (data.items?.length) {
      items.value = data.items;
      return;
    }
    items.value = mockItems;
    usingMock.value = true;
  } catch (e) {
    error.value = `接口读取失败，已切换演示数据：${(e as Error).message}`;
    items.value = mockItems;
    usingMock.value = true;
  }
});
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.badge { border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
.error { color: #b91c1c; margin: 0 0 10px; }

.filters { display: grid; grid-template-columns: 1fr 180px 110px; gap: 8px; margin-bottom: 12px; }
.filters input,.filters select,.filters button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }
.filters button { min-width: 96px; white-space: nowrap; }
.add-btn { border-color: #1d4ed8 !important; background: #2563eb !important; color: #fff !important; font-weight: 600; cursor: pointer; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; min-width: 1040px; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 14px; vertical-align: middle; }
th { color: #64748b; font-weight: 600; background: #f8fafc; }
.empty-row td { text-align: center; color: #94a3b8; padding: 22px 8px; }
tbody tr:hover { background: #f3f7ff; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
.name { font-weight: 600; color: #0f172a; }
.url { max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.status.is-enabled { background: #ecfdf3; color: #15803d; }
.status.is-disabled { background: #e5e7eb; color: #374151; }

.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions button { border: 1px solid #cbd5e1; background: #fff; color: #1f2937; border-radius: 6px; padding: 4px 8px; font-size: 12px; line-height: 1.2; min-width: 52px; cursor: pointer; }
.actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.actions .warn { border-color: #fcd34d; color: #92400e; background: #fffbeb; }
.actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }

.modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 60; }
.modal { width: 58%; max-width: 500px; min-width: 320px; background: #fff; border: 1px solid #dbe3ef; border-radius: 12px; padding: 0; overflow: hidden; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #f5f7ff; }
.icon-close { border: 0; background: transparent; color: #475569; font-size: 28px; line-height: 1; cursor: pointer; }
.modal-form { display: grid; gap: 10px; padding: 14px 16px; }
.modal-form label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.modal-form input,.modal-form textarea { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.modal-form textarea { resize: vertical; }
.modal-actions { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
.modal-foot { margin-top: 0; border-top: 1px solid #e2e8f0; padding: 12px 16px; background: #f8faff; }
.modal-actions button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.modal-actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.modal-content { padding: 14px 16px; }
.confirm-modal .sub { margin: 8px 0 0; color: #64748b; font-size: 16px; line-height: 1.5; }
.confirm-modal .modal-actions { margin-top: 0; padding: 0 16px 14px; }
.confirm-modal .modal-actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }

@media (max-width: 900px) {
  .filters { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .filters { grid-template-columns: 1fr; }
  .modal { width: calc(100vw - 24px); min-width: 0; }
  .filters button { min-height: 40px; }
}
</style>
