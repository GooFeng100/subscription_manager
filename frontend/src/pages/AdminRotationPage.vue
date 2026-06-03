<template>
  <AdminLayout>
    <div class="head">
      <div>
        <h1>轮换管理</h1>
        <p class="sub">执行订阅版本轮换，查看执行记录与影响范围。</p>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="status-cards">
      <div class="card-item">
        <span>当前版本</span>
        <strong>{{ status?.sub_version ?? '-' }}</strong>
      </div>
      <div class="card-item">
        <span>有效用户数</span>
        <strong>{{ status?.active_user_count ?? '-' }}</strong>
      </div>
      <div class="card-item">
        <span>启用上游数</span>
        <strong>{{ status?.enabled_upstream_count ?? '-' }}</strong>
      </div>
    </div>

    <div class="tabs">
      <button type="button" :class="{ active: activeTab === 'manual' }" @click="activeTab = 'manual'">手动轮换</button>
      <button type="button" :class="{ active: activeTab === 'schedule' }" @click="activeTab = 'schedule'">定时轮换</button>
    </div>

    <section v-if="activeTab === 'manual'" class="panel">
      <div class="panel-head">
        <h2>手动轮换</h2>
      </div>
      <div class="panel-body form-grid">
        <label>
          轮换原因
          <input v-model="reason" placeholder="例如：上游失效切换" />
        </label>
        <label>
          确认口令
          <input v-model="confirmText" :placeholder="`请输入 ${status?.confirm_text || 'ROTATE'}`" />
        </label>
      </div>
      <div class="panel-actions">
        <p class="msg" :class="{ ok: msgType === 'ok', bad: msgType === 'bad' }">{{ msg }}</p>
        <button type="button" @click="refresh">刷新状态</button>
        <button type="button" class="primary" @click="execute">执行轮换</button>
      </div>
    </section>

    <section v-if="activeTab === 'schedule'" class="panel">
      <div class="panel-head logs-head">
        <h2>定时轮换列表</h2>
        <button type="button" class="primary mini" @click="openScheduleAdd">新增计划</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>计划名称</th>
              <th>执行周期</th>
              <th>下次执行</th>
              <th>状态</th>
              <th>备注</th>
              <th>操作区</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in scheduleItems" :key="job.id">
              <td>{{ job.name }}</td>
              <td>{{ job.cron_desc }}</td>
              <td>{{ job.next_run_at }}</td>
              <td><span class="status" :class="jobStatusClass(job)">{{ jobStatusText(job) }}</span></td>
              <td>{{ job.note || '-' }}</td>
              <td>
                <div class="actions">
                  <button type="button" :disabled="job.locked || job.status === 'expired'" @click="toggleSchedule(job)">{{ toggleScheduleText(job) }}</button>
                  <button type="button" class="danger" @click="openScheduleDelete(job)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="scheduleItems.length === 0" class="empty-row">
              <td colspan="6">暂无定时轮换计划</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head logs-head">
        <h2>轮换日志</h2>
        <div class="filters">
          <input v-model="qReason" placeholder="筛选原因" />
          <select v-model="qResult">
            <option value="">全部结果</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>版本变更</th>
              <th>轮换原因</th>
              <th>执行人</th>
              <th>影响用户</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log.id">
              <td>{{ fmtDateTime(log.created_at) }}</td>
              <td class="mono">{{ log.from_version }} → {{ log.to_version === null ? 'FAILED' : log.to_version }}</td>
              <td>{{ log.reason || '-' }}</td>
              <td>{{ log.operator_username || '-' }}</td>
              <td>{{ log.impacted_user_count }}</td>
              <td><span class="status" :class="log.success ? 'is-ok' : 'is-bad'">{{ log.success ? '成功' : '失败' }}</span></td>
            </tr>
            <tr v-if="filteredLogs.length === 0" class="empty-row">
              <td colspan="6">暂无轮换日志</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="scheduleOpen" class="modal-mask">
      <div class="modal">
        <div class="modal-head">
          <h3>新增定时轮换</h3>
          <button type="button" class="icon-close" @click="scheduleOpen = false">×</button>
        </div>
        <div class="modal-form">
          <label>计划名称<input v-model="scheduleForm.name" placeholder="例如：每日凌晨轮换" /></label>
          <label>执行模式
            <select v-model="scheduleForm.mode">
              <option value="once">指定某一日</option>
              <option value="monthly">每月第几日</option>
            </select>
          </label>
          <div class="schedule-grid">
            <label v-if="scheduleForm.mode === 'once'">指定日期
              <input v-model="scheduleForm.onceDate" type="date" />
            </label>
            <label v-if="scheduleForm.mode === 'monthly'">每月几号
              <input v-model.number="scheduleForm.dayOfMonth" type="number" min="1" max="31" />
            </label>
            <label>小时
              <input v-model.number="scheduleForm.hour" type="number" min="0" max="23" />
            </label>
            <label>分钟
              <input v-model.number="scheduleForm.minute" type="number" min="0" max="59" />
            </label>
          </div>
          <label>备注<textarea v-model="scheduleForm.note" rows="3" placeholder="可选"></textarea></label>
        </div>
        <div class="modal-actions modal-foot">
          <button type="button" @click="scheduleOpen = false">取消</button>
          <button type="button" class="primary" @click="submitScheduleAdd">确认新增</button>
        </div>
      </div>
    </div>

    <div v-if="scheduleDeleteOpen" class="modal-mask">
      <div class="modal confirm-modal">
        <div class="modal-content">
          <h3>删除计划</h3>
          <p class="sub">确认删除计划 {{ scheduleDeleteTarget?.name || '-' }} 执行该操作？</p>
        </div>
        <div class="modal-actions">
          <button type="button" @click="scheduleDeleteOpen = false">取消</button>
          <button type="button" class="danger" @click="submitScheduleDelete">确认</button>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { api } from '../lib/api';

