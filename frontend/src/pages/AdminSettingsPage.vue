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
          <div class="switch-row"><input id="settings-registration-enabled" name="settingsRegistrationEnabled" type="checkbox" v-model="form.registration_enabled" /><span>{{ form.registration_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>关闭后将禁止新用户自行注册，仅管理员可手动创建用户。</small>
        </label>
        <label>站点域名（环境变量，只读）
          <input id="settings-site-domain" name="settingsSiteDomain" v-model="form.site_domain" readonly class="readonly" />
          <small>由部署环境变量与网关配置决定，此处仅展示当前生效值。</small>
        </label>
        <label><span class="label-title">订阅限流（次/分钟） <em class="req">*</em></span>
          <input id="settings-sub-rate-limit" name="settingsSubRateLimit" v-model.number="form.sub_rate_limit_per_minute" type="number" min="1" :class="{ 'is-error': !!fieldError.sub_rate_limit_per_minute }" @focus="clearFieldError('sub_rate_limit_per_minute')" />
          <small v-if="fieldError.sub_rate_limit_per_minute" class="error-text">{{ fieldError.sub_rate_limit_per_minute }}</small>
          <small>限制单用户/单 token 的订阅接口访问频率，避免高频刷新。</small>
        </label>
      </div>
      <div class="panel-note">
        Turnstile 的 Site Key / Secret Key 现在只从环境变量读取，后台不再提供修改入口。修改后需要重启容器生效。
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>订阅转换与分流规则</h2></div>
      <div class="panel-body form-grid">
        <label><span class="label-title">转换后端默认地址</span>
          <input id="settings-default-converter-backend-url" name="settingsDefaultConverterBackendUrl" :value="defaultConverterBackendUrl" readonly class="readonly" />
          <small>系统默认使用本地 subconverter 地址；通常无需修改。</small>
        </label>
        <label>
          使用自定义转换后端
          <div class="switch-row">
            <input
              id="settings-use-custom-converter"
              name="settingsUseCustomConverter"
              type="checkbox"
              :checked="form.use_custom_converter_backend_url"
              @change="setCustomConverterBackendEnabled(($event.target as HTMLInputElement).checked)"
            />
            <span>{{ form.use_custom_converter_backend_url ? '已启用自定义覆盖' : '使用默认地址' }}</span>
          </div>
          <small>开启后可覆盖默认地址；关闭后自动回退为系统默认值。</small>
        </label>
        <label v-if="form.use_custom_converter_backend_url"><span class="label-title">自定义转换后端地址 <em class="req">*</em></span>
          <input id="settings-converter-backend-url" name="settingsConverterBackendUrl" v-model="form.converter_backend_url" placeholder="http://subconverter:25500/sub" :class="{ 'is-error': !!fieldError.converter_backend_url }" @focus="clearFieldError('converter_backend_url')" />
          <small v-if="fieldError.converter_backend_url" class="error-text">{{ fieldError.converter_backend_url }}</small>
          <small>系统会把已识别并合并的上游节点交给该地址对应的 subconverter 处理。</small>
        </label>
        <label><span class="label-title">默认客户端 <em class="req">*</em></span>
          <select id="settings-converter-default-target" name="settingsConverterDefaultTarget" v-model="form.converter_default_target" :class="{ 'is-error': !!fieldError.converter_default_target }" @focus="clearFieldError('converter_default_target')">
            <option v-for="option in targetOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <small v-if="fieldError.converter_default_target" class="error-text">{{ fieldError.converter_default_target }}</small>
          <small>用户未指定 target 时使用的客户端类型。</small>
        </label>
        <label><span class="label-title">默认分流规则 <em class="req">*</em></span>
          <input id="settings-converter-default-config-url" name="settingsConverterDefaultConfigUrl" v-model="form.converter_default_config_url" placeholder="https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini" :class="{ 'is-error': !!fieldError.converter_default_config_url }" @focus="clearFieldError('converter_default_config_url')" />
          <small v-if="fieldError.converter_default_config_url" class="error-text">{{ fieldError.converter_default_config_url }}</small>
          <small>会通过 subconverter 的 config 参数传入，用于生成 Clash 策略组和规则。</small>
        </label>
        <label><span class="label-title">订阅文件名模板 <em class="req">*</em></span>
          <input id="settings-subscription-filename-template" name="settingsSubscriptionFilenameTemplate" v-model="form.subscription_filename_template" placeholder="{{username}}_V{{version}}" :class="{ 'is-error': !!fieldError.subscription_filename_template }" @focus="clearFieldError('subscription_filename_template')" />
          <small v-if="fieldError.subscription_filename_template" class="error-text">{{ fieldError.subscription_filename_template }}</small>
          <small>可用占位符：<code v-pre>{{username}}</code>、<code v-pre>{{target}}</code>、<code v-pre>{{expire}}</code>、<code v-pre>{{version}}</code>。例如 <code v-pre>{{username}}_V{{version}}</code>。</small>
        </label>
        <label><span class="label-title">自动轮询间隔（分钟） <em class="req">*</em></span>
          <input id="settings-upstream-poll-interval" name="settingsUpstreamPollInterval" v-model.number="form.upstream_poll_interval_minutes" type="number" min="0" :class="{ 'is-error': !!fieldError.upstream_poll_interval_minutes }" @focus="clearFieldError('upstream_poll_interval_minutes')" />
          <small v-if="fieldError.upstream_poll_interval_minutes" class="error-text">{{ fieldError.upstream_poll_interval_minutes }}</small>
          <small>0 表示关闭自动轮询；大于 0 时，后台会按该间隔自动执行一次“全部测试”。</small>
        </label>
      </div>
      <div class="panel-note">
        系统会先由后端拉取、识别、解码并合并上游订阅，再交给本地 subconverter 转换为客户端配置。上游抓取的 User-Agent 会根据每条上游的类型自动选择；默认分流规则会通过 subconverter 的 config 参数传入，用于生成 Clash 等客户端的策略组和规则。文件名模板会用于 subconverter 的 <code>filename</code> 参数，并尽量保留你设置的命名风格。
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>上游拉取代理</h2></div>
      <div class="panel-body form-grid">
        <label><span class="label-title">上游拉取代理地址</span>
          <input
            id="settings-upstream-fetch-proxy-url"
            name="settingsUpstreamFetchProxyUrl"
            v-model="form.upstream_fetch_proxy_url"
            placeholder="http://100.69.223.58:17890"
            :class="{ 'is-error': !!fieldError.upstream_fetch_proxy_url }"
            @focus="clearFieldError('upstream_fetch_proxy_url')"
          />
          <small v-if="fieldError.upstream_fetch_proxy_url" class="error-text">{{ fieldError.upstream_fetch_proxy_url }}</small>
          <small>仅用于服务端拉取上游订阅。不会影响用户订阅分发、subconverter、MongoDB、Redis 或 Caddy。</small>
        </label>
        <label class="proxy-test-panel">
          <span class="label-title">代理连通性测试</span>
          <div class="proxy-test-row">
            <input
              id="settings-proxy-test-url"
              name="settingsProxyTestUrl"
              v-model="proxyTestUrl"
              placeholder="https://api.ipify.org"
              :class="{ 'is-error': !!fieldError.proxy_test_url }"
              @focus="clearFieldError('proxy_test_url')"
            />
            <button type="button" class="proxy-test-btn" :disabled="proxyTestRunning" @click="testUpstreamProxy">
              {{ proxyTestRunning ? '测试中...' : '测试代理连通性' }}
            </button>
          </div>
          <small v-if="fieldError.proxy_test_url" class="error-text">{{ fieldError.proxy_test_url }}</small>
          <small v-if="proxyTestSummary" class="proxy-test-summary" :class="proxyTestKind">{{ proxyTestSummary }}</small>
          <small v-if="proxyTestDetail" class="proxy-test-detail" :class="proxyTestKind">{{ proxyTestDetail }}</small>
          <small v-if="!proxyTestSummary && !proxyTestDetail" class="proxy-test-hint">读取上方代理地址后，测试服务端是否能经由该代理访问外网。</small>
        </label>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>安全策略</h2></div>
      <div class="panel-body form-grid">
        <label><span class="label-title">登录失败阈值 <em class="req">*</em></span>
          <input id="settings-login-fail-limit" name="settingsLoginFailLimit" v-model.number="form.login_fail_limit" type="number" min="1" :class="{ 'is-error': !!fieldError.login_fail_limit }" @focus="clearFieldError('login_fail_limit')" />
          <small v-if="fieldError.login_fail_limit" class="error-text">{{ fieldError.login_fail_limit }}</small>
          <small>单账号在窗口期内允许的最大失败次数，超过后触发锁定。</small>
        </label>
        <label><span class="label-title">登录锁定时长（分钟） <em class="req">*</em></span>
          <input id="settings-login-lock-minutes" name="settingsLoginLockMinutes" v-model.number="form.login_lock_minutes" type="number" min="1" :class="{ 'is-error': !!fieldError.login_lock_minutes }" @focus="clearFieldError('login_lock_minutes')" />
          <small v-if="fieldError.login_lock_minutes" class="error-text">{{ fieldError.login_lock_minutes }}</small>
          <small>触发登录保护后，账号在此时长内禁止继续尝试登录。</small>
        </label>
        <label><span class="label-title">注册 IP 限制次数 <em class="req">*</em></span>
          <input id="settings-register-ip-limit" name="settingsRegisterIpLimit" v-model.number="form.register_ip_limit" type="number" min="1" :class="{ 'is-error': !!fieldError.register_ip_limit }" @focus="clearFieldError('register_ip_limit')" />
          <small v-if="fieldError.register_ip_limit" class="error-text">{{ fieldError.register_ip_limit }}</small>
          <small>同一 IP 在统计窗口内允许的最大注册次数。</small>
        </label>
        <label><span class="label-title">注册 IP 窗口（分钟） <em class="req">*</em></span>
          <input id="settings-register-ip-window-minutes" name="settingsRegisterIpWindowMinutes" v-model.number="form.register_ip_window_minutes" type="number" min="1" :class="{ 'is-error': !!fieldError.register_ip_window_minutes }" @focus="clearFieldError('register_ip_window_minutes')" />
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
          <div class="switch-row"><input id="settings-turnstile-enabled" name="settingsTurnstileEnabled" type="checkbox" v-model="form.turnstile_enabled" /><span>{{ form.turnstile_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>总开关关闭时，登录/注册的子开关将不生效。</small>
        </label>
        <label>
          登录启用
          <div class="switch-row"><input id="settings-login-turnstile-enabled" name="settingsLoginTurnstileEnabled" type="checkbox" v-model="form.login_turnstile_enabled" /><span>{{ form.login_turnstile_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>控制登录页是否要求通过 Turnstile 验证。</small>
        </label>
        <label>
          注册启用
          <div class="switch-row"><input id="settings-register-turnstile-enabled" name="settingsRegisterTurnstileEnabled" type="checkbox" v-model="form.register_turnstile_enabled" /><span>{{ form.register_turnstile_enabled ? '已开启' : '已关闭' }}</span></div>
          <small>控制注册页是否要求通过 Turnstile 验证。</small>
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
import { API_BASE, api } from '../lib/api';

type Settings = {
  registration_enabled: boolean;
  converter_backend_url: string;
  converter_default_target: string;
  converter_default_config_url: string;
  subscription_filename_template: string;
  upstream_poll_interval_minutes: number;
  upstream_fetch_proxy_url: string;
  sub_rate_limit_per_minute: number;
  login_fail_limit: number;
  login_lock_minutes: number;
  register_ip_limit: number;
  register_ip_window_minutes: number;
  turnstile_enabled: boolean;
  login_turnstile_enabled: boolean;
  register_turnstile_enabled: boolean;
  site_domain: string;
};

const defaultConverterBackendUrl = 'http://subconverter:25500/sub';
const defaultUpstreamFetchProxyUrl = 'http://100.69.223.58:17890';

const form = reactive<Settings & {
  use_custom_converter_backend_url: boolean;
}>({
  registration_enabled: true,
  converter_backend_url: defaultConverterBackendUrl,
  converter_default_target: 'clash',
  converter_default_config_url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini',
  subscription_filename_template: '{{username}}_V{{version}}',
  upstream_poll_interval_minutes: 60,
  upstream_fetch_proxy_url: defaultUpstreamFetchProxyUrl,
  sub_rate_limit_per_minute: 60,
  login_fail_limit: 5,
  login_lock_minutes: 15,
  register_ip_limit: 10,
  register_ip_window_minutes: 60,
  turnstile_enabled: false,
  login_turnstile_enabled: false,
  register_turnstile_enabled: false,
  site_domain: '',
  use_custom_converter_backend_url: false
});

const targetOptions = [
  { value: 'clash', label: 'Clash' },
  { value: 'mihomo', label: 'Mihomo' },
  { value: 'sing-box', label: 'sing-box' },
  { value: 'v2ray', label: 'V2Ray' },
  { value: 'shadowrocket', label: 'Shadowrocket' }
];

const msg = ref('');
const msgType = ref<'ok' | 'bad' | ''>('');
const error = ref('');
const fieldError = reactive<Record<string, string>>({});
const proxyTestRunning = ref(false);
const proxyTestSummary = ref('');
const proxyTestDetail = ref('');
const proxyTestKind = ref<'ok' | 'bad' | ''>('');
const proxyTestUrl = ref('https://api.ipify.org');

function assignForm(v: Partial<Settings>) {
  Object.assign(form, v);
  const backendUrl = String(v.converter_backend_url || defaultConverterBackendUrl).trim();
  form.use_custom_converter_backend_url = backendUrl !== defaultConverterBackendUrl;
  form.converter_backend_url = form.use_custom_converter_backend_url ? backendUrl : defaultConverterBackendUrl;
  form.upstream_fetch_proxy_url = String(v.upstream_fetch_proxy_url || defaultUpstreamFetchProxyUrl).trim();
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
      converter_backend_url: form.use_custom_converter_backend_url
        ? String(form.converter_backend_url || '').trim() || defaultConverterBackendUrl
        : defaultConverterBackendUrl,
      converter_default_target: String(form.converter_default_target || '').trim(),
      converter_default_config_url: String(form.converter_default_config_url || '').trim(),
      subscription_filename_template: String(form.subscription_filename_template || '').trim() || '{{username}}_V{{version}}',
      upstream_poll_interval_minutes: Math.max(0, Number(form.upstream_poll_interval_minutes) || 0),
      upstream_fetch_proxy_url: String(form.upstream_fetch_proxy_url || defaultUpstreamFetchProxyUrl).trim(),
      sub_rate_limit_per_minute: Math.max(1, Number(form.sub_rate_limit_per_minute) || 1),
      login_fail_limit: Math.max(1, Number(form.login_fail_limit) || 1),
      login_lock_minutes: Math.max(1, Number(form.login_lock_minutes) || 1),
      register_ip_limit: Math.max(1, Number(form.register_ip_limit) || 1),
      register_ip_window_minutes: Math.max(1, Number(form.register_ip_window_minutes) || 1),
      turnstile_enabled: !!form.turnstile_enabled,
      login_turnstile_enabled: !!form.login_turnstile_enabled,
      register_turnstile_enabled: !!form.register_turnstile_enabled,
      site_domain: String(form.site_domain || '').trim()
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

async function testUpstreamProxy() {
  const proxyUrl = String(form.upstream_fetch_proxy_url || '').trim();
  if (!proxyUrl) {
    fieldError.upstream_fetch_proxy_url = '请先填写上游拉取代理地址';
    proxyTestSummary.value = '请先填写上游拉取代理地址';
    proxyTestDetail.value = '';
    proxyTestKind.value = 'bad';
    return;
  }
  const testUrl = String(proxyTestUrl.value || '').trim() || 'https://api.ipify.org';
  if (!/^https?:\/\/.+/i.test(testUrl)) {
    fieldError.proxy_test_url = '请输入有效的 http/https 地址';
    proxyTestSummary.value = '请输入有效的测试地址';
    proxyTestDetail.value = '';
    proxyTestKind.value = 'bad';
    return;
  }
  proxyTestRunning.value = true;
  proxyTestSummary.value = '测试中...';
  proxyTestDetail.value = '';
  proxyTestKind.value = '';
  try {
    const resp = await fetch(`${API_BASE}/api/admin/settings/test-upstream-proxy`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proxyUrl,
        testUrl,
        timeoutMs: 10000
      })
    });
    const res = await resp.json().catch(() => ({}));
    proxyTestSummary.value = res.ok
      ? `代理连通正常 · HTTP 状态：${res.httpStatus || 200} · 耗时：${res.elapsedMs || 0} ms`
      : `代理连通失败：${res.message || `HTTP ${resp.status}`}`;
    proxyTestDetail.value = res.ok
      ? `出口 IP：${res.exitIp || '-'}${res.exitIpLocation ? ` ${res.exitIpLocation}` : ''}`
      : '';
    proxyTestKind.value = res.ok ? 'ok' : 'bad';
  } catch (e) {
    proxyTestSummary.value = `代理连通失败：${(e as Error).message}`;
    proxyTestDetail.value = '';
    proxyTestKind.value = 'bad';
  } finally {
    proxyTestRunning.value = false;
  }
}

function setCustomConverterBackendEnabled(enabled: boolean) {
  form.use_custom_converter_backend_url = enabled;
  if (!enabled) {
    form.converter_backend_url = defaultConverterBackendUrl;
    clearFieldError('converter_backend_url');
  }
}

function validatePositiveInt(v: number, min = 1, max = 100000) {
  return Number.isInteger(v) && v >= min && v <= max;
}

function validateForm() {
  Object.keys(fieldError).forEach((k) => delete fieldError[k]);
  if (form.use_custom_converter_backend_url) {
    const url = String(form.converter_backend_url || '').trim();
    if (!/^https?:\/\/.+/i.test(url)) fieldError.converter_backend_url = '请输入有效的 http/https 地址';
  }
  if (!String(form.converter_default_target || '').trim()) fieldError.converter_default_target = '请输入默认客户端';
  const defaultConfigUrl = String(form.converter_default_config_url || '').trim();
  if (defaultConfigUrl && !/^https?:\/\/.+/i.test(defaultConfigUrl)) fieldError.converter_default_config_url = '请输入有效的 http/https 地址';
  if (!String(form.subscription_filename_template || '').trim()) fieldError.subscription_filename_template = '请输入文件名模板';
  const proxyUrl = String(form.upstream_fetch_proxy_url || '').trim();
  if (proxyUrl && !/^(https?:\/\/|socks5h?:\/\/).+/i.test(proxyUrl)) fieldError.upstream_fetch_proxy_url = '请输入有效的代理地址';
  const testUrl = String(proxyTestUrl.value || '').trim();
  if (testUrl && !/^https?:\/\/.+/i.test(testUrl)) fieldError.proxy_test_url = '请输入有效的 http/https 地址';
  if (!validatePositiveInt(Number(form.upstream_poll_interval_minutes), 0, 10080)) fieldError.upstream_poll_interval_minutes = '范围 0~10080 分钟';
  if (!validatePositiveInt(Number(form.sub_rate_limit_per_minute), 1, 10000)) fieldError.sub_rate_limit_per_minute = '范围 1~10000 次/分钟';
  if (!validatePositiveInt(Number(form.login_fail_limit), 1, 1000)) fieldError.login_fail_limit = '范围 1~1000';
  if (!validatePositiveInt(Number(form.login_lock_minutes), 1, 10080)) fieldError.login_lock_minutes = '范围 1~10080 分钟';
  if (!validatePositiveInt(Number(form.register_ip_limit), 1, 1000)) fieldError.register_ip_limit = '范围 1~1000';
  if (!validatePositiveInt(Number(form.register_ip_window_minutes), 1, 10080)) fieldError.register_ip_window_minutes = '范围 1~10080 分钟';
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
.panel-note { padding: 0 14px 14px; color: #64748b; font-size: 12px; line-height: 1.6; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
.form-grid label { display: grid; gap: 6px; font-size: 13px; color: #334155; }
.label-title { font-size: 13px; color: #334155; }
.req { color: #dc2626; font-style: normal; }
.form-grid input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; min-height: 40px; box-sizing: border-box; }
.form-grid select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; min-height: 40px; box-sizing: border-box; background: #fff; }
.form-grid small { color: #64748b; font-size: 12px; line-height: 1.35; }
.form-grid input.is-error { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.12); }
.form-grid select.is-error { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.12); }
.form-grid .error-text { color: #b91c1c; }
.form-grid input.readonly { background: #f8fafc; color: #475569; cursor: not-allowed; }
.switch-row {
  display: flex !important;
  align-items: center;
  gap: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
  height: 40px;
  box-sizing: border-box;
  background: #fff;
  line-height: 1;
}
.switch-row input { width: 16px; height: 16px; margin: 0; }
.switch-row span { line-height: 1; }
.proxy-test-panel { align-content: start; }
.proxy-test-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.proxy-test-row input { min-width: 0; }
.proxy-test-btn {
  border: 1px solid #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 8px;
  padding: 0 12px;
  min-height: 40px;
  font-weight: 600;
  cursor: pointer;
}
.proxy-test-btn:hover { border-color: #60a5fa; background: #dbeafe; }
.proxy-test-btn:disabled { opacity: 0.65; cursor: wait; }
.proxy-test-btn:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}
.proxy-test-detail.ok { color: #15803d; }
.proxy-test-detail.bad { color: #b91c1c; }
.proxy-test-summary { color: #0f172a; }
.proxy-test-summary.ok { color: #15803d; }
.proxy-test-summary.bad { color: #b91c1c; }
.proxy-test-hint { color: #64748b; }

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
  .proxy-test-row { grid-template-columns: 1fr; }
  .proxy-test-btn { width: 100%; }
}
</style>
