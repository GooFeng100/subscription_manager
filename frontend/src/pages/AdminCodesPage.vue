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
      <input id="admin-codes-filter-code" name="adminCodesFilterCode" v-model="qCode" placeholder="筛选授权码" @keyup.enter="submitFilters" />
      <input id="admin-codes-filter-user" name="adminCodesFilterUser" v-model="qUser" placeholder="筛选使用用户" @keyup.enter="submitFilters" />
      <select id="admin-codes-filter-status" name="adminCodesFilterStatus" v-model="qStatus">
        <option value="">全部状态</option>
        <option value="unused">未使用</option>
        <option value="used">已使用</option>
        <option value="revoked">已作废</option>
      </select>
      <button type="button" class="export-btn" :disabled="loadingCodes" @click="openExport">导出授权码</button>
      <button type="button" class="add-btn" @click="openCreate">生成授权码</button>
    </div>

    <div class="table-wrap">
      <p class="table-note">统计按全部授权码计算，不受当前筛选和分页影响；点击下方统计项可快速切换状态筛选。</p>
      <table class="table">
        <thead>
          <tr>
            <th>授权码</th>
            <th>有效期规则</th>
            <th>创建日期</th>
            <th>使用日期</th>
            <th>使用用户</th>
            <th>状态</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in items" :key="c.id">
            <td>
              <button class="copy-code" type="button" @click="copyCode(c.code)">{{ c.code }}</button>
            </td>
            <td>{{ c.displayExpireRule }}</td>
            <td>{{ fmtDay(c.created_at) }}</td>
            <td>{{ fmtDay(c.used_at) }}</td>
            <td>{{ c.used_by_username || '-' }}</td>
            <td><span class="status" :class="statusClass(c.status)">{{ statusLabel(c) }}</span></td>
            <td>{{ c.note || '-' }}</td>
            <td>
              <div class="actions">
                <button type="button" class="edit" :disabled="c.status !== 'unused'" @click="openEdit(c)">修改</button>
                <button type="button" class="warn" :disabled="c.status === 'used' || c.status === 'revoked'" @click="openRevoke(c)">作废</button>
                <button type="button" class="danger" :disabled="c.status === 'used'" @click="openDelete(c)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="loadingCodes" class="empty-row">
            <td colspan="8">加载中...</td>
          </tr>
          <tr v-else-if="items.length === 0" class="empty-row">
            <td colspan="8">暂无授权码数据</td>
          </tr>
        </tbody>
      </table>
        <div class="table-footer">
          <div class="summary-line">
          <button type="button" class="summary-btn" :class="{ active: qStatus === 'used' }" :aria-pressed="qStatus === 'used'" @click="setStatusFilter('used')">已使用 {{ stats.used }} 个</button>
          <span>/</span>
          <button type="button" class="summary-btn" :class="{ active: qStatus === 'unused' }" :aria-pressed="qStatus === 'unused'" @click="setStatusFilter('unused')">未使用 {{ stats.unused }} 个</button>
          <span>/</span>
          <button type="button" class="summary-btn" :class="{ active: qStatus === 'revoked' }" :aria-pressed="qStatus === 'revoked'" @click="setStatusFilter('revoked')">已作废 {{ stats.revoked }} 个</button>
          <span>/</span>
          <button type="button" class="summary-btn" :class="{ active: qStatus === '' }" :aria-pressed="qStatus === ''" @click="clearStatusFilter">共 {{ stats.total }} 个</button>
          </div>
        <div class="pager">
          <span>{{ rangeText }}</span>
          <button type="button" :disabled="loadingCodes || currentPage <= 1" @click="goPage(currentPage - 1)">上一页</button>
          <strong>{{ currentPage }} / {{ totalPages }}</strong>
          <button type="button" :disabled="loadingCodes || currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页</button>
        </div>
      </div>
      <p class="copy-msg" role="status" aria-live="polite">{{ copyMsg }}</p>
    </div>

    <div v-if="createOpen" class="modal-mask">
      <div class="modal create-modal">
        <div class="modal-head">
          <h3>生成授权码</h3>
          <button type="button" class="icon-close" @click="createOpen = false">×</button>
        </div>
        <div class="modal-form">
          <label>生成数量<input id="admin-codes-create-count" name="adminCodesCreateCount" v-model.number="createCount" type="number" min="1" max="100" placeholder="请输入生成数量，例如 10" /></label>
          <fieldset class="mode-fieldset">
            <legend>激活模式</legend>
            <label class="radio-line"><input id="admin-codes-create-mode-add-days" name="adminCodesCreateMode" v-model="createMode" type="radio" value="add_days" />增加有效期天数</label>
            <label class="radio-line"><input id="admin-codes-create-mode-fixed-date" name="adminCodesCreateMode" v-model="createMode" type="radio" value="fixed_expire_date" />设置到固定日期</label>
          </fieldset>
          <template v-if="createMode === 'add_days'">
            <p class="form-hint">从账号当前到期日累加；若账号已过期或未激活，则从今天起算。</p>
            <div class="field-label">授权天数</div>
            <div class="day-quick">
              <button type="button" :class="{ active: createDays === 30 }" @click="setDays(30)">30天</button>
              <button type="button" :class="{ active: createDays === 90 }" @click="setDays(90)">90天</button>
              <button type="button" :class="{ active: createDays === 180 }" @click="setDays(180)">180天</button>
              <button type="button" :class="{ active: createDays === 365 }" @click="setDays(365)">365天</button>
              <button type="button" :class="{ active: customDays }" @click="customDays = true">自定义</button>
            </div>
            <input v-if="customDays" id="admin-codes-create-days" name="adminCodesCreateDays" v-model.number="createDays" type="number" min="1" max="3650" placeholder="请输入自定义天数" />
          </template>
          <template v-else>
            <p class="form-hint">固定日期会直接设置账号到期日，不是累加；到期日当天 23:59:59（北京时间）前仍有效。</p>
            <label>固定到期日<input id="admin-codes-create-fixed-expire-date" name="adminCodesCreateFixedExpireDate" v-model="createFixedExpireDate" type="date" /></label>
          </template>
          <label>备注<textarea id="admin-codes-create-note" name="adminCodesCreateNote" v-model="createNote" rows="3" placeholder="可选，用于记录本次生成用途"></textarea></label>
        </div>
        <div class="modal-actions modal-foot">
          <button type="button" @click="createOpen = false">取消</button>
          <button type="button" class="add-btn" @click="submitCreate">确认生成</button>
        </div>
      </div>
    </div>

    <div v-if="exportOpen" class="modal-mask">
      <div class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
        <div class="modal-head">
          <h3 id="export-modal-title">导出授权码</h3>
          <button type="button" class="icon-close" aria-label="关闭导出弹窗" @click="closeExportDialog">×</button>
        </div>
        <div class="modal-form" :aria-busy="exportPoolLoading">
          <p class="form-hint">先按状态筛选，再只显示这个结果里真实存在的固定天数或固定到期日；默认勾选全部状态，且不选择任何有效期规则。</p>
          <p v-if="exportPoolLoading" class="form-hint">正在加载可导出的授权码范围...</p>

          <section class="export-section">
            <div class="section-title">状态</div>
            <div class="status-grid">
              <label class="checkbox-line"><input v-model="exportStatusFlags.unused" type="checkbox" />未使用</label>
              <label class="checkbox-line"><input v-model="exportStatusFlags.used" type="checkbox" />已使用</label>
              <label class="checkbox-line"><input v-model="exportStatusFlags.revoked" type="checkbox" />已作废</label>
            </div>
          </section>

          <section class="export-section">
            <div class="section-title">有效期规则</div>
            <label class="checkbox-line"><input :checked="exportAddDaysEnabled" type="checkbox" @change="onExportAddDaysToggle" />增加有效期天数</label>
            <div v-if="exportAddDaysEnabled" class="nested-panel">
              <div class="subsection-head">
                <div class="subsection-title">可选固定天数</div>
                <span class="subsection-count">共 {{ availableExportDays.length }} 项</span>
              </div>
              <p v-if="availableExportDays.length === 0" class="form-hint">当前状态下没有可选的固定天数。</p>
              <div v-else class="choice-grid">
                <label v-for="day in availableExportDays" :key="day" class="mini-checkbox">
                  <input :checked="exportSelectedDays.includes(day)" type="checkbox" @change="toggleExportDay(day)" />
                  {{ day }} 天
                </label>
              </div>
              <div class="subsection-head">
                <div class="subsection-title">已选固定天数</div>
                <span class="subsection-count">共 {{ exportSelectedDays.length }} 项</span>
              </div>
              <div v-if="exportSelectedDays.length" class="tag-list">
                <button v-for="day in exportSelectedDays" :key="day" type="button" class="tag-chip" @click="removeExportDay(day)">
                  {{ day }} 天 <span>×</span>
                </button>
              </div>
              <p v-else class="form-hint">尚未选择固定天数。</p>
            </div>

            <label class="checkbox-line"><input :checked="exportFixedDateEnabled" type="checkbox" @change="onExportFixedDateToggle" />固定到期日</label>
            <div v-if="exportFixedDateEnabled" class="nested-panel">
              <div class="subsection-head">
                <div class="subsection-title">可选固定到期日</div>
                <span class="subsection-count">共 {{ availableExportDates.length }} 项</span>
              </div>
              <p v-if="availableExportDates.length === 0" class="form-hint">当前状态下没有可选的固定到期日。</p>
              <div v-else class="choice-grid">
                <label v-for="date in availableExportDates" :key="date" class="mini-checkbox">
                  <input :checked="exportSelectedDates.includes(date)" type="checkbox" @change="toggleExportDate(date)" />
                  {{ date }}
                </label>
              </div>
              <div class="subsection-head">
                <div class="subsection-title">已选固定到期日</div>
                <span class="subsection-count">共 {{ exportSelectedDates.length }} 项</span>
              </div>
              <div v-if="exportSelectedDates.length" class="tag-list">
                <button v-for="date in exportSelectedDates" :key="date" type="button" class="tag-chip" @click="removeExportDate(date)">
                  {{ date }} <span>×</span>
                </button>
              </div>
              <p v-else class="form-hint">尚未选择固定到期日。</p>
            </div>

            <label class="checkbox-line"><input v-model="exportAutoCloseEnabled" type="checkbox" />导出成功后 1 秒自动关闭</label>
            <div class="export-a11y">
              <p class="form-hint">提示：状态复选框和规则选项都支持键盘操作，按 Esc 可关闭导出弹窗。</p>
            </div>
          </section>
        </div>
        <div class="modal-actions modal-foot">
          <button type="button" @click="closeExportDialog">取消</button>
          <button type="button" :disabled="exportBusy" @click="exportToClipboard">{{ exportBusy ? '导出中...' : '导出到剪贴板' }}</button>
          <button type="button" class="export-btn" :disabled="exportBusy" @click="exportToTxt">{{ exportBusy ? '导出中...' : '导出为 TXT' }}</button>
        </div>
      </div>
    </div>

    <div v-if="exportSuccessOpen" class="modal-mask">
      <div class="modal success-modal export-success-modal" role="dialog" aria-modal="true" aria-labelledby="export-success-title">
        <div class="modal-content">
          <h3 id="export-success-title">导出成功</h3>
          <p class="sub">共导出 {{ exportSuccessCount }} 条授权码</p>
        </div>
        <div class="modal-actions">
          <button type="button" aria-label="关闭导出成功提示" @click="closeExportSuccess">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="exportNoticeOpen" class="modal-mask notice-mask">
      <div class="modal notice-modal" role="status" aria-live="polite" aria-atomic="true">
        <div class="modal-content">
          <h3>{{ exportNoticeTitle }}</h3>
          <p class="sub">{{ exportNoticeMessage }}</p>
        </div>
      </div>
    </div>

    <div v-if="editOpen" class="modal-mask">
      <div class="modal create-modal">
        <div class="modal-head">
          <h3>修改授权码</h3>
          <button type="button" class="icon-close" @click="editOpen = false">×</button>
        </div>
        <div class="modal-form">
          <p class="form-hint">仅未使用授权码可修改。当前授权码：{{ selectedCode?.code }}</p>
          <fieldset class="mode-fieldset">
            <legend>激活模式</legend>
            <label class="radio-line"><input id="admin-codes-edit-mode-add-days" name="adminCodesEditMode" v-model="editMode" type="radio" value="add_days" />增加有效期天数</label>
            <label class="radio-line"><input id="admin-codes-edit-mode-fixed-date" name="adminCodesEditMode" v-model="editMode" type="radio" value="fixed_expire_date" />设置到固定日期</label>
          </fieldset>
          <template v-if="editMode === 'add_days'">
            <p class="form-hint">从账号当前到期日累加；若账号已过期或未激活，则从今天起算。</p>
            <label>授权天数<input id="admin-codes-edit-days" name="adminCodesEditDays" v-model.number="editDays" type="number" min="1" max="3650" placeholder="请输入天数" /></label>
          </template>
          <template v-else>
            <p class="form-hint">固定日期会直接设置账号到期日，不是累加；允许比用户当前到期日更早。</p>
            <label>固定到期日<input id="admin-codes-edit-fixed-expire-date" name="adminCodesEditFixedExpireDate" v-model="editFixedExpireDate" type="date" /></label>
          </template>
          <label>备注<textarea id="admin-codes-edit-note" name="adminCodesEditNote" v-model="editNote" rows="3" placeholder="可选，用于记录用途"></textarea></label>
        </div>
        <div class="modal-actions modal-foot">
          <button type="button" @click="editOpen = false">取消</button>
          <button type="button" class="add-btn" @click="submitEdit">保存修改</button>
        </div>
      </div>
    </div>

    <div v-if="successOpen" class="modal-mask">
      <div class="modal success-modal">
        <div class="modal-content">
          <h3>生成成功</h3>
          <p class="sub">共生成 {{ createdCodes.length }} 个授权码</p>
          <textarea id="admin-codes-created-result" name="adminCodesCreatedResult" readonly :value="createdCodes.join('\n')" rows="8"></textarea>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { api, fmtDateOnly } from '../lib/api';

