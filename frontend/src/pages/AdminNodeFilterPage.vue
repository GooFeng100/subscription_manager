<template>
  <AdminLayout>
    <div class="page-head">
      <div>
        <h1>节点筛选</h1>
        <p class="sub">选择需要发布到 Redis 和最终订阅中的节点。</p>
      </div>
      <div class="head-actions">
        <button type="button" class="secondary-btn" :disabled="loading || applying" @click="refreshNodes">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
        <button
          type="button"
          class="primary-btn"
          :disabled="loading || applying || counts.mongoTotal === 0 || selectedIds.size === 0"
          @click="submitFilter"
        >
          {{ applying ? '正在应用...' : '确认筛选' }}
        </button>
      </div>
    </div>

    <div class="stats-grid" aria-live="polite">
      <article class="stat-card is-mongo">
        <span>MongoDB 节点池</span>
        <strong>{{ counts.mongoTotal }} <small>个节点</small></strong>
        <p>最近一次批量刷新得到的全部节点</p>
      </article>
      <article class="stat-card is-selected" :class="{ 'has-changes': dirty }">
        <span>已选择节点</span>
        <strong>{{ selectedIds.size }} <small>/ {{ counts.mongoTotal }}</small></strong>
        <p>{{ dirty ? `服务器当前已发布选择 ${counts.mongoSelected} 个` : '与服务器选择状态一致' }}</p>
      </article>
      <article class="stat-card is-redis">
        <span>Redis 生效节点</span>
        <strong>{{ counts.redisActive }} <small>个节点</small></strong>
        <p>当前用户订阅实际使用的节点</p>
      </article>
    </div>

    <p v-if="notice" class="notice" :class="noticeKind" role="status">{{ notice }}</p>
    <p v-else-if="dirty" class="notice warning" role="status">有未保存的筛选修改</p>

    <section v-if="loading && groups.length === 0" class="loading-state" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <strong>正在读取节点池...</strong>
    </section>

    <section v-else-if="counts.mongoTotal === 0" class="empty-state">
      <div class="empty-icon" aria-hidden="true">◇</div>
      <h2>当前没有可筛选节点</h2>
      <p>请先返回“上游管理”，确认上游订阅可用，然后执行“全部测试”。</p>
      <button type="button" class="primary-btn" @click="goToUpstreams">返回上游管理</button>
    </section>

    <template v-else>
      <div class="toolbar">
        <label class="search-box" for="node-filter-search">
          <span aria-hidden="true">⌕</span>
          <input
            id="node-filter-search"
            v-model="searchText"
            name="nodeFilterSearch"
            type="search"
            autocomplete="off"
            placeholder="搜索节点名称、机场名称或协议"
          />
        </label>
        <div class="bulk-actions">
          <button type="button" :disabled="applying || allSelected" @click="selectAll">全部选择</button>
          <button type="button" :disabled="applying || selectedIds.size === 0" @click="clearAll">全部取消</button>
        </div>
      </div>

      <div class="list-summary">
        <span>共 {{ groups.length }} 个机场、{{ counts.mongoTotal }} 个节点</span>
        <span v-if="normalizedSearch">当前显示 {{ visibleNodeCount }} 个匹配节点</span>
      </div>

      <div v-if="visibleGroups.length" class="airport-list">
        <section v-for="group in visibleGroups" :key="group.upstream.id" class="airport-group">
          <header class="airport-head" @click="toggleGroup(group.upstream.id)">
            <button
              type="button"
              class="group-toggle"
              :aria-expanded="!isGroupCollapsed(group.upstream.id) || !!normalizedSearch"
              @click.stop="toggleGroup(group.upstream.id)"
            >
              <span class="chevron" :class="{ collapsed: isGroupCollapsed(group.upstream.id) && !normalizedSearch }" aria-hidden="true">▼</span>
              <span class="airport-name" :title="group.upstream.name">{{ group.upstream.name }}</span>
              <span class="group-count">{{ selectedCountForGroup(group) }} / {{ group.nodes.length }}</span>
            </button>
            <div class="group-actions" @click.stop>
              <button type="button" :disabled="applying || isGroupFullySelected(group)" @click="selectGroup(group)">全选</button>
              <button type="button" :disabled="applying || selectedCountForGroup(group) === 0" @click="clearGroup(group)">全不选</button>
            </div>
          </header>

          <div v-show="!isGroupCollapsed(group.upstream.id) || !!normalizedSearch" class="node-list">
            <label
              v-for="node in group.visibleNodes"
              :key="node.id"
              class="node-row"
              :class="{ disabled: applying, selected: selectedIds.has(node.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedIds.has(node.id)"
                :disabled="applying"
                @change="toggleNode(node.id, ($event.target as HTMLInputElement).checked)"
              />
              <span class="node-name" :title="node.name">{{ node.name }}</span>
              <span class="protocol-badge">{{ node.protocol.toUpperCase() }}</span>
            </label>
          </div>
        </section>
      </div>

      <section v-else class="search-empty">
        <strong>没有匹配的节点</strong>
        <p>搜索只影响当前显示结果，不会改变任何勾选状态。</p>
        <button type="button" @click="searchText = ''">清除搜索</button>
      </section>
    </template>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AdminLayout from '../components/admin/AdminLayout.vue';
