<script setup>
/**
 * 文件预览模态（任务 2 · GET /api/vault/{id}/preview 内嵌流）
 *
 * mime 分派：
 *   text/markdown · text/plain · text/csv → 文本预览（md 走 renderMarkdown 轻渲染器；
 *                                            csv/plain 等宽纯文本）
 *   application/pdf                        → <iframe :src="objectUrl">
 *   image/*                                → <img :src="objectUrl">
 *   docx / 音视频 / 其他                    → 降级卡片「该类型暂不支持内嵌预览」+ 下载
 *
 * 数据链路：axios responseType:'blob'（走 request 封装带鉴权）→ MIME/文件名解析 →
 * URL.createObjectURL；关闭时 revoke 防内存泄漏。
 * 交互：ESC / 点遮罩 / 关闭键退出；max-width 720px，max-height 85vh 内容区滚动。
 * 走查口径：digest_status 非 confirmed/extracted（pending/skipped/failed）时预览照常
 * 可用——保管完整就可看（设计稿 §3.3b「未确认：可下载预览」）；仅 deleted 不可。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import request from '@/api/request'
import { renderMarkdown } from '@/utils/mdPreview'

const props = defineProps({
  /** vault 条目（snake_case；对话文件卡传 camelCase 时兼容取值） */
  item: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const loading = ref(false)
const error = ref('')
const mime = ref('')
const filename = ref('')
const objectUrl = ref('')
const textContent = ref('')

/** 展示名（显示名优先，回退接口 Content-Disposition 文件名） */
const displayName = computed(() =>
  props.item?.display_name || props.item?.displayName || filename.value || '未命名文件')

/** mime 分派（扩展名兜底：后端 Content-Type 可能给 application/octet-stream） */
const kind = computed(() => {
  const m = (mime.value || '').toLowerCase()
  const ext = String(props.item?.file_type || props.item?.fileType || displayName.value)
    .split('.').pop().toLowerCase()
  if (m === 'text/markdown' || m === 'text/x-markdown' || ext === 'md') return 'markdown'
  if (m.startsWith('text/') || ['txt', 'csv', 'log', 'json'].includes(ext)) {
    return ext === 'csv' || m === 'text/csv' ? 'csv' : 'text'
  }
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  return 'unsupported'
})

const isText = computed(() => kind.value === 'markdown' || kind.value === 'text' || kind.value === 'csv')
const mimeBadge = computed(() => {
  if (kind.value === 'markdown') return 'MD'
  if (kind.value === 'csv') return 'CSV'
  if (kind.value === 'text') return 'TXT'
  if (kind.value === 'pdf') return 'PDF'
  if (kind.value === 'image') return 'IMG'
  return 'FILE'
})

/** md 渲染（renderMarkdown 内部先 HTML escape 全部原文再套标签——XSS 防线） */
const mdHtml = computed(() => (kind.value === 'markdown' ? renderMarkdown(textContent.value) : ''))

/** 降级卡文案（docx/音视频/其他） */
const unsupportedTip = computed(() => {
  if (kind.value === 'image') return ''
  const m = (mime.value || '').toLowerCase()
  if (m.includes('word') || m.includes('officedocument') || displayName.value.toLowerCase().endsWith('.docx')) {
    return 'docx 暂不支持内嵌预览 · 可下载原文件查看'
  }
  if (m.startsWith('audio/') || ['mp3', 'wav', 'm4a'].includes(String(props.item?.file_type || '').toLowerCase())) {
    return '音频暂不支持内嵌预览 · 可下载原文件播放'
  }
  return '该类型暂不支持内嵌预览 · 可下载原文件'
})

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  load()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  revoke()
})

function revoke() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    // 注意：request.js 响应拦截器 return res（=response.data）——responseType:'blob' 时
    // 返回值就是 Blob 本身（headers 不经手）。真 headers/文件名需另走原生 axios 或按
    // blob.type 推断；此处 mime 用 blob.type，文件名用前端已知字段兜底。
    const blob = await request.get(`/vault/${props.item.id}/preview`, { responseType: 'blob', timeout: 60000 })
    const realBlob = blob instanceof Blob ? blob : new Blob([blob])
    mime.value = String(realBlob.type || 'application/octet-stream').split(';')[0].trim()
    filename.value = props.item.original_name || props.item.originalName || props.item.display_name || `preview-${props.item.id}`
    if (isTextLike(mime.value)) {
      textContent.value = await realBlob.text()
    } else {
      revoke()
      objectUrl.value = URL.createObjectURL(realBlob)
    }
  } catch (err) {
    console.error('Preview load failed:', err)
    error.value = err?.message || '预览加载失败'
  } finally {
    loading.value = false
  }
}