type CodeMode = 'add_days' | 'fixed_expire_date';

type Item = {
  id: string;
  code: string;
  mode: CodeMode;
  days: number;
  fixedExpireDate: string | null;
  displayExpireRule: string;
  status: 'unused' | 'used' | 'revoked' | string;
  revokeReason?: string | null;
  used_by_username: string | null;
  used_at: string | null;
  created_at: string;
  note?: string | null;
};
type ApiCodeItem = {
  id: string;
  code: string;
  mode?: CodeMode;
  days?: number;
  duration_days: number;
  fixedExpireDate?: string | null;
  fixed_expire_date?: string | null;
  displayExpireRule?: string;
  status: 'unused' | 'used' | 'revoked' | string;
  revokeReason?: string | null;
  used_by_username: string | null;
  used_at: string | null;
  created_at: string;
  note?: string | null;
};
type CreateCodeResponse = {
  items: Array<{
    code: string;
    mode?: CodeMode;
    duration_days: number;
    grace_days: number;
    status: string;
  }>;
};
type ListCodeResponse = {
  items: ApiCodeItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  stats?: {
    total?: number;
    used?: number;
    unused?: number;
    revoked?: number;
  };
};
type ExportCodeResponse = {
  items: ApiCodeItem[];
  total?: number;
};