import {
  applyNodePoolFilter,
  getNodePoolNodes,
  type NodePoolFilterGroup
} from '../lib/api';

type VisibleGroup = NodePoolFilterGroup & {
  visibleNodes: NodePoolFilterGroup['nodes'];
};

const router = useRouter();
const groups = ref<NodePoolFilterGroup[]>([]);
const counts = ref({ mongoTotal: 0, mongoSelected: 0, redisActive: 0 });
const selectedIds = ref(new Set<string>());
const initialSelectedIds = ref(new Set<string>());
const collapsedIds = ref(new Set<string>());
const searchText = ref('');
const loading = ref(false);
const applying = ref(false);
const notice = ref('');
const noticeKind = ref<'success' | 'error' | 'info'>('info');

const allNodes = computed(() => groups.value.flatMap((group) => group.nodes));
const allSelected = computed(() => allNodes.value.length > 0 && selectedIds.value.size === allNodes.value.length);
const normalizedSearch = computed(() => searchText.value.trim().toLocaleLowerCase());
const dirty = computed(() => {
  if (selectedIds.value.size !== initialSelectedIds.value.size) return true;
  return [...selectedIds.value].some((id) => !initialSelectedIds.value.has(id));
});

const visibleGroups = computed<VisibleGroup[]>(() => {
  const query = normalizedSearch.value;
  if (!query) {
    return groups.value.map((group) => ({ ...group, visibleNodes: group.nodes }));
  }
  return groups.value.flatMap((group) => {
    const airportMatches = group.upstream.name.toLocaleLowerCase().includes(query);
    const visibleNodes = airportMatches
      ? group.nodes
      : group.nodes.filter((node) =>
          node.name.toLocaleLowerCase().includes(query)
          || node.protocol.toLocaleLowerCase().includes(query)
        );
    return visibleNodes.length ? [{ ...group, visibleNodes }] : [];
  });
});

const visibleNodeCount = computed(() => visibleGroups.value.reduce((total, group) => total + group.visibleNodes.length, 0));

function replaceSelection(next: Iterable<string>) {
  selectedIds.value = new Set(next);
  notice.value = '';
}

function selectedCountForGroup(group: NodePoolFilterGroup) {
  return group.nodes.reduce((total, node) => total + (selectedIds.value.has(node.id) ? 1 : 0), 0);
}

function isGroupFullySelected(group: NodePoolFilterGroup) {
  return group.nodes.length > 0 && selectedCountForGroup(group) === group.nodes.length;
}

function toggleNode(nodeId: string, checked: boolean) {
  if (applying.value) return;
  const next = new Set(selectedIds.value);
  if (checked) next.add(nodeId);
  else next.delete(nodeId);
  replaceSelection(next);
  if (!next.size) {
    notice.value = '至少保留一个节点。';
    noticeKind.value = 'error';
  }
}

function selectAll() {
  if (applying.value) return;
  replaceSelection(allNodes.value.map((node) => node.id));
}