type RotationStatus = {
  sub_version: string;
  active_user_count: number;
  enabled_upstream_count: number;
  confirm_text: string;
};

type RotationLog = {
  id: string;
  created_at: string;
  from_version: string;
  to_version: string | null;
  reason: string;
  operator_username: string;
  impacted_user_count: number;
  success: boolean;
};

type RotationSchedule = {
  id: string;
  name: string;
  mode: "once" | "monthly";
  once_date: string | null;
  day_of_month: number | null;
  hour: number;
  minute: number;
  cron_desc: string;
  next_run_at: string;
  enabled: boolean;
  locked?: boolean;
  status?: "enabled" | "disabled" | "expired";
  note?: string;
};

const status = ref<RotationStatus | null>(null);
const logs = ref<RotationLog[]>([]);
const activeTab = ref<"manual" | "schedule">("manual");
const reason = ref('manual rotate');
const confirmText = ref('');
const msg = ref('');
const msgType = ref<'ok' | 'bad' | ''>('');
const error = ref('');
const qReason = ref('');
const qResult = ref('');
const scheduleOpen = ref(false);
const scheduleDeleteOpen = ref(false);
const scheduleDeleteTarget = ref<RotationSchedule | null>(null);
const scheduleItems = ref<RotationSchedule[]>([]);
const scheduleForm = ref({
  name: "",
  mode: "once" as "once" | "monthly",
  onceDate: "",
  dayOfMonth: 1,
  hour: 3,
  minute: 0,
  note: ""
});

const filteredLogs = computed(() => logs.value.filter((log) => {
  const okReason = qReason.value ? (log.reason || '').toLowerCase().includes(qReason.value.toLowerCase()) : true;
  const okResult = qResult.value ? (qResult.value === 'success' ? log.success : !log.success) : true;
  return okReason && okResult;
}));

async function refresh() {
  try {
    status.value = await api<RotationStatus>('/api/admin/rotation/status');
    const data = await api<{ items: RotationLog[] }>('/api/admin/rotation/logs');
    logs.value = data.items || [];
    msg.value = '状态已刷新';
    msgType.value = 'ok';
  } catch (e) {
    error.value = `接口读取失败：${(e as Error).message}`;
    status.value = null;
    logs.value = [];
    msg.value = '读取失败';
    msgType.value = 'bad';
  }
}