const PAGE_SIZE = 20;

const items = ref<Item[]>([]);
const error = ref('');
const copyMsg = ref('');
const qCode = ref('');
const qUser = ref('');
const qStatus = ref<'' | 'unused' | 'used' | 'revoked'>('');
const loadingCodes = ref(false);
const currentPage = ref(1);
const total = ref(0);
const stats = reactive({ total: 0, used: 0, unused: 0, revoked: 0 });
let filterTimer: number | undefined;
let suppressFilterWatch = false;
const exportOpen = ref(false);
const exportBusy = ref(false);
const exportStatusFlags = reactive({
  unused: true,
  used: true,
  revoked: true
});
const exportAddDaysEnabled = ref(false);
const exportFixedDateEnabled = ref(false);
const exportSelectedDays = ref<number[]>([]);
const exportSelectedDates = ref<string[]>([]);
const exportPool = ref<Item[]>([]);
const exportPoolLoading = ref(false);
let exportPoolTimer: number | undefined;
const exportSuccessOpen = ref(false);
const exportSuccessCount = ref(0);
const exportAutoCloseEnabled = ref(true);
let exportSuccessTimer: number | undefined;
const exportNoticeOpen = ref(false);
const exportNoticeTitle = ref('');
const exportNoticeMessage = ref('');
let exportNoticeTimer: number | undefined;

