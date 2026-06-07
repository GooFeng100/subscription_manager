<template>
  <AdminLayout>
    <div class="head">
      <div>
        <h1>上游管理</h1>
        <p class="sub">上游订阅地址维护、启用状态与连通性测试。</p>
      </div>
    </div>

    <p v-if="notice" class="notice" :class="noticeKind">{{ notice }}</p>

    <div class="filters">
      <input id="upstreams-filter-name" name="upstreamsFilterName" v-model="qName" placeholder="筛选上游名称" />
      <select id="upstreams-filter-status" name="upstreamsFilterStatus" v-model="qStatus">
        <option value="">全部状态</option>
        <option value="enabled">启用</option>
        <option value="disabled">禁用</option>
      </select>
      <button type="button" class="test-btn" :disabled="batching" @click="runAllTests">{{ batching ? '测试中...' : '全部测试' }}</button>
      <button type="button" class="add-btn" @click="openAdd">新增上游</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>状态</th>
            <th>上游URL</th>
            <th>链接类型</th>
            <th>代理回退</th>
            <th>最后测试</th>
            <th>更新时间</th>
            <th>操作区</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filteredItems" :key="u.id">
            <td class="name">{{ u.name }}</td>
            <td><span class="status" :class="u.enabled ? 'is-enabled' : 'is-disabled'">{{ u.enabled ? '启用' : '禁用' }}</span></td>
            <td class="url" :title="u.url">{{ u.url_masked || u.url }}</td>
            <td>{{ sourceTypeLabel(u.source_type) }}</td>
            <td>
              <button
                type="button"
                class="toggle-switch inline"
                :class="u.fetch_via_proxy ? 'is-on' : 'is-off'"
                :disabled="batching || !!proxyToggleBusy[u.id]"
                role="switch"
                :aria-checked="u.fetch_via_proxy"
                @click="toggleFetchViaProxy(u)"
              >
                <span class="toggle-track" aria-hidden="true">
                  <span class="toggle-thumb"></span>
                </span>
                <span class="toggle-text">{{ proxyToggleBusy[u.id] ? '保存中' : (u.fetch_via_proxy ? '开启' : '关闭') }}</span>
              </button>
            </td>
            <td>
              <span
                v-if="u.test_state === 'testing'"
                class="test-pill is-testing"
              >
                测试中
              </span>
              <span
                v-else-if="u.test_state === 'pass' || u.test_state === 'fail'"
                class="test-pill"
                :class="u.last_test_ok ? 'is-pass' : 'is-fail'"
                :title="u.last_test_message || ''"
              >
                HTTP {{ u.last_test_status ?? 0 }}
              </span>
              <span
                v-if="u.test_state === 'testing' || u.test_state === 'pass' || u.test_state === 'fail'"
                class="proxy-run-pill"
                :class="(((u.test_state === 'testing' ? u.current_test_via_proxy : u.last_test_via_proxy) ?? false) ? 'is-proxy' : 'is-direct')"
              >
                {{ ((u.test_state === 'testing' ? u.current_test_via_proxy : u.last_test_via_proxy) ?? false) ? '代理' : '直连' }}
              </span>
              <span v-if="u.test_state === 'idle' && u.last_test_ok === null && u.last_test_status === null" class="test-pill is-unknown">-</span>
            </td>
            <td>{{ fmtDay(u.updated_at) }}</td>
            <td>
              <div class="actions">
                <button type="button" @click="openEdit(u)">修改</button>
                <button type="button" class="warn" @click="toggleEnabled(u)">{{ u.enabled ? '禁用' : '启用' }}</button>
                <button type="button" class="danger" @click="openDelete(u)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredItems.length === 0" class="empty-row">
            <td colspan="8">暂无上游数据</td>
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
          <label>名称<input id="upstream-edit-name" name="upstreamEditName" v-model="editForm.name" placeholder="例如：主线路A" /></label>
          <label>链接类型
            <select id="upstream-edit-source-type" name="upstreamEditSourceType" v-model="editForm.sourceType">
              <option v-for="option in sourceTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <div class="field switch-field">
            <span>代理回退</span>
            <button
              type="button"
              class="toggle-switch"
              :class="editForm.fetchViaProxy ? 'is-on' : 'is-off'"
              role="switch"
              :aria-checked="editForm.fetchViaProxy"
              @click="editForm.fetchViaProxy = !editForm.fetchViaProxy"
            >
              <span class="toggle-track" aria-hidden="true">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-text">{{ editForm.fetchViaProxy ? '开启' : '关闭' }}</span>
            </button>
            <small>直连连续失败后再走代理拉取。</small>
          </div>
          <label>上游URL<input id="upstream-edit-url" name="upstreamEditUrl" v-model="editForm.url" placeholder="https://example.com/sub?token=..." /></label>
          <label>备注<textarea id="upstream-edit-note" name="upstreamEditNote" v-model="editForm.note" rows="3" placeholder="可选"></textarea></label>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { API_BASE, api, redirectOnUnauthorizedStatus } from '../lib/api';