async function execute() {
  try {
    const data = await api<{ message: string }>('/api/admin/rotation/execute', {
      method: 'POST',
      body: JSON.stringify({ reason: reason.value, confirmText: confirmText.value })
    });
    msg.value = data.message || '执行成功';
    msgType.value = 'ok';
    confirmText.value = '';
    await refresh();
  } catch (e) {
    msg.value = (e as Error).message;
    msgType.value = 'bad';
  }
}

function openScheduleAdd() {
  scheduleForm.value = { name: "", mode: "once", onceDate: "", dayOfMonth: 1, hour: 3, minute: 0, note: "" };
  scheduleOpen.value = true;
}

async function submitScheduleAdd() {
  const name = scheduleForm.value.name.trim();
  if (!name) return;
  const hh = String(Math.min(23, Math.max(0, Number(scheduleForm.value.hour) || 0))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, Number(scheduleForm.value.minute) || 0))).padStart(2, "0");
  const day = Math.min(31, Math.max(1, Number(scheduleForm.value.dayOfMonth) || 1));
  if (scheduleForm.value.mode === "once" && !scheduleForm.value.onceDate) return;
  try {
    await api('/api/admin/rotation/schedules', {
      method: 'POST',
      body: JSON.stringify({
        name,
        mode: scheduleForm.value.mode,
        once_date: scheduleForm.value.mode === 'once' ? scheduleForm.value.onceDate : null,
        day_of_month: scheduleForm.value.mode === 'monthly' ? day : null,
        hour: Number(hh),
        minute: Number(mm),
        note: scheduleForm.value.note.trim() || null
      })
    });
    await loadSchedules();
    scheduleOpen.value = false;
  } catch (e) {
    error.value = `新增计划失败：${(e as Error).message}`;
  }
}

async function loadSchedules() {
  try {
    const res = await api<{ items: RotationSchedule[] }>('/api/admin/rotation/schedules');
    scheduleItems.value = res.items || [];
  } catch (e) {
    error.value = `读取定时计划失败：${(e as Error).message}`;
    scheduleItems.value = [];
  }
}

async function toggleSchedule(job: RotationSchedule) {
  if (job.locked || job.status === 'expired') return;
  try {
    await api(`/api/admin/rotation/schedules/${job.id}/toggle`, { method: 'POST' });
    await loadSchedules();
  } catch (e) {
    error.value = `更新计划状态失败：${(e as Error).message}`;
  }
}