function clearAll() {
  if (applying.value) return;
  replaceSelection([]);
  notice.value = '至少保留一个节点，当前选择不能提交。';
  noticeKind.value = 'error';
}

function selectGroup(group: NodePoolFilterGroup) {
  if (applying.value) return;
  const next = new Set(selectedIds.value);
  group.nodes.forEach((node) => next.add(node.id));
  replaceSelection(next);
}

function clearGroup(group: NodePoolFilterGroup) {
  if (applying.value) return;
  const next = new Set(selectedIds.value);
  group.nodes.forEach((node) => next.delete(node.id));
  replaceSelection(next);
  if (!next.size) {
    notice.value = '至少保留一个节点，当前选择不能提交。';
    noticeKind.value = 'error';
  }
}

function isGroupCollapsed(upstreamId: string) {
  return collapsedIds.value.has(upstreamId);
}

function toggleGroup(upstreamId: string) {
  const next = new Set(collapsedIds.value);
  if (next.has(upstreamId)) next.delete(upstreamId);
  else next.add(upstreamId);
  collapsedIds.value = next;
}

async function loadNodes(showRefreshNotice = false, allowWhileApplying = false) {
  if (applying.value && !allowWhileApplying) return false;
  loading.value = true;
  try {
    const data = await getNodePoolNodes();
    groups.value = Array.isArray(data.groups) ? data.groups : [];
    counts.value = {
      mongoTotal: Number(data.counts?.mongoTotal || 0),
      mongoSelected: Number(data.counts?.mongoSelected || 0),
      redisActive: Number(data.counts?.redisActive || 0)
    };
    const serverSelected = groups.value
      .flatMap((group) => group.nodes)
      .filter((node) => node.selected)
      .map((node) => node.id);
    selectedIds.value = new Set(serverSelected);
    initialSelectedIds.value = new Set(serverSelected);
    const availableGroups = new Set(groups.value.map((group) => group.upstream.id));
    collapsedIds.value = new Set([...collapsedIds.value].filter((id) => availableGroups.has(id)));
    if (showRefreshNotice) {
      notice.value = '已刷新服务器节点状态。';
      noticeKind.value = 'success';
    } else {
      notice.value = '';
    }
    return true;
  } catch (error) {
    notice.value = `读取节点池失败：${(error as Error).message}`;
    noticeKind.value = 'error';
    return false;
  } finally {
    loading.value = false;
  }
}

async function refreshNodes() {
  await loadNodes(true);
}

async function submitFilter() {
  if (applying.value || loading.value) return;
  if (selectedIds.value.size === 0) {
    notice.value = '至少保留一个节点。';
    noticeKind.value = 'error';
    return;
  }

  applying.value = true;
  notice.value = '正在应用节点筛选，请稍候...';
  noticeKind.value = 'info';
  try {
    await applyNodePoolFilter([...selectedIds.value]);
    const reloaded = await loadNodes(false, true);
    if (reloaded) {
      notice.value = `节点筛选已应用。已应用 ${counts.value.redisActive} 个节点到 Redis 节点池。`;
      noticeKind.value = 'success';
    }
  } catch (error) {
    notice.value = `节点筛选应用失败：${(error as Error).message}`;
    noticeKind.value = 'error';
  } finally {
    applying.value = false;
  }
}

function goToUpstreams() {
  void router.push('/admin/upstreams');
}

onMounted(async () => {
  await loadNodes(false);
});
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }

.head-actions,
.bulk-actions,
.group-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