const UPSTREAMS_POLL_INTERVAL_MS = 5000;

type Item = {
  id: string;
  name: string;
  enabled: boolean;
  source_type: string;
  fetch_via_proxy?: boolean;
  url: string;
  url_masked?: string;
  note?: string;
  last_test_ok?: boolean | null;
  last_test_status?: number | null;
  last_test_type?: string | null;
  last_test_node_count?: number | null;
  last_test_message?: string | null;
  last_test_via_proxy?: boolean | null;
  current_test_via_proxy?: boolean | null;
  test_state?: 'idle' | 'testing' | 'pass' | 'fail';
  updated_at: string;
};

const items = ref<Item[]>([]);
const notice = ref('');
const noticeKind = ref<'info' | 'success' | 'error'>('info');
const qName = ref('');
const qStatus = ref('');
const batching = ref(false);
const proxyToggleBusy = ref<Record<string, boolean>>({});
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let finalRefreshPending = false;

const editOpen = ref(false);
const editing = ref(false);
const target = ref<Item | null>(null);
const confirmOpen = ref(false);

const editForm = ref({ name: '', url: '', note: '', sourceType: 'auto', fetchViaProxy: false });

const sourceTypeOptions = [
  { value: 'auto', label: '自动识别' },
  { value: 'ss', label: 'SS' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'vmess', label: 'Vmess' },
  { value: 'vless', label: 'Vless' },
  { value: 'hysteria2', label: 'Hysteria2' },
  { value: 'tuic', label: 'Tuic' },
  { value: 'base64', label: 'Base64' },
  { value: 'clash_yaml', label: 'Clash YAML' }
];

function sourceTypeLabel(value: string) {
  return sourceTypeOptions.find((option) => option.value === value)?.label || value || '自动识别';
}

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
  editForm.value = { name: '', url: '', note: '', sourceType: 'auto', fetchViaProxy: false };
  editOpen.value = true;
}

function openEdit(u: Item) {
  editing.value = true;
  target.value = u;
  editForm.value = { name: u.name, url: u.url, note: u.note || '', sourceType: u.source_type || 'auto', fetchViaProxy: !!u.fetch_via_proxy };
  editOpen.value = true;
}