function openScheduleDelete(job: RotationSchedule) {
  scheduleDeleteTarget.value = job;
  scheduleDeleteOpen.value = true;
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function jobStatusText(job: RotationSchedule) {
  if (job.status === 'expired' || job.locked) return '已过期';
  if (job.enabled) return '启用';
  return '停用';
}

function jobStatusClass(job: RotationSchedule) {
  if (job.status === 'expired' || job.locked) return 'is-bad';
  return job.enabled ? 'is-ok' : 'is-disabled';
}

function toggleScheduleText(job: RotationSchedule) {
  if (job.status === 'expired' || job.locked) return '已过期';
  return job.enabled ? '停用' : '启用';
}

async function submitScheduleDelete() {
  if (!scheduleDeleteTarget.value) return;
  try {
    await api(`/api/admin/rotation/schedules/${scheduleDeleteTarget.value.id}`, { method: 'DELETE' });
    await loadSchedules();
    scheduleDeleteOpen.value = false;
    scheduleDeleteTarget.value = null;
  } catch (e) {
    error.value = `删除计划失败：${(e as Error).message}`;
  }
}

onMounted(async () => {
  await refresh();
  await loadSchedules();
});
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.badge { border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; }
.error { color: #b91c1c; margin: 0 0 10px; }
.tabs { display: inline-flex; gap: 8px; margin-bottom: 12px; }
.tabs button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 999px; padding: 7px 14px; cursor: pointer; font-size: 13px; }
.tabs button.active { border-color: #1d4ed8; background: #2563eb; color: #fff; }

.status-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.card-item { border: 1px solid #dbe3ef; background: #fff; border-radius: 10px; padding: 10px 12px; display: grid; gap: 4px; }
.card-item span { color: #64748b; font-size: 12px; }
.card-item strong { color: #0f172a; font-size: 18px; }

.panel { border: 1px solid #dbe3ef; background: #fff; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.panel-head { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.panel-head h2 { margin: 0; font-size: 16px; color: #0f172a; }
.panel-body { padding: 12px 14px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
.form-grid label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.form-grid input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }

.panel-actions { border-top: 1px solid #e2e8f0; padding: 12px 14px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; background: #f8faff; }
.msg { margin: 0 auto 0 0; font-size: 13px; color: #64748b; }
.msg.ok { color: #15803d; }
.msg.bad { color: #b91c1c; }
.panel-actions button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.panel-actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
.panel-actions .primary { border-color: #1d4ed8; background: #2563eb; color: #fff; }
.panel-actions .primary:hover { background: #1d4ed8; color: #fff; }
.panel-head .mini { border: 1px solid #1d4ed8; background: #2563eb; color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; min-width: 92px; }
.panel-head .mini:hover { background: #1d4ed8; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); }

.logs-head { align-items: flex-end; }
.filters { display: grid; grid-template-columns: 1fr 140px; gap: 8px; }
.filters input,.filters select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; min-width: 980px; border-collapse: collapse; }
th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px 8px; font-size: 14px; vertical-align: middle; }
th { color: #64748b; font-weight: 600; background: #f8fafc; }
.empty-row td { text-align: center; color: #94a3b8; padding: 22px 8px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
.status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.status.is-ok { background: #ecfdf3; color: #15803d; }
.status.is-bad { background: #fef2f2; color: #b91c1c; }
.status.is-disabled { background: #e5e7eb; color: #374151; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions button { border: 1px solid #cbd5e1; background: #fff; color: #1f2937; border-radius: 6px; padding: 4px 8px; font-size: 12px; line-height: 1.2; min-width: 52px; cursor: pointer; }
.actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.actions button:disabled { border-color: #e5e7eb; color: #9ca3af; background: #f9fafb; cursor: not-allowed; box-shadow: none; }
.actions button:disabled:hover { border-color: #e5e7eb; color: #9ca3af; background: #f9fafb; box-shadow: none; }
.actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }

.modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 60; }
.modal { width: 58%; max-width: 500px; min-width: 320px; background: #fff; border: 1px solid #dbe3ef; border-radius: 12px; padding: 0; overflow: hidden; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #f5f7ff; }
.icon-close { border: 0; background: transparent; color: #475569; font-size: 28px; line-height: 1; cursor: pointer; }
.modal-form { display: grid; gap: 10px; padding: 14px 16px; }
.modal-form label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.modal-form input,.modal-form select,.modal-form textarea { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
.schedule-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.modal-form textarea { resize: vertical; }
.modal-actions { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
.modal-foot { margin-top: 0; border-top: 1px solid #e2e8f0; padding: 12px 16px; background: #f8faff; }
.modal-actions button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.modal-actions .primary { border-color: #1d4ed8; background: #2563eb; color: #fff; }
.modal-actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14); }
.modal-actions .primary:hover { background: #1d4ed8; color: #fff; }
.modal-content { padding: 16px 18px 8px; }
.confirm-modal .sub { margin: 8px 0 0; color: #64748b; font-size: 16px; line-height: 1.45; }
.confirm-modal .modal-actions { margin-top: 0; padding: 10px 18px 16px; }
.confirm-modal .modal-actions .danger { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }

@media (max-width: 980px) {
  .status-cards { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .filters { grid-template-columns: 1fr; width: 100%; }
  .schedule-grid { grid-template-columns: 1fr; }
  .logs-head { align-items: stretch; }
}
</style>
