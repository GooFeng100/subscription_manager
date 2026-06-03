<template>
  <UserMobileLayout title="使用帮助" subtitle="常见步骤与问题说明">
    <section class="block">
      <h3>快速开始</h3>
      <ol>
        <li>先注册并登录账号。</li>
        <li>在“兑换授权码”完成激活。</li>
        <li>在“我的订阅”复制订阅链接。</li>
        <li>按客户端类型选择 target 后导入。</li>
      </ol>
    </section>
    <section class="block">
      <h3>状态说明</h3>
      <ul>
        <li><strong>active</strong>：可正常访问订阅。</li>
        <li><strong>grace</strong>：宽限期内，可继续使用。</li>
        <li><strong>expired / inactive</strong>：需要兑换授权码。</li>
      </ul>
    </section>
    <section class="block">
      <h3>注意事项</h3>
      <p>订阅接口存在缓存与限流，短时间频繁刷新可能触发限制。</p>
    </section>
  </UserMobileLayout>
</template>

<script setup lang="ts">
import UserMobileLayout from "../components/user/UserMobileLayout.vue";
</script>

<style scoped>
.block {
  border: 1px solid #d8e0f0;
  border-radius: 10px;
  background: #fafcff;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.block h3 {
  margin: 0 0 8px;
  color: #1e3d78;
  font-size: 15px;
}

.block ol,
.block ul {
  margin: 0;
  padding-left: 18px;
  color: #384c70;
  font-size: 13px;
  line-height: 1.6;
}

.block p {
  margin: 0;
  color: #4a5f85;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .block h3 {
    font-size: 16px;
  }

  .block ol,
  .block ul,
  .block p {
    font-size: 14px;
  }
}
</style>