async function toggleFetchViaProxy(u: Item) {
  if (proxyToggleBusy.value[u.id]) return;
  const next = !u.fetch_via_proxy;
  proxyToggleBusy.value[u.id] = true;
  try {
    const res = await api<{ item?: Partial<Item> }>(`/api/admin/upstreams/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ fetchViaProxy: next })
    });
    u.fetch_via_proxy = res.item?.fetch_via_proxy ?? next;
    if (res.item?.updated_at) u.updated_at = String(res.item.updated_at);
    notice.value = `${u.name} 代理回退已${u.fetch_via_proxy ? '开启' : '关闭'}`;
    noticeKind.value = 'success';
  } catch (e) {
    notice.value = `代理回退更新失败：${(e as Error).message}`;
    noticeKind.value = 'error';
  } finally {
    proxyToggleBusy.value[u.id] = false;
  }
}

async function submitEdit() {
  const name = editForm.value.name.trim();
  const url = editForm.value.url.trim();
  if (!name || !url) return;
  try {
    if (editing.value && target.value) {
      await api(`/api/admin/upstreams/${target.value.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          provider: editForm.value.note.trim() || 'custom',
          sourceType: editForm.value.sourceType,
          sourceUrl: url,
          fetchViaProxy: editForm.value.fetchViaProxy
        })
      });
    } else {
      await api('/api/admin/upstreams', {
        method: 'POST',
        body: JSON.stringify({
          name,
          provider: editForm.value.note.trim() || 'custom',
          sourceType: editForm.value.sourceType,
          sourceUrl: url,
          fetchViaProxy: editForm.value.fetchViaProxy
        })
      });
    }
    await loadUpstreams();
    editOpen.value = false;
  } catch (e) {
    notice.value = `保存失败：${(e as Error).message}`;
    noticeKind.value = 'error';
  }
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}${u.search ? '?...' : ''}`;
  } catch {
    return url.length > 44 ? `${url.slice(0, 44)}...` : url;
  }
}

async function toggleEnabled(u: Item) {
  try {
    await api(`/api/admin/upstreams/${u.id}/${u.enabled ? 'disable' : 'enable'}`, { method: 'POST' });
    await loadUpstreams();
  } catch (e) {
    notice.value = `状态更新失败：${(e as Error).message}`;
    noticeKind.value = 'error';
  }
}

function openDelete(u: Item) {
  target.value = u;
  confirmOpen.value = true;
}

async function submitDelete() {
  if (!target.value) return;
  try {
    await api(`/api/admin/upstreams/${target.value.id}`, { method: 'DELETE' });
    await loadUpstreams();
    confirmOpen.value = false;
    target.value = null;
  } catch (e) {
    notice.value = `删除失败：${(e as Error).message}`;
    noticeKind.value = 'error';
  }
}

async function runAllTests() {
  if (batching.value) return;
  batching.value = true;
  finalRefreshPending = true;
  ensureRefreshTimer();
  notice.value = '测试中...';
  noticeKind.value = 'info';
  items.value = items.value.map((item) => ({
    ...item,
    test_state: item.enabled ? 'testing' : (item.last_test_ok === null || item.last_test_ok === undefined ? 'idle' : (item.last_test_ok ? 'pass' : 'fail'))
  }));

  try {
    const resp = await fetch(`${API_BASE}/api/admin/upstreams/test-all`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (redirectOnUnauthorizedStatus(resp.status)) {
      return;
    }
    if (!resp.ok || !resp.body) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleLine = (line: string) => {
      const payload = JSON.parse(line) as
        | {
            kind: 'result';
            id: string;
            ok: boolean;
            status: number | null;
            error: string | null;
            type: string | null;
            nodeCount: number | null;
            message: string | null;
            last_test_ok: boolean;
            last_test_status: number | null;
            last_test_error: string | null;
            last_test_type: string | null;
            last_test_node_count: number | null;
            last_test_message: string | null;
            last_test_via_proxy: boolean;
          }
        | {
            kind: 'phase';
            id: string;
            name: string;
            provider: string;
            source_type: string;
            phase: 'direct' | 'proxy';
            source_url_masked: string;
          }
        | {
            kind: 'summary';
            total: number;
            success: number;
            failed: number;
            nodeCount: number;
          };

      if (payload.kind === 'result') {
        const targetItem = items.value.find((item) => item.id === payload.id);
        if (targetItem) {
          targetItem.last_test_ok = payload.last_test_ok;
          targetItem.last_test_status = payload.last_test_status;
          targetItem.last_test_type = payload.last_test_type;
          targetItem.last_test_node_count = payload.last_test_node_count;
          targetItem.last_test_message = payload.last_test_message;
          targetItem.last_test_via_proxy = payload.last_test_via_proxy;
          targetItem.current_test_via_proxy = null;
          targetItem.test_state = payload.ok ? 'pass' : 'fail';
        }
        return;
      }

      if (payload.kind === 'phase') {
        const targetItem = items.value.find((item) => item.id === payload.id);
        if (targetItem) {
          targetItem.test_state = 'testing';
          targetItem.current_test_via_proxy = payload.phase === 'proxy';
        }
        return;
      }

      notice.value = payload.nodeCount === 0
        ? `测试完成：共 ${payload.total} 条订阅，${payload.success} 条成功，共 0 个节点，节点池为空但已 ready`
        : `测试完成：共 ${payload.total} 条订阅，${payload.success} 条成功，共 ${payload.nodeCount} 个节点，节点池已 ready`;
      noticeKind.value = payload.failed > 0 ? 'error' : 'success';
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) handleLine(line);
        newlineIndex = buffer.indexOf('\n');
      }
    }

    const tail = buffer.trim();
    if (tail) handleLine(tail);
  } catch (e) {
    notice.value = `测试失败：${(e as Error).message}`;
    noticeKind.value = 'error';
  } finally {
    batching.value = false;
    items.value = items.value.map((item) => ({
      ...item,
      test_state: item.enabled ? (item.last_test_ok === null || item.last_test_ok === undefined ? 'idle' : (item.last_test_ok ? 'pass' : 'fail')) : 'idle',
      current_test_via_proxy: null
    }));
    stopRefreshTimer();
    finalRefreshPending = false;
    await loadUpstreams();
  }
}

async function loadUpstreams() {
  const wasBatching = batching.value;
  try {
    const data = await api<{
      items: any[];
      batch_test_running?: boolean;
      batch_test_ready?: boolean;
      batch_test_message?: string;
      batch_test_total?: number;
      batch_test_success?: number;
      batch_test_failed?: number;
      batch_test_node_count?: number;
    }>('/api/admin/upstreams');
    batching.value = !!data.batch_test_running;
    if (batching.value) {
      ensureRefreshTimer();
      finalRefreshPending = true;
    } else {
      stopRefreshTimer();
    }
    if (data.batch_test_running) {
      notice.value = '测试中...';
      noticeKind.value = 'info';
    } else if (data.batch_test_ready && data.batch_test_message) {
      const nodeCount = Number(data.batch_test_node_count || 0);
      const success = Number(data.batch_test_success || 0);
      const total = Number(data.batch_test_total || 0);
      notice.value = nodeCount === 0
        ? `节点池为空，但已 ready（${success}/${total} 成功）`
        : `节点池已 ready（${success}/${total} 成功，共 ${nodeCount} 个节点）`;
      noticeKind.value = 'success';
    } else {
      notice.value = '';
    }
    items.value = (data.items || []).map((i) => ({
      id: i.id,
      name: i.name,
      enabled: !!i.enabled,
      source_type: i.source_type || 'auto',
      url: i.source_url || '',
      url_masked: i.source_url_masked || '',
      note: i.provider || '',
      fetch_via_proxy: !!i.fetch_via_proxy,
      last_test_ok: i.last_test_ok ?? null,
      last_test_status: i.last_test_status ?? null,
      last_test_type: i.last_test_type || null,
      last_test_node_count: i.last_test_node_count ?? null,
      last_test_message: i.last_test_message || null,
      last_test_via_proxy: i.last_test_via_proxy ?? null,
      current_test_via_proxy: null,
      test_state: i.last_test_ok === null || i.last_test_ok === undefined ? 'idle' : (i.last_test_ok ? 'pass' : 'fail'),
      updated_at: i.updated_at || ''
    }));
  } catch (e) {
    notice.value = `接口读取失败：${(e as Error).message}`;
    noticeKind.value = 'error';
    items.value = [];
    if (!batching.value) stopRefreshTimer();
  } finally {
    if (wasBatching && !batching.value && finalRefreshPending) {
      finalRefreshPending = false;
      await loadUpstreams();
    }
  }
}

function ensureRefreshTimer() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    void loadUpstreams();
  }, UPSTREAMS_POLL_INTERVAL_MS);
}

function stopRefreshTimer() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

onMounted(async () => {
  await loadUpstreams();
});

onBeforeUnmount(() => {
  stopRefreshTimer();
});
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.badge { border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
.notice { margin: 0 0 10px; font-size: 14px; }
.notice.info { color: #1d4ed8; }
.notice.success { color: #15803d; }
.notice.error { color: #b91c1c; }
.filters { display: grid; grid-template-columns: 1fr 180px 110px 110px; gap: 8px; margin-bottom: 12px; }
.filters input,.filters select,.filters button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }
.filters button { min-width: 96px; white-space: nowrap; }
.filters .test-btn { border-color: #f59e0b !important; background: #fbbf24 !important; color: #7c2d12 !important; font-weight: 600; cursor: pointer; }
.filters .test-btn:disabled { opacity: 0.7; cursor: wait; }
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
.test-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 84px;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  border: 1px solid transparent;
}
.test-pill.is-pass { background: #ecfdf3; color: #15803d; border-color: #bbf7d0; }
.test-pill.is-fail { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.test-pill.is-testing { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
.test-pill.is-unknown { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
.proxy-run-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  margin-left: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #93c5fd;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.08);
}
.proxy-run-pill.is-direct {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #cbd5e1;
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.08);
}
.proxy-run-pill.is-proxy {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #60a5fa;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);
}

.toggle-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  border-radius: 0;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #475569;
  cursor: pointer;
  transition: all 0.18s ease;
}
.toggle-switch.inline { min-width: 0; justify-content: flex-start; }
.toggle-switch .toggle-track {
  position: relative;
  width: 32px;
  height: 18px;
  border-radius: 999px;
  background: #cbd5e1;
  flex: 0 0 auto;
  transition: background 0.18s ease;
}
.toggle-switch .toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.24);
  transition: transform 0.18s ease;
}
.toggle-switch.is-on { color: #1d4ed8; }
.toggle-switch.is-on .toggle-track { background: #2563eb; }
.toggle-switch.is-on .toggle-thumb { transform: translateX(14px); }
.toggle-switch:hover { color: #1d4ed8; }
.toggle-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}
.toggle-switch:disabled { opacity: 0.65; cursor: wait; box-shadow: none; }
.toggle-switch .toggle-text { white-space: nowrap; }

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
.modal-form select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.modal-form textarea { resize: vertical; }
.modal-form label small { color: #64748b; }
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