button {
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

button:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

.primary-btn {
  border-color: #1d4ed8 !important;
  background: #2563eb !important;
  color: #fff !important;
}

.primary-btn:not(:disabled):hover { background: #1d4ed8 !important; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14); }
.secondary-btn { border-color: #cbd5e1 !important; background: #fff !important; color: #334155 !important; }
.secondary-btn:not(:disabled):hover { border-color: #93c5fd !important; background: #eff6ff !important; color: #1d4ed8 !important; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.stat-card {
  display: flex;
  min-height: 104px;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 15px;
  background: #f8fafc;
}

.stat-card > span { color: #475569; font-size: 13px; font-weight: 700; }
.stat-card strong { display: block; margin-top: 8px; color: #0f172a; font-size: 28px; line-height: 1; }
.stat-card strong small { color: #64748b; font-size: 13px; font-weight: 600; }
.stat-card p { margin: 10px 0 0; color: #64748b; font-size: 12px; line-height: 1.35; }
.stat-card.is-mongo { border-color: #bfdbfe; background: #eff6ff; }
.stat-card.is-selected { border-color: #bbf7d0; background: #f0fdf4; }
.stat-card.is-selected.has-changes { border-color: #fcd34d; background: #fffbeb; }
.stat-card.is-redis { border-color: #c7d2fe; background: #eef2ff; }

.notice {
  margin: 0 0 14px;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 650;
}

.notice.success { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
.notice.error { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.notice.info { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
.notice.warning { color: #92400e; border-color: #fcd34d; background: #fffbeb; }

.toolbar {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
  color: #64748b;
}

.search-box:focus-within { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12); }
.search-box input { width: 100%; min-width: 0; border: 0; outline: 0; padding: 9px 0; background: transparent; }
.bulk-actions button,
.group-actions button,
.search-empty button { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
.bulk-actions button:not(:disabled):hover,
.group-actions button:not(:disabled):hover,
.search-empty button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }

.list-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0 2px 10px;
  color: #64748b;
  font-size: 12px;
}

.airport-list { display: grid; gap: 12px; }
.airport-group {
  overflow: hidden;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.airport-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 46px;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
}

.airport-head:hover { background: #f1f5f9; }

.group-toggle {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: 100%;
  padding: 4px 0;
  border: 0 !important;
  background: transparent !important;
  color: #0f172a !important;
  text-align: left;
}

.chevron { color: #64748b; font-size: 10px; transition: transform 0.16s ease; }
.chevron.collapsed { transform: rotate(-90deg); }
.airport-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 800; }
.group-count { color: #475569; font-size: 12px; font-weight: 800; white-space: nowrap; }
.group-actions { flex: 0 0 auto; }
.group-actions button { padding: 5px 10px; font-size: 12px; }

.node-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  background: #fff;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
}

.node-row:hover { border-color: #bfdbfe; background: #f8fbff; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08); }
.node-row.selected { border-color: #93c5fd; background: #eff6ff; }
.node-row.disabled { cursor: wait; opacity: 0.72; }
.node-row input { flex: 0 0 auto; width: 16px; height: 16px; margin: 0; accent-color: #2563eb; cursor: inherit; }
.node-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e293b; font-size: 13px; }
.protocol-badge { flex: 0 0 auto; min-width: 46px; max-width: 72px; overflow: hidden; text-overflow: ellipsis; padding: 3px 7px; border: 1px solid #bfdbfe; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 800; text-align: center; white-space: nowrap; }

.loading-state,
.empty-state,
.search-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-height: 220px;
  align-content: center;
  padding: 28px;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  text-align: center;
}

.loading-state { min-height: 160px; color: #475569; }
.empty-state h2 { margin: 0; color: #0f172a; font-size: 18px; }
.empty-state p,
.search-empty p { margin: 0 0 8px; color: #64748b; }
.empty-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 999px; background: #e2e8f0; color: #64748b; font-size: 24px; }
.spinner { width: 22px; height: 22px; border: 3px solid #bfdbfe; border-top-color: #2563eb; border-radius: 999px; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .page-head { align-items: stretch; flex-direction: column; }
  .head-actions { justify-content: flex-end; }
  .stats-grid { grid-template-columns: 1fr; }
}

@media (max-width: 1499px) {
  .node-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 1199px) {
  .node-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 899px) {
  .node-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .toolbar { grid-template-columns: 1fr; }
  .bulk-actions { justify-content: stretch; }
  .bulk-actions button { flex: 1; }
  .airport-head { align-items: stretch; flex-direction: column; }
  .group-actions { justify-content: flex-end; }
  .list-summary { flex-direction: column; gap: 3px; }
}

@media (max-width: 599px) {
  .node-list { grid-template-columns: 1fr; }
}
</style>