const createOpen = ref(false);
const createCount = ref(5);
const createMode = ref<CodeMode>('add_days');
const createDays = ref(30);
const createFixedExpireDate = ref('');
const customDays = ref(false);
const createNote = ref('');
const successOpen = ref(false);
const createdCodes = ref<string[]>([]);

const editOpen = ref(false);
const editMode = ref<CodeMode>('add_days');
const editDays = ref(30);
const editFixedExpireDate = ref('');
const editNote = ref('');

const confirmOpen = ref(false);
const confirmMode = ref<'revoke' | 'delete'>('revoke');
const selectedCode = ref<Item | null>(null);

function buildDisplayRule(mode: CodeMode, days: number, fixedExpireDate: string | null) {
  return mode === 'fixed_expire_date' ? `固定到期 ${fixedExpireDate || '-'}` : `增加 ${days} 天`;
}

function normalizeCodeItem(i: ApiCodeItem): Item {
  const mode = i.mode === 'fixed_expire_date' ? 'fixed_expire_date' : 'add_days';
  const days = Number(i.days ?? i.duration_days ?? 0);
  const fixedExpireDate = i.fixedExpireDate ?? i.fixed_expire_date ?? null;
  return {
    id: i.id,
    code: i.code,
    mode,
    days,
    fixedExpireDate,
    displayExpireRule: i.displayExpireRule || buildDisplayRule(mode, days, fixedExpireDate),
    status: i.status,
    revokeReason: i.revokeReason ?? null,
    used_by_username: i.used_by_username,
    used_at: i.used_at,
    created_at: i.created_at,
    note: i.note ?? null
  };
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const rangeText = computed(() => {
  if (total.value <= 0) return '第 0-0 条 / 共 0 条';
  const start = (currentPage.value - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage.value * PAGE_SIZE, total.value);
  return `第 ${start}-${end} 条 / 共 ${total.value} 条`;
});

function fmtDay(value: string | null | undefined) {
  return fmtDateOnly(value);
}

function statusClass(status: string) {
  if (status === 'unused') return 'is-unused';
  if (status === 'used') return 'is-used';
  if (status === 'revoked') return 'is-revoked';
  return 'is-used';
}

function statusLabel(item: Item) {
  const status = item.status;
  if (status === 'unused') return '未使用';
  if (status === 'used') return '已使用';
  if (status === 'revoked') return item.revokeReason === 'expired_fixed_date' ? '自动作废' : '已作废';
  return status;
}

function openExport() {
  exportStatusFlags.unused = true;
  exportStatusFlags.used = true;
  exportStatusFlags.revoked = true;
  exportAddDaysEnabled.value = false;
  exportFixedDateEnabled.value = false;
  exportSelectedDays.value = [];
  exportSelectedDates.value = [];
  exportSuccessOpen.value = false;
  exportSuccessCount.value = 0;
  exportAutoCloseEnabled.value = true;
  exportNoticeOpen.value = false;
  exportNoticeTitle.value = '';
  exportNoticeMessage.value = '';
  exportOpen.value = true;
  void loadExportPool();
}

function closeExportDialog() {
  if (exportPoolTimer !== undefined) {
    window.clearTimeout(exportPoolTimer);
    exportPoolTimer = undefined;
  }
  if (exportSuccessTimer !== undefined) {
    window.clearTimeout(exportSuccessTimer);
    exportSuccessTimer = undefined;
  }
  if (exportNoticeTimer !== undefined) {
    window.clearTimeout(exportNoticeTimer);
    exportNoticeTimer = undefined;
  }
  exportPoolLoading.value = false;
  exportOpen.value = false;
  exportSuccessOpen.value = false;
  exportNoticeOpen.value = false;
}

async function reloadCodes() {
  loadingCodes.value = true;
  try {
    const query = buildCodesQuery({
      page: currentPage.value,
      pageSize: PAGE_SIZE,
      code: qCode.value.trim(),
      user: qUser.value.trim(),
      status: qStatus.value,
      mode: ''
    });
    const latest = await api<ListCodeResponse>(`/api/admin/codes?${query.toString()}`);
    items.value = (latest.items || []).map(normalizeCodeItem);
    total.value = Number(latest.total || 0);
    currentPage.value = Number(latest.page || currentPage.value || 1);
    stats.total = Number(latest.stats?.total || latest.total || 0);
    stats.used = Number(latest.stats?.used || 0);
    stats.unused = Number(latest.stats?.unused || 0);
    stats.revoked = Number(latest.stats?.revoked || 0);
  } finally {
    loadingCodes.value = false;
  }
}

function buildCodesQuery(params: {
  page: number;
  pageSize: number;
  code?: string;
  user?: string;
  status?: '' | 'unused' | 'used' | 'revoked';
  mode?: '' | 'add_days' | 'fixed_expire_date';
}) {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('pageSize', String(params.pageSize));
  if (params.code?.trim()) query.set('code', params.code.trim());
  if (params.user?.trim()) query.set('used_by_username', params.user.trim());
  if (params.status) query.set('status', params.status);
  if (params.mode) query.set('mode', params.mode);
  return query;
}

async function submitFilters() {
  currentPage.value = 1;
  await reloadCodes();
}

async function setStatusFilter(status: 'unused' | 'used' | 'revoked') {
  if (qStatus.value === status && currentPage.value === 1) return;
  suppressFilterWatch = true;
  qStatus.value = status;
  currentPage.value = 1;
  try {
    await reloadCodes();
  } finally {
    suppressFilterWatch = false;
  }
}

async function clearStatusFilter() {
  if (qStatus.value === '' && currentPage.value === 1) return;
  suppressFilterWatch = true;
  qStatus.value = '';
  currentPage.value = 1;
  try {
    await reloadCodes();
  } finally {
    suppressFilterWatch = false;
  }
}

function scheduleFilterReload() {
  if (filterTimer !== undefined) {
    window.clearTimeout(filterTimer);
  }
  filterTimer = window.setTimeout(() => {
    void submitFilters();
  }, 220);
}

function toggleExportDay(day: number) {
  const next = new Set(exportSelectedDays.value);
  if (next.has(day)) next.delete(day);
  else next.add(day);
  exportSelectedDays.value = Array.from(next).sort((a, b) => a - b);
}

function onExportAddDaysToggle(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  exportAddDaysEnabled.value = checked;
  if (checked) {
    exportFixedDateEnabled.value = false;
  }
}

function onExportFixedDateToggle(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  exportFixedDateEnabled.value = checked;
  if (checked) {
    exportAddDaysEnabled.value = false;
  }
}

function removeExportDay(day: number) {
  exportSelectedDays.value = exportSelectedDays.value.filter((item) => item !== day);
}

function toggleExportDate(date: string) {
  const next = new Set(exportSelectedDates.value);
  if (next.has(date)) next.delete(date);
  else next.add(date);
  exportSelectedDates.value = Array.from(next).sort();
}

function removeExportDate(date: string) {
  exportSelectedDates.value = exportSelectedDates.value.filter((item) => item !== date);
}

function matchesExportStatus(item: Item) {
  const statusOk =
    (item.status === 'unused' && exportStatusFlags.unused) ||
    (item.status === 'used' && exportStatusFlags.used) ||
    (item.status === 'revoked' && exportStatusFlags.revoked);
  if (!statusOk) return false;
  return true;
}

function getExportStatusFilteredItems() {
  return exportPool.value.filter(matchesExportStatus);
}

const availableExportDays = computed(() => {
  const values = new Set<number>();
  for (const item of getExportStatusFilteredItems()) {
    if (item.mode !== 'add_days') continue;
    if (Number.isFinite(item.days) && item.days > 0) {
      values.add(item.days);
    }
  }
  return [...values].sort((a, b) => a - b);
});

const availableExportDates = computed(() => {
  const values = new Set<string>();
  for (const item of getExportStatusFilteredItems()) {
    if (item.mode !== 'fixed_expire_date') continue;
    const fixedDate = item.fixedExpireDate || '';
    if (fixedDate) {
      values.add(fixedDate);
    }
  }
  return [...values].sort();
});

function selectedExportStatuses() {
  return ([
    exportStatusFlags.unused ? 'unused' : null,
    exportStatusFlags.used ? 'used' : null,
    exportStatusFlags.revoked ? 'revoked' : null
  ].filter(Boolean) as Array<'unused' | 'used' | 'revoked'>);
}

function buildExportRequestBody(options?: { includeRules?: boolean }) {
  const body: {
    statuses: Array<'unused' | 'used' | 'revoked'>;
    addDaysEnabled: boolean;
    fixedDateEnabled: boolean;
    days?: number[];
    fixedExpireDates?: string[];
  } = {
    statuses: selectedExportStatuses(),
    addDaysEnabled: Boolean(options?.includeRules && exportAddDaysEnabled.value),
    fixedDateEnabled: Boolean(options?.includeRules && exportFixedDateEnabled.value)
  };

  if (options?.includeRules) {
    if (exportAddDaysEnabled.value && exportSelectedDays.value.length > 0) {
      body.days = [...exportSelectedDays.value];
    }
    if (exportFixedDateEnabled.value && exportSelectedDates.value.length > 0) {
      body.fixedExpireDates = [...exportSelectedDates.value];
    }
  }

  return body;
}

async function loadExportPool() {
  exportPoolLoading.value = true;
  if (exportPoolTimer !== undefined) {
    window.clearTimeout(exportPoolTimer);
  }
  exportPoolTimer = window.setTimeout(async () => {
    try {
      const latest = await api<ExportCodeResponse>('/api/admin/codes/export', {
        method: 'POST',
        body: JSON.stringify(buildExportRequestBody({ includeRules: false }))
      });
      exportPool.value = (latest.items || []).map(normalizeCodeItem);
    } catch (e) {
      error.value = `读取导出数据失败：${(e as Error).message}`;
      exportPool.value = [];
    } finally {
      exportPoolLoading.value = false;
      exportPoolTimer = undefined;
    }
  }, 120);
}

function pruneExportSelections() {
  const daySet = new Set(availableExportDays.value);
  const dateSet = new Set(availableExportDates.value);
  exportSelectedDays.value = exportSelectedDays.value.filter((day) => daySet.has(day));
  exportSelectedDates.value = exportSelectedDates.value.filter((date) => dateSet.has(date));
}

async function exportToClipboard() {
  await exportCodes('clipboard');
}

async function exportToTxt() {
  await exportCodes('txt');
}

async function exportCodes(method: 'clipboard' | 'txt') {
  exportBusy.value = true;
  try {
    const latest = await api<ExportCodeResponse>('/api/admin/codes/export', {
      method: 'POST',
      body: JSON.stringify(buildExportRequestBody({ includeRules: true }))
    });
    const codes = (latest.items || []).map((item) => item.code);
    if (codes.length === 0) {
      showExportNotice('没有可导出的授权码', '当前筛选条件下没有匹配数据');
      copyMsg.value = '没有匹配的授权码可导出';
      return;
    }
    const text = codes.join('\n');
    if (method === 'clipboard') {
      const copied = await copyText(text);
      copyMsg.value = copied ? `已导出 ${codes.length} 个授权码到剪贴板` : '导出失败，请手动复制';
      if (copied) {
        showExportSuccess(codes.length);
      }
      return;
    }
    downloadTxt(text, `activation-codes-${fmtExportStamp()}.txt`);
    copyMsg.value = `已导出 ${codes.length} 个授权码为 TXT`;
    showExportSuccess(codes.length);
  } catch (e) {
    error.value = `导出失败：${(e as Error).message}`;
  } finally {
    exportBusy.value = false;
  }
}

function showExportSuccess(count: number) {
  if (exportSuccessTimer !== undefined) {
    window.clearTimeout(exportSuccessTimer);
    exportSuccessTimer = undefined;
  }
  if (exportNoticeTimer !== undefined) {
    window.clearTimeout(exportNoticeTimer);
    exportNoticeTimer = undefined;
  }
  exportSuccessCount.value = count;
  exportSuccessOpen.value = true;
  if (exportAutoCloseEnabled.value) {
    exportSuccessTimer = window.setTimeout(() => {
      closeExportSuccess();
    }, 1000);
  }
}

function closeExportSuccess() {
  if (exportSuccessTimer !== undefined) {
    window.clearTimeout(exportSuccessTimer);
    exportSuccessTimer = undefined;
  }
  closeExportDialog();
}

function showExportNotice(title: string, message: string) {
  if (exportNoticeTimer !== undefined) {
    window.clearTimeout(exportNoticeTimer);
    exportNoticeTimer = undefined;
  }
  exportNoticeTitle.value = title;
  exportNoticeMessage.value = message;
  exportNoticeOpen.value = true;
  exportNoticeTimer = window.setTimeout(() => {
    exportNoticeOpen.value = false;
    exportNoticeTimer = undefined;
  }, 1000);
}

async function goPage(page: number) {
  const nextPage = Math.max(1, Math.min(totalPages.value, page));
  if (nextPage === currentPage.value) return;
  currentPage.value = nextPage;
  await reloadCodes();
}

async function copyCode(code: string) {
  const copied = await copyText(code);
  copyMsg.value = copied ? `已复制：${code}` : '复制失败，请手动复制';
}

function openCreate() {
  customDays.value = false;
  createMode.value = 'add_days';
  createOpen.value = true;
}

function setDays(days: number) {
  createDays.value = days;
  customDays.value = false;
}

function buildRulePayload(mode: CodeMode, days: number, fixedExpireDate: string) {
  if (mode === 'fixed_expire_date') {
    return { mode, fixedExpireDate };
  }
  return { mode, durationDays: days, days };
}

async function submitCreate() {
  const count = Math.max(1, Math.min(100, Number(createCount.value) || 1));
  const days = Math.max(1, Math.min(3650, Number(createDays.value) || 30));
  const note = createNote.value.trim();

  try {
    const created = await api<CreateCodeResponse>('/api/admin/codes', {
      method: 'POST',
      body: JSON.stringify({ count, ...buildRulePayload(createMode.value, days, createFixedExpireDate.value), graceDays: 3, note })
    });
    await reloadCodes();
    createdCodes.value = (created.items || []).map((i) => i.code);
  } catch (e) {
    error.value = `生成失败：${(e as Error).message}`;
    return;
  }

  createOpen.value = false;
  createNote.value = '';
  successOpen.value = true;
}

function openEdit(c: Item) {
  if (c.status !== 'unused') return;
  selectedCode.value = c;
  editMode.value = c.mode;
  editDays.value = c.days || 30;
  editFixedExpireDate.value = c.fixedExpireDate || '';
  editNote.value = c.note || '';
  editOpen.value = true;
}

async function submitEdit() {
  const target = selectedCode.value;
  if (!target) return;
  const days = Math.max(1, Math.min(3650, Number(editDays.value) || 30));
  try {
    await api(`/api/admin/codes/${target.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...buildRulePayload(editMode.value, days, editFixedExpireDate.value), note: editNote.value.trim() })
    });
    await reloadCodes();
    copyMsg.value = `已修改授权码：${target.code}`;
    editOpen.value = false;
    selectedCode.value = null;
  } catch (e) {
    error.value = `修改失败：${(e as Error).message}`;
  }
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

function downloadTxt(text: string, filename: string) {
  const blob = new Blob([`\ufeff${text}`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtExportStamp() {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
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
    await reloadCodes();
  } catch (e) {
    error.value = `操作失败：${(e as Error).message}`;
  }

  confirmOpen.value = false;
  selectedCode.value = null;
}

onMounted(async () => {
  try {
    await reloadCodes();
  } catch (e) {
    error.value = `接口读取失败：${(e as Error).message}`;
    items.value = [];
  }
  window.addEventListener('keydown', handleGlobalKeydown);
});

watch([qCode, qUser, qStatus], () => {
  if (suppressFilterWatch) return;
  scheduleFilterReload();
});

watch(
  [
    () => exportStatusFlags.unused,
    () => exportStatusFlags.used,
    () => exportStatusFlags.revoked
  ],
  () => {
    if (exportOpen.value) {
      void loadExportPool();
    }
  },
  { immediate: true }
);

watch([availableExportDays, availableExportDates], () => {
  pruneExportSelections();
});

onBeforeUnmount(() => {
  if (filterTimer !== undefined) {
    window.clearTimeout(filterTimer);
  }
  if (exportPoolTimer !== undefined) {
    window.clearTimeout(exportPoolTimer);
  }
  if (exportSuccessTimer !== undefined) {
    window.clearTimeout(exportSuccessTimer);
  }
  if (exportNoticeTimer !== undefined) {
    window.clearTimeout(exportNoticeTimer);
    exportNoticeTimer = undefined;
  }
  window.removeEventListener('keydown', handleGlobalKeydown);
});

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (exportSuccessOpen.value) {
    event.preventDefault();
    closeExportSuccess();
    return;
  }
  if (exportNoticeOpen.value) {
    event.preventDefault();
    exportNoticeOpen.value = false;
    return;
  }
  if (exportOpen.value) {
    event.preventDefault();
    closeExportDialog();
  }
}
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.error { color: #b91c1c; margin: 0 0 10px; }
.badge { border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }

.filters { display: grid; grid-template-columns: 1fr 1fr 140px 96px 120px; gap: 8px; margin-bottom: 12px; }
.filters input, .filters select, .filters button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }
.filters select { color: #334155; }
.filters button { min-width: 96px; white-space: nowrap; cursor: pointer; }
.filters button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.filters button:disabled { cursor: not-allowed; opacity: 0.65; box-shadow: none; }
.add-btn { border-color: #1d4ed8 !important; background: #2563eb !important; color: #fff; font-weight: 600; }
.export-btn {
  border-color: #1d4ed8 !important;
  background: #2563eb !important;
  color: #fff !important;
  font-weight: 700;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, filter 0.16s ease;
}
.export-btn:hover {
  border-color: #1d4ed8 !important;
  background: #1d4ed8 !important;
  color: #fff !important;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
  filter: brightness(1.02);
  transform: translateY(-1px);
}
.export-btn:active {
  transform: translateY(1px) scale(0.98);
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.14);
}

.table-wrap { overflow-x: auto; }
.table { width: 100%; min-width: 1120px; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 14px; vertical-align: middle; }
th { color: #64748b; font-weight: 600; background: #f8fafc; }
.empty-row td { text-align: center; color: #94a3b8; padding: 22px 8px; }
.codes-summary { color: #475569; font-size: 13px; background: #f8fafc; }

tbody tr { transition: background-color 0.16s ease; }
tbody tr:hover { background: #f3f7ff; }
tbody tr:has(.actions button:hover),
tbody tr:has(.copy-code:hover) { background: #edf4ff; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }

.copy-code { border: 1px dashed #93c5fd; background: #eff6ff; color: #1d4ed8; border-radius: 8px; padding: 4px 8px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; cursor: pointer; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.08s ease; }
.copy-code:hover { border-style: solid; border-color: #2563eb; background: #dbeafe; color: #1e40af; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14); }
.copy-code:active { transform: translateY(1px) scale(0.98); background: #bfdbfe; }
.copy-msg { margin: 8px 0 0; color: #0f766e; font-size: 12px; }
.table-note { margin: 0 0 8px; color: #64748b; font-size: 12px; }

.table-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; padding: 12px 14px; border-top: 1px solid #e2e8f0; background: #f8fafc; color: #475569; font-size: 13px; border-radius: 0 0 12px 12px; }
.summary-line { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; color: #334155; }
.summary-btn { border: 1px solid transparent; background: transparent; color: inherit; border-radius: 999px; padding: 2px 8px; font: inherit; font-weight: 600; cursor: pointer; transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
.summary-btn:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.summary-btn.active { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
.summary-line > span { color: #94a3b8; }
.pager { display: inline-flex; align-items: center; gap: 10px; }
.pager strong { color: #0f172a; min-width: 64px; text-align: center; }
.pager button { border: 1px solid #cbd5e1; background: #fff; color: #1f2937; border-radius: 8px; padding: 7px 12px; cursor: pointer; font-weight: 600; }
.pager button:disabled { cursor: not-allowed; opacity: 0.55; }

.status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.status.is-unused { background: #ecfdf3; color: #15803d; }
.status.is-used { background: #e5e7eb; color: #374151; }
.status.is-revoked { background: #fef2f2; color: #b91c1c; }

.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions button { border: 1px solid #cbd5e1; background: #fff; color: #1f2937; border-radius: 6px; padding: 4px 10px; font-size: 12px; line-height: 1.2; min-width: 56px; cursor: pointer; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease; }
.actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.actions .edit { border-color: #bfdbfe; color: #1d4ed8; background: #eff6ff; }
.actions .warn { border-color: #fcd34d; color: #92400e; background: #fffbeb; }
.actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.actions button:disabled { border-color: #e5e7eb; background: #f3f4f6; color: #9ca3af; cursor: not-allowed; box-shadow: none; }
.actions button:disabled:hover { border-color: #e5e7eb; background: #f3f4f6; color: #9ca3af; box-shadow: none; }

.modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 60; }
.notice-mask { background: rgba(15, 23, 42, 0.22); z-index: 70; }
.modal { width: 58%; max-width: 540px; min-width: 320px; background: #fff; border: 1px solid #dbe3ef; border-radius: 12px; padding: 0; overflow: hidden; }
.modal h3 { margin: 0; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #f5f7ff; }
.icon-close { border: 0 !important; background: transparent !important; color: #475569 !important; font-size: 28px; font-weight: 400; line-height: 1; cursor: pointer; padding: 0 4px !important; min-width: auto !important; min-height: auto !important; }
.modal-form { display: grid; gap: 10px; padding: 14px 16px; }
.modal-form label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.modal-form input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.modal-form select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.modal-form textarea { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; resize: vertical; }
.checkbox-line { display: flex !important; align-items: center; gap: 8px !important; }
.checkbox-line input { width: auto; padding: 0; }
.status-grid { display: flex; flex-wrap: wrap; gap: 10px 18px; }
.export-section { display: grid; gap: 10px; padding: 12px 0; border-top: 1px solid #e2e8f0; }
.export-section:first-of-type { border-top: 0; padding-top: 0; }
.section-title { color: #0f172a; font-size: 14px; font-weight: 700; }
.subsection-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.subsection-title { color: #334155; font-size: 13px; font-weight: 700; }
.subsection-count { color: #64748b; font-size: 12px; }
.nested-panel {
  display: grid;
  gap: 10px;
  margin-left: 20px;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #f8fbff;
}
.choice-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.mini-checkbox {
  display: inline-flex !important;
  align-items: center;
  gap: 8px !important;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
}
.mini-checkbox input { width: auto; padding: 0; }
.inline-add { display: flex; flex-wrap: wrap; gap: 8px; }
.inline-add input { flex: 1 1 200px; }
.inline-add button {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  min-width: 88px;
  font-weight: 600;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.08s ease;
}
.inline-add button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.inline-add button:active { transform: translateY(1px) scale(0.98); }
.tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-chip {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.08s ease;
}
.tag-chip:hover { border-color: #93c5fd; background: #dbeafe; color: #1e40af; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12); }
.tag-chip:active { transform: translateY(1px) scale(0.98); }
.tag-chip span { font-weight: 700; }
.export-a11y { margin-top: 2px; }
.mode-fieldset { border: 1px solid #dbe3ef; border-radius: 10px; display: grid; gap: 8px; margin: 0; padding: 10px 12px; }
.mode-fieldset legend { color: #334155; font-size: 13px; font-weight: 700; padding: 0 4px; }
.radio-line { display: flex !important; grid-template-columns: none !important; align-items: center; gap: 8px !important; }
.radio-line input { width: auto; padding: 0; }
.form-hint { margin: 0; color: #64748b; font-size: 12px; line-height: 1.5; }
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
.modal-actions .export-btn {
  border-color: #1d4ed8 !important;
  background: #2563eb !important;
  color: #fff !important;
}
.modal-actions .export-btn:hover {
  background: #1d4ed8 !important;
  color: #fff !important;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}
.modal-actions .warn { border-color: #fcd34d; color: #92400e; background: #fffbeb; }
.modal-actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.modal-content { padding: 14px 16px; }
.export-success-modal { width: 42%; max-width: 420px; }
.notice-modal {
  width: 34%;
  max-width: 320px;
  min-width: 260px;
  border-color: #dbeafe;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.18);
}
.notice-modal .modal-content { text-align: center; padding: 18px 16px; }
.notice-modal h3 { color: #0f172a; font-size: 18px; }
.notice-modal .sub { margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.45; }
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
  .table-footer { align-items: stretch; flex-direction: column; }
  .pager { justify-content: space-between; }
  .modal { width: calc(100vw - 24px); }
  .modal-actions { flex-wrap: wrap; }
  .modal-actions button { flex: 1 1 auto; min-width: 96px; }
}
</style>