/** Content-Disposition 文件名解析（filename*=UTF-8'' 优先，降级 filename=）
 *  注：拦截器 return response.data 后 axios headers 不经手，此函数留作
 *  fetchPreviewBlob（api/vault.js）与后续直连 axios 场景共用。 */
function parseDisposition(disposition) {
  const utf8 = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i)
  if (utf8) {
    try { return decodeURIComponent(utf8[1].replace(/["']/g, '').trim()) } catch { return utf8[1] }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  return plain ? plain[1].trim() : `preview-${props.item.id}`
}

/** 文本族判定（load 时用；kind 依赖 mime 已就绪前的粗判） */
function isTextLike(m) {
  const mimeStr = String(m || '').toLowerCase()
  if (mimeStr.startsWith('text/')) return true
  const ext = String(props.item?.file_type || props.item?.fileType || displayName.value)
    .split('.').pop().toLowerCase()
  return ['md', 'txt', 'csv', 'log', 'json'].includes(ext)
}

/** 下载原文件（GET /api/vault/{id}/download blob 触发保存） */
const downloading = ref(false)

async function download() {
  if (downloading.value) return
  downloading.value = true
  try {
    // 拦截器 return response.data —— responseType:'blob' 时直接就是 Blob
    const blob = await request.get(`/vault/${props.item.id}/download`, { responseType: 'blob', timeout: 60000 })
    const realBlob = blob instanceof Blob ? blob : new Blob([blob])
    saveBlob(realBlob, props.item.original_name || props.item.originalName || props.item.display_name || `file-${props.item.id}`)
  } catch (err) {
    console.error('Download failed:', err)
    error.value = err?.message || '下载失败'
  } finally {
    downloading.value = false
  }
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
</script>

<template>
  <Teleport to="body">
    <div class="fpm-mask" @click.self="emit('close')">
      <div class="fpm-card" role="dialog" aria-modal="true" :aria-label="displayName">
        <!-- 顶部：文件名 + mime 徽标 + 关闭 -->
        <div class="fpm-head">
          <span class="fpm-badge">{{ mimeBadge }}</span>
          <div class="fpm-title" :title="displayName">{{ displayName }}</div>
          <button class="fpm-close" aria-label="关闭预览" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 内容区（85vh 限高滚动） -->
        <div class="fpm-body">
          <div v-if="loading" class="fpm-state"><span class="spinner" /> 加载预览…</div>

          <div v-else-if="error" class="fpm-state fpm-state-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
            {{ error }}
          </div>

          <!-- md 渲染 -->
          <div v-else-if="kind === 'markdown'" class="fpm-md" v-html="mdHtml" />

          <!-- csv / plain 等宽文本 -->
          <pre v-else-if="kind === 'csv' || kind === 'text'" class="fpm-text">{{ textContent }}</pre>

          <!-- pdf iframe -->
          <iframe
            v-else-if="kind === 'pdf' && objectUrl"
            :src="objectUrl"
            class="fpm-pdf"
            title="PDF 预览"
          />

          <!-- image -->
          <div v-else-if="kind === 'image' && objectUrl" class="fpm-img-wrap">
            <img :src="objectUrl" :alt="displayName" class="fpm-img">
          </div>

          <!-- 降级卡（docx/音视频/其他） -->
          <div v-else-if="kind === 'unsupported'" class="fpm-fallback">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/></svg>
            <div class="fpm-fallback-tip">{{ unsupportedTip }}</div>
          </div>
        </div>

        <!-- 底部：下载原文件 -->
        <div class="fpm-foot">
          <button class="fpm-dl" :disabled="downloading" @click="download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
            {{ downloading ? '下载中…' : '下载原文件' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fpm-mask {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(26, 26, 23, .4);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: fpmIn .18s ease;
}
@keyframes fpmIn { from { opacity: 0; } to { opacity: 1; } }

.fpm-card {
  width: 100%; max-width: 720px;
  max-height: 85vh;
  background: #FFFFFF;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: fpmCardIn .2s ease;
}
@keyframes fpmCardIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }

.fpm-head {
  display: flex; align-items: center; gap: 9px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.fpm-badge {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .1em;
  color: var(--accent); background: var(--accent-soft);
  padding: 2px 7px; border-radius: var(--radius-full); flex-shrink: 0;
}
.fpm-title {
  flex: 1; min-width: 0;
  font-size: 13.5px; font-weight: 600; color: var(--text-hi);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fpm-close {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center;
  color: var(--text-low); transition: color .15s, background .15s;
}
.fpm-close:hover { color: var(--text-hi); background: var(--ink-2); }
.fpm-close svg { width: 14px; height: 14px; }

.fpm-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 14px 16px;
  -webkit-overflow-scrolling: touch;
}

.fpm-state {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 40px 12px;
  font-size: 12.5px; color: var(--text-low);
}
.fpm-state-error { color: var(--danger); }
.fpm-state-error svg { width: 15px; height: 15px; flex-shrink: 0; }

/* md 渲染样式（晨纸排版；全部晨纸 token，无深色） */
.fpm-md { font-size: 13.5px; line-height: 1.8; color: var(--text-hi); overflow-wrap: anywhere; }
.fpm-md :deep(h1) { font-family: var(--font-display); font-size: 20px; font-weight: 600; margin: 14px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
.fpm-md :deep(h2) { font-family: var(--font-display); font-size: 17px; font-weight: 600; margin: 14px 0 7px; }
.fpm-md :deep(h3) { font-size: 15px; font-weight: 600; margin: 12px 0 6px; }
.fpm-md :deep(h4), .fpm-md :deep(h5), .fpm-md :deep(h6) { font-size: 13.5px; font-weight: 600; margin: 10px 0 5px; color: var(--text-mid); }
.fpm-md :deep(h1:first-child), .fpm-md :deep(h2:first-child), .fpm-md :deep(h3:first-child) { margin-top: 0; }
.fpm-md :deep(p) { margin: 7px 0; }
.fpm-md :deep(strong) { font-weight: 600; }
.fpm-md :deep(a) { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
.fpm-md :deep(ul), .fpm-md :deep(ol) { margin: 7px 0; padding-left: 22px; }
.fpm-md :deep(li) { margin: 3px 0; }
.fpm-md :deep(blockquote) {
  margin: 9px 0; padding: 7px 12px;
  border-left: 2px solid var(--accent);
  background: var(--ink-2); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-mid);
}
.fpm-md :deep(code) {
  font-family: var(--font-mono); font-size: 12px;
  background: var(--ink-2); border: 1px solid var(--line);
  padding: 1px 5px; border-radius: 4px;
}
.fpm-md :deep(pre) {
  margin: 9px 0; padding: 10px 12px;
  background: var(--ink-2); border: 1px solid var(--line);
  border-radius: var(--radius-sm); overflow-x: auto;
}
.fpm-md :deep(pre code) { background: none; border: none; padding: 0; font-size: 11.5px; line-height: 1.7; }
.fpm-md :deep(hr) { border: none; border-top: 1px solid var(--line); margin: 13px 0; }

/* csv / plain 等宽文本 */
.fpm-text {
  margin: 0;
  font-family: var(--font-mono); font-size: 11.5px; line-height: 1.75;
  color: var(--text-mid);
  white-space: pre-wrap; word-break: break-word;
}

/* pdf / image */
.fpm-pdf { width: 100%; height: calc(85vh - 130px); min-height: 320px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--ink-2); }
.fpm-img-wrap { display: flex; justify-content: center; }
.fpm-img { max-width: 100%; max-height: calc(85vh - 160px); border-radius: var(--radius-sm); border: 1px solid var(--line); }

/* 降级卡 */
.fpm-fallback {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 42px 16px;
  border: 1px dashed var(--line-strong); border-radius: var(--radius-sm);
  background: var(--ink-2);
}
.fpm-fallback svg { width: 26px; height: 26px; color: var(--text-low); }
.fpm-fallback-tip { font-size: 12.5px; color: var(--text-mid); text-align: center; line-height: 1.7; }

.fpm-foot {
  display: flex; justify-content: flex-end;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}
.fpm-dl {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--accent);
  padding: 5px 14px; border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--accent);
  background: #FFFFFF; transition: background .15s;
}
.fpm-dl:hover:not(:disabled) { background: var(--accent-soft); }
.fpm-dl:disabled { opacity: .5; cursor: not-allowed; }
.fpm-dl svg { width: 13px; height: 13px; }

@media (max-width: 480px) {
  .fpm-mask { padding: 0; align-items: flex-end; }
  .fpm-card { max-width: 100%; max-height: 88dvh; border-radius: 16px 16px 0 0; border-bottom: none; }
  .fpm-body { padding: 12px 14px; }
}
</style>
