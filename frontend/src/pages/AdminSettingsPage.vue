<template>
  <AdminLayout>
    <div class="head">
      <div>
        <h1>系统设置</h1>
        <p class="sub">站点参数、风控策略与 Turnstile 配置。</p>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="panel">
      <div class="panel-head"><h2>基础设置</h2></div>
      <div class="panel-body form-grid">
        <label>
          允许用户注册
          <div class="switch-row"><input type="checkbox" v-model="form.registration_enabled" /><span>{{ form.registration_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>关闭后将禁止新用户自行注册，仅管理员可手动创建用户。</small>
        </label>
        <label>站点域名（环境变量，只读）
          <input v-model="form.site_domain" readonly class="readonly" />
          <small>由部署环境变量与网关配置决定，此处仅展示当前生效值。</small>
        </label>
        <label><span class="label-title">转换后端地址 <em class="req">*</em></span>
          <input v-model="form.converter_backend_url" placeholder="http://subconverter:25500" :class="{ 'is-error': !!fieldError.converter_backend_url }" @focus="clearFieldError('converter_backend_url')" />
          <small v-if="fieldError.converter_backend_url" class="error-text">{{ fieldError.converter_backend_url }}</small>
          <small>用于订阅转换的后端服务地址，通常指向 subconverter 服务。</small>
        </label>
        <label><span class="label-title">订阅缓存（秒） <em class="req">*</em></span>
          <input v-model.number="form.sub_cache_seconds" type="number" min="1" :class="{ 'is-error': !!fieldError.sub_cache_seconds }" @focus="clearFieldError('sub_cache_seconds')" />
          <small v-if="fieldError.sub_cache_seconds" class="error-text">{{ fieldError.sub_cache_seconds }}</small>
          <small>相同订阅请求在缓存有效期内直接返回缓存结果，减少上游压力。</small>
        </label>
        <label><span class="label-title">订阅限流（次/分钟） <em class="req">*</em></span>
          <input v-model.number="form.sub_rate_limit_per_minute" type="number" min="1" :class="{ 'is-error': !!fieldError.sub_rate_limit_per_minute }" @focus="clearFieldError('sub_rate_limit_per_minute')" />
          <small v-if="fieldError.sub_rate_limit_per_minute" class="error-text">{{ fieldError.sub_rate_limit_per_minute }}</small>
          <small>限制单用户/单 token 的订阅接口访问频率，避免高频刷新。</small>
        </label>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>安全策略</h2></div>
      <div class="panel-body form-grid">
        <label><span class="label-title">登录失败阈值 <em class="req">*</em></span>
          <input v-model.number="form.login_fail_limit" type="number" min="1" :class="{ 'is-error': !!fieldError.login_fail_limit }" @focus="clearFieldError('login_fail_limit')" />
          <small v-if="fieldError.login_fail_limit" class="error-text">{{ fieldError.login_fail_limit }}</small>
          <small>单账号在窗口期内允许的最大失败次数，超过后触发锁定。</small>
        </label>
        <label><span class="label-title">登录锁定时长（分钟） <em class="req">*</em></span>
          <input v-model.number="form.login_lock_minutes" type="number" min="1" :class="{ 'is-error': !!fieldError.login_lock_minutes }" @focus="clearFieldError('login_lock_minutes')" />
          <small v-if="fieldError.login_lock_minutes" class="error-text">{{ fieldError.login_lock_minutes }}</small>
          <small>触发登录保护后，账号在此时长内禁止继续尝试登录。</small>
        </label>
        <label><span class="label-title">注册 IP 限制次数 <em class="req">*</em></span>
          <input v-model.number="form.register_ip_limit" type="number" min="1" :class="{ 'is-error': !!fieldError.register_ip_limit }" @focus="clearFieldError('register_ip_limit')" />
          <small v-if="fieldError.register_ip_limit" class="error-text">{{ fieldError.register_ip_limit }}</small>
          <small>同一 IP 在统计窗口内允许的最大注册次数。</small>
        </label>
        <label><span class="label-title">注册 IP 窗口（分钟） <em class="req">*</em></span>
          <input v-model.number="form.register_ip_window_minutes" type="number" min="1" :class="{ 'is-error': !!fieldError.register_ip_window_minutes }" @focus="clearFieldError('register_ip_window_minutes')" />
          <small v-if="fieldError.register_ip_window_minutes" class="error-text">{{ fieldError.register_ip_window_minutes }}</small>
          <small>注册频率统计周期；例如 60 表示按最近 60 分钟统计。</small>
        </label>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Turnstile</h2></div>
      <div class="panel-body form-grid">
        <label>
          启用 Turnstile 总开关
          <div class="switch-row"><input type="checkbox" v-model="form.turnstile_enabled" /><span>{{ form.turnstile_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>总开关关闭时，登录/注册/兑换的子开关将不生效。</small>
        </label>
        <label>
          登录启用
          <div class="switch-row"><input type="checkbox" v-model="form.login_turnstile_enabled" /><span>{{ form.login_turnstile_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>控制登录页是否要求通过 Turnstile 验证。</small>
        </label>
        <label>
          注册启用
          <div class="switch-row"><input type="checkbox" v-model="form.register_turnstile_enabled" /><span>{{ form.register_turnstile_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>控制注册页是否要求通过 Turnstile 验证。</small>
        </label>
        <label>
          兑换启用
          <div class="switch-row"><input type="checkbox" v-model="form.redeem_turnstile_enabled" /><span>{{ form.redeem_turnstile_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>控制兑换授权码页面是否要求通过 Turnstile 验证。</small>
        </label>
        <label><span class="label-title">Site Key <em class="req">*</em></span>
          <input v-model="form.turnstile_site_key" placeholder="0x4AAAA..." :class="{ 'is-error': !!fieldError.turnstile_site_key }" @focus="clearFieldError('turnstile_site_key')" />
          <small v-if="fieldError.turnstile_site_key" class="error-text">{{ fieldError.turnstile_site_key }}</small>
          <small>前端渲染 Turnstile 小组件所需公钥。</small>
        </label>
        <label><span class="label-title">Secret Key <em class="req">*</em></span>
          <input v-model="form.turnstile_secret_key" type="password" placeholder="0x4AAAA..." :class="{ 'is-error': !!fieldError.turnstile_secret_key }" @focus="clearFieldError('turnstile_secret_key')" />
          <small v-if="fieldError.turnstile_secret_key" class="error-text">{{ fieldError.turnstile_secret_key }}</small>
          <small>后端校验 Turnstile token 所需私钥，请妥善保管。</small>
        </label>
      </div>
    </section>

    <div class="foot-actions">
      <p class="msg" :class="{ ok: msgType === 'ok', bad: msgType === 'bad' }">{{ msg }}</p>
      <button type="button" @click="load">重新加载</button>
      <button type="button" class="primary" @click="save">保存设置</button>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import { api } from '../lib/api';

type Settings = {
  registration_enabled: boolean;
  converter_backend_url: string;
  sub_rate_limit_per_minute: number;
  sub_cache_seconds: number;
  login_fail_limit: number;
  login_lock_minutes: number;
  register_ip_limit: number;
  register_ip_window_minutes: number;
  turnstile_enabled: boolean;
  login_turnstile_enabled: boolean;
  register_turnstile_enabled: boolean;
  redeem_turnstile_enabled: boolean;
  site_domain: string;
  turnstile_site_key: string;
  turnstile_secret_key: string;
};

const form = reactive<Settings>({
  registration_enabled: true,
  converter_backend_url: '',
  sub_rate_limit_per_minute: 60,
  sub_cache_seconds: 60,
  login_fail_limit: 5,
  login_lock_minutes: 15,
  register_ip_limit: 10,
  register_ip_window_minutes: 60,
  turnstile_enabled: false,
  login_turnstile_enabled: false,
  register_turnstile_enabled: false,
  redeem_turnstile_enabled: false,
  site_domain: '',
  turnstile_site_key: '',
  turnstile_secret_key: ''
});

const msg = ref('');
const msgType = ref<'ok' | 'bad' | ''>('');
const error = ref('');
const fieldError = reactive<Record<string, string>>({});

function assignForm(v: Partial<Settings>) {
  Object.assign(form, v);
}

async function load() {
  try {
    const data = await api<Partial<Settings>>('/api/admin/settings');
    assignForm(data);
    msg.value = '已加载最新设置';
    msgType.value = 'ok';
    error.value = '';
  } catch (e) {
    error.value = `读取设置失败：${(e as Error).message}`;
    msg.value = '已保留本地编辑值';
    msgType.value = 'bad';
  }
}

async function save() {
  try {
    if (!validateForm()) {
      msg.value = '请先修正输入项后再保存';
      msgType.value = 'bad';
      return;
    }
    const payload: Settings = {
      registration_enabled: !!form.registration_enabled,
      converter_backend_url: String(form.converter_backend_url || '').trim(),
      sub_rate_limit_per_minute: Math.max(1, Number(form.sub_rate_limit_per_minute) || 1),
      sub_cache_seconds: Math.max(1, Number(form.sub_cache_seconds) || 1),
      login_fail_limit: Math.max(1, Number(form.login_fail_limit) || 1),
      login_lock_minutes: Math.max(1, Number(form.login_lock_minutes) || 1),
      register_ip_limit: Math.max(1, Number(form.register_ip_limit) || 1),
      register_ip_window_minutes: Math.max(1, Number(form.register_ip_window_minutes) || 1),
      turnstile_enabled: !!form.turnstile_enabled,
      login_turnstile_enabled: !!form.login_turnstile_enabled,
      register_turnstile_enabled: !!form.register_turnstile_enabled,
      redeem_turnstile_enabled: !!form.redeem_turnstile_enabled,
      site_domain: String(form.site_domain || '').trim(),
      turnstile_site_key: String(form.turnstile_site_key || '').trim(),
      turnstile_secret_key: String(form.turnstile_secret_key || '').trim()
    };
    // site_domain is environment-driven and displayed as read-only.
    delete (payload as Partial<Settings>).site_domain;
    const res = await api<{ settings?: Partial<Settings>; message?: string }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (res.settings) assignForm(res.settings);
    msg.value = res.message || '保存成功';
    msgType.value = 'ok';
    error.value = '';
  } catch (e) {
    msg.value = `保存失败：${(e as Error).message}`;
    msgType.value = 'bad';
  }
}

function clearFieldError(field: string) {
  fieldError[field] = '';
}

function validatePositiveInt(v: number, min = 1, max = 100000) {
  return Number.isInteger(v) && v >= min && v <= max;
}

function validateForm() {
  Object.keys(fieldError).forEach((k) => delete fieldError[k]);
  const url = String(form.converter_backend_url || '').trim();
  if (!/^https?:\/\/.+/i.test(url)) fieldError.converter_backend_url = '请输入有效的 http/https 地址';
  if (!validatePositiveInt(Number(form.sub_cache_seconds), 1, 86400)) fieldError.sub_cache_seconds = '范围 1~86400 秒';
  if (!validatePositiveInt(Number(form.sub_rate_limit_per_minute), 1, 10000)) fieldError.sub_rate_limit_per_minute = '范围 1~10000 次/分钟';
  if (!validatePositiveInt(Number(form.login_fail_limit), 1, 1000)) fieldError.login_fail_limit = '范围 1~1000';
  if (!validatePositiveInt(Number(form.login_lock_minutes), 1, 10080)) fieldError.login_lock_minutes = '范围 1~10080 分钟';
  if (!validatePositiveInt(Number(form.register_ip_limit), 1, 1000)) fieldError.register_ip_limit = '范围 1~1000';
  if (!validatePositiveInt(Number(form.register_ip_window_minutes), 1, 10080)) fieldError.register_ip_window_minutes = '范围 1~10080 分钟';
  if (form.turnstile_enabled || form.login_turnstile_enabled || form.register_turnstile_enabled || form.redeem_turnstile_enabled) {
    if (!String(form.turnstile_site_key || '').trim()) fieldError.turnstile_site_key = '启用 Turnstile 时 Site Key 不能为空';
    if (!String(form.turnstile_secret_key || '').trim()) fieldError.turnstile_secret_key = '启用 Turnstile 时 Secret Key 不能为空';
  }
  return Object.keys(fieldError).length === 0;
}

onMounted(async () => {
  await load();
});
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
h1 { margin: 0; color: #0f172a; }
.sub { margin: 6px 0 0; color: #64748b; }
.error { color: #b91c1c; margin: 0 0 10px; }

.panel { border: 1px solid #dbe3ef; background: #fff; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.panel-head { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; }
.panel-head h2 { margin: 0; font-size: 16px; color: #0f172a; }
.panel-body { padding: 12px 14px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
.form-grid label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.label-title { font-size: 13px; color: #334155; }
.req { color: #dc2626; font-style: normal; }
.form-grid input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; min-height: 40px; box-sizing: border-box; }
.form-grid small { color: #64748b; font-size: 12px; line-height: 1.35; }
.form-grid input.is-error { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.12); }
.form-grid .error-text { color: #b91c1c; }
.form-grid input.readonly { background: #f8fafc; color: #475569; cursor: not-allowed; }
.switch-row { display: flex !important; align-items: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; min-height: 40px; box-sizing: border-box; background: #fff; }
.switch-row input { width: 16px; height: 16px; }

.foot-actions { border: 1px solid #dbe3ef; background: #fff; border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 8px; }
.msg { margin: 0 auto 0 0; font-size: 13px; color: #64748b; }
.msg.ok { color: #15803d; }
.msg.bad { color: #b91c1c; }
.foot-actions button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; padding: 8px 12px; min-height: 40px; cursor: pointer; }
.foot-actions button:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
.foot-actions .primary { border-color: #1d4ed8; background: #2563eb; color: #fff; }
.foot-actions .primary:hover { background: #1d4ed8; color: #fff; }

@media (max-width: 980px) {
  .form-grid { grid-template-columns: 1fr; }
  .foot-actions { flex-wrap: wrap; }
  .foot-actions button { flex: 1 1 auto; min-width: 96px; }
}
</style>
