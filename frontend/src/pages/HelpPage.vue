<template>
  <div class="help-shell">
    <div class="help-page">
      <aside class="sidebar" aria-label="帮助目录">
        <div v-for="group in helpNavGroups" :key="group.title" class="nav-group">
          <div class="group-title">{{ group.title }}</div>
          <button
            v-for="article in group.items"
            :key="article.id"
            type="button"
            class="nav-item"
            :class="{ active: article.id === activeArticleId }"
            @click="selectArticle(article.id)"
          >
            {{ article.title }}
          </button>
        </div>
      </aside>

      <section class="content">
        <header class="content-header">
          <button type="button" class="back-link" @click="goBack">返回</button>
        </header>

        <div ref="scrollContainer" class="article-body markdown-body" v-html="activeArticleHtml"></div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { marked } from 'marked';
import { helpArticles } from '../content/help';
import { api } from '../lib/api';
import { redirectToLogin } from '../lib/auth-navigation';

type NavGroup = {
  title: string;
  items: typeof helpArticles;
};

type Me = {
  userType?: 'admin' | 'user';
  dashboard?: string;
};

const router = useRouter();
const helpNavGroups: NavGroup[] = [
  {
    title: '使用教程',
    items: helpArticles.slice(0, 4),
  },
  {
    title: '使用案例',
    items: helpArticles.slice(4),
  },
];

const activeArticleId = ref(helpArticles[0]?.id ?? '');
const scrollContainer = ref<HTMLElement | null>(null);

const activeArticle = computed(() => {
  return helpArticles.find((article) => article.id === activeArticleId.value) ?? helpArticles[0] ?? null;
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineIcons(text: string) {
  return text.replace(
    /:icon\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, src: string) =>
      `<img class="md-inline-icon" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" />`
  );
}

function renderCallout(type: string, body: string) {
  const normalizedType = type.toLowerCase();
  const titleMap: Record<string, string> = {
    info: 'Info',
    tip: 'Tip',
    warning: 'Warning',
  };
  const title = titleMap[normalizedType] || normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
  const inner = marked.parse(renderInlineIcons(body.trim()), {
    gfm: true,
    breaks: true,
  }) as string;

  return `
    <div class="callout callout-${escapeHtml(normalizedType)}">
      <div class="callout-title">${escapeHtml(title)}</div>
      <div class="callout-body">${inner}</div>
    </div>
  `;
}

function renderHelpMarkdown(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const chunks: string[] = [];
  let buffer: string[] = [];
  let calloutType: string | null = null;

  const flushMarkdown = () => {
    const text = buffer.join('\n').trim();
    if (text) {
      chunks.push(marked.parse(renderInlineIcons(text), { gfm: true, breaks: true }) as string);
    }
    buffer = [];
  };

  for (const line of lines) {
    const openMatch = line.match(/^:::(\w+)\s*$/);
    if (openMatch && !calloutType) {
      flushMarkdown();
      calloutType = openMatch[1].toLowerCase();
      buffer = [];
      continue;
    }

    if (line.trim() === ':::' && calloutType) {
      chunks.push(renderCallout(calloutType, buffer.join('\n')));
      calloutType = null;
      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  if (calloutType) {
    buffer.unshift(`:::${calloutType}`);
  }

  flushMarkdown();

  return chunks.join('\n');
}

const activeArticleHtml = computed(() => {
  if (!activeArticle.value?.content) return '';
  return renderHelpMarkdown(activeArticle.value.content);
});

async function selectArticle(id: string) {
  activeArticleId.value = id;
  await nextTick();
  scrollContainer.value?.scrollTo({ top: 0, behavior: 'smooth' });
}

async function goBack() {
  const previousPath = window.history.state?.back;
  if (typeof previousPath === 'string' && previousPath && !previousPath.startsWith('/help')) {
    router.back();
    return;
  }

  try {
    const me = await api<Me>('/api/auth/me');
    if (me.userType === 'admin') {
      await router.push('/admin/users');
      return;
    }
    if (me.userType === 'user') {
      await router.push(me.dashboard || '/dashboard');
      return;
    }
  } catch {
    redirectToLogin();
    return;
  }

  redirectToLogin();
}

watch(
  () => activeArticleId.value,
  async () => {
    await nextTick();
    scrollContainer.value?.scrollTo({ top: 0 });
  },
  { flush: 'post' }
);
</script>

<style scoped>
.help-shell {
  min-height: 100vh;
  background: #ffffff;
  color: #1f2937;
}

.help-page {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 56px;
  max-width: 1520px;
  margin: 0 auto;
  padding: 48px 56px 56px;
}

.sidebar {
  position: sticky;
  top: 28px;
  align-self: start;
  padding-top: 4px;
}

.nav-group + .nav-group {
  margin-top: 28px;
}

.group-title {
  margin-bottom: 12px;
  color: #8b8f99;
  font-size: 15px;
  font-weight: 700;
}

.nav-item {
  display: block;
  width: 100%;
  margin: 0;
  padding: 6px 0;
  border: 0;
  background: transparent;
  color: #2f3137;
  font-size: 15px;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
}

.nav-item:hover {
  color: #4f46e5;
}

.nav-item.active {
  color: #4f46e5;
  font-weight: 600;
}

.content {
  min-width: 0;
}

.content-header {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 20px;
  margin-bottom: 14px;
  padding-top: 4px;
}

.back-link {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid #d7dbe4;
  border-radius: 10px;
  color: #4f46e5;
  background: #ffffff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.back-link:hover {
  border-color: #c7cbe0;
  background: #f8faff;
}

.article-body {
  max-width: 1060px;
  padding-right: 4px;
  overflow: auto;
  color: #2c2f36;
  font-size: 16px;
  line-height: 1.9;
}

.article-body :deep(h1),
.article-body :deep(h2),
.article-body :deep(h3),
.article-body :deep(h4) {
  margin: 1.5em 0 0.75em;
  color: #4f5bd5;
  line-height: 1.2;
  font-weight: 500;
}

.article-body :deep(h1) {
  font-size: 2.1em;
}

.article-body :deep(h1:first-child) {
  margin-top: 0;
}

.article-body :deep(h2) {
  font-size: 1.62em;
}

.article-body :deep(h3) {
  font-size: 1.28em;
}

.article-body :deep(p),
.article-body :deep(ul),
.article-body :deep(ol),
.article-body :deep(blockquote),
.article-body :deep(pre),
.article-body :deep(table) {
  margin: 0 0 1em;
}

.article-body :deep(ul),
.article-body :deep(ol) {
  padding-left: 1.5em;
}

.article-body :deep(li + li) {
  margin-top: 0.3em;
}

.article-body :deep(a) {
  color: #4f46e5;
  text-decoration: none;
}

.article-body :deep(a:hover) {
  text-decoration: underline;
}

.article-body :deep(blockquote) {
  margin-left: 0;
  padding: 0.9em 1em;
  border-left: 4px solid #d9dcff;
  background: #f7f8ff;
  color: #475569;
}

.article-body :deep(.callout) {
  margin: 1.25em 0 1.25em;
  border: 1px solid #d9dff4;
  border-left-width: 6px;
  border-radius: 10px;
  background: #f7f8ff;
  overflow: hidden;
}

.article-body :deep(.callout-title) {
  padding: 14px 18px;
  border-bottom: 1px solid #e4e8f4;
  background: #eef1ff;
  color: #3f4dbd;
  font-size: 16px;
  font-weight: 700;
}

.article-body :deep(.callout-body) {
  padding: 18px 18px 16px;
  color: #475569;
}

.article-body :deep(.callout-body > :first-child) {
  margin-top: 0;
}

.article-body :deep(.callout-body > :last-child) {
  margin-bottom: 0;
}

.article-body :deep(.callout-body ol) {
  margin-bottom: 1em;
}

.article-body :deep(.md-inline-icon) {
  display: inline-block;
  width: 1.05em;
  height: 1.05em;
  margin: 0 0.25em 0.12em 0;
  vertical-align: -0.18em;
  object-fit: contain;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.article-body :deep(.callout-info) {
  border-color: #b8e6ff;
  background: #f2fbff;
  border-left-color: #07b5d8;
}

.article-body :deep(.callout-info .callout-title) {
  background: #dff6fc;
  color: #047aa1;
  border-bottom-color: #c5eef8;
}

.article-body :deep(.callout-tip) {
  border-color: #c9eed7;
  background: #f4fbf6;
  border-left-color: #22a06b;
}

.article-body :deep(.callout-tip .callout-title) {
  background: #e5f8ec;
  color: #0f7a4b;
  border-bottom-color: #cdeed9;
}

.article-body :deep(.callout-warning) {
  border-color: #f3d5b5;
  background: #fffaf2;
  border-left-color: #e38b1d;
}

.article-body :deep(.callout-warning .callout-title) {
  background: #fff0da;
  color: #a35a00;
  border-bottom-color: #f1dbb9;
}

.article-body :deep(code) {
  padding: 0.15em 0.35em;
  border-radius: 6px;
  background: #f1f5f9;
  color: #b91c1c;
  font-size: 0.95em;
}

.article-body :deep(pre) {
  overflow: auto;
  padding: 1em 1.1em;
  border: 1px solid #e4e8f1;
  border-radius: 14px;
  background: #f8fafc;
}

.article-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
}

.article-body :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.1rem 0;
  border-radius: 16px;
  border: 1px solid #e8ebf3;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}

.article-body :deep(hr) {
  border: 0;
  border-top: 1px solid #e7ebf2;
  margin: 1.4em 0;
}

.article-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border: 1px solid #e4e8f1;
  border-radius: 12px;
}

.article-body :deep(th),
.article-body :deep(td) {
  padding: 0.72em 0.84em;
  border-bottom: 1px solid #e8ebf3;
  text-align: left;
}

@media (max-width: 1100px) {
  .help-page {
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 40px;
    padding: 36px 28px 44px;
  }
}

@media (max-width: 800px) {
  .help-page {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .sidebar {
    position: static;
  }

  .nav-group + .nav-group {
    margin-top: 18px;
  }

  .help-page {
    padding: 20px 16px 28px;
  }

  .content-header {
    justify-content: flex-end;
  }

  .back-link {
    width: 100%;
  }

  .article-body {
    font-size: 15px;
  }
}

@media (max-width: 640px) {
  .content-header h1 {
    font-size: 30px;
  }

  .group-title {
    font-size: 14px;
  }

  .nav-item {
    font-size: 14px;
  }
}
</style>
