<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, nextTick, watch, defineAsyncComponent } from 'vue'
import request from '@/api/request'
import { renderMarkdown } from '@/utils/mdPreview'
import { previewType, parseCsv, docxHtml } from '@/utils/filePreview'
import { useOverlayMotion } from '@/motion/useOverlayMotion'
import { useDialogFocus } from '@/composables/useDialogFocus'

const PdfDocumentPreview = defineAsyncComponent(() => import('@/components/molecules/PdfDocumentPreview.vue'))
const props = defineProps({ item: { type: Object, required: true }, origin: { type: Object, default: null } })
const emit = defineEmits(['close'])
const loading = ref(true), error = ref(''), downloadError = ref(''), downloading = ref(false)
const mime = ref(''), objectUrl = ref(''), textContent = ref(''), documentHtml = ref('')
const rawBlob = shallowRef(null), truncated = ref(false), imageZoom = ref(1)
const audioPlaying = ref(false)
const dialogEl = ref(null), maskEl = ref(null), active = ref(false), closing = ref(false)
const overlay = useOverlayMotion({ distance: 26, scale: .985 })
let generation = 0, controller, downloadController
useDialogFocus(() => active.value, dialogEl, '.fpm-close', closeWithMotion)

const displayName = computed(() => props.item.display_name || props.item.displayName || props.item.original_name || props.item.originalName || '未命名文件')
const format = computed(() => previewType(props.item, mime.value))
const kind = computed(() => format.value.kind)
const mdHtml = computed(() => kind.value === 'markdown' ? renderMarkdown(textContent.value) : '')
const csv = computed(() => kind.value === 'csv' ? parseCsv(textContent.value) : { rows: [] })
const isCurrent = id => active.value && !closing.value && id === generation
function revoke() { if (objectUrl.value) URL.revokeObjectURL(objectUrl.value); objectUrl.value = '' }
function reset() { revoke(); rawBlob.value = null; textContent.value = ''; documentHtml.value = ''; error.value = ''; downloadError.value = ''; truncated.value = false; imageZoom.value = 1; audioPlaying.value = false; mime.value = '' }

async function load() {
  controller?.abort()
  controller = new AbortController()
  const id = ++generation
  reset(); loading.value = true
  try {
    const blob = await request.get('/vault/' + props.item.id + '/preview', { responseType: 'blob', timeout: 60000, signal: controller.signal })
    if (!isCurrent(id)) return
    if (!(blob instanceof Blob) || !blob.size) throw new Error('文件内容为空或未返回有效文件，请重试。')
    // API errors occasionally arrive as a JSON blob instead of a document.
    if (blob.type.includes('application/json')) throw new Error('暂时无法读取原文件，请重新加载。')
    mime.value = blob.type
    const type = format.value
    if (['markdown', 'text', 'csv'].includes(type.kind)) {
      const limit = 1024 * 1024
      const text = await blob.slice(0, limit).text()
      if (!isCurrent(id)) return
      textContent.value = text
      truncated.value = blob.size > limit
    } else if (type.kind === 'docx') {
      const html = await docxHtml(blob)
      if (!isCurrent(id)) return
      documentHtml.value = html
    } else if (type.kind === 'pdf') rawBlob.value = blob
    else if (['image', 'audio'].includes(type.kind)) {
      // Servers may return octet-stream; restore the known file MIME for native media.
      objectUrl.value = URL.createObjectURL(blob.slice(0, blob.size, type.mime))
    }
  } catch (e) {
    if (isCurrent(id) && e.code !== 'ERR_CANCELED') error.value = kind.value === 'docx' ? '这份 Word 文件未能打开，文件可能已损坏。你可以重试或下载原文件。' : e.message || '文件未能打开，请重试。'
  } finally { if (isCurrent(id)) loading.value = false }
}

async function closeWithMotion() {
  if (closing.value) return
  closing.value = true; generation++; controller?.abort(); downloadController?.abort()
  dialogEl.value?.querySelector('audio')?.pause()
  const result = await overlay.close(dialogEl.value, maskEl.value)
  if (result.includes('cancelled')) return
  active.value = false; emit('close')
}
function mediaError(event) {
  if (loading.value || closing.value || event.currentTarget.getAttribute('src') !== objectUrl.value) return
  error.value = kind.value === 'audio' ? '浏览器无法播放这段音频，请下载后使用播放器打开。' : '图片未能显示，请检查文件是否完整。'
}

async function download() {
  if (downloading.value) return
  const id = props.item.id
  const name = props.item.original_name || props.item.originalName || displayName.value
  downloading.value = true; downloadError.value = ''; downloadController = new AbortController()
  try {
    const blob = await request.get('/vault/' + id + '/download', { responseType: 'blob', timeout: 60000, signal: downloadController.signal })
    if (!active.value || closing.value || id !== props.item.id) return
    if (!(blob instanceof Blob) || !blob.size || blob.type.includes('application/json')) throw new Error('原文件下载失败，请重试。')
    const url = URL.createObjectURL(blob), anchor = document.createElement('a')
    anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch (e) { if (active.value && !closing.value && e.code !== 'ERR_CANCELED') downloadError.value = e.message || '下载失败，请重试。' }
  finally { downloading.value = false }
}
onMounted(async () => { active.value = true; load(); await nextTick(); if (!closing.value) overlay.open(dialogEl.value, maskEl.value) })
watch(() => props.item.id, () => { downloadController?.abort(); if (active.value && !closing.value) load() })
onBeforeUnmount(() => { active.value = false; generation++; controller?.abort(); downloadController?.abort(); revoke() })
</script>

<template>
  <Teleport to="body">
    <div ref="maskEl" class="fpm-mask" @click.self="closeWithMotion">
      <section ref="dialogEl" class="fpm-card" role="dialog" aria-modal="true" :aria-label="displayName" tabindex="-1">
        <header class="fpm-head">
          <span class="fpm-badge">{{ format.extension.toUpperCase() }}</span>
          <div class="fpm-heading"><span>MEMORY / OPEN FILE</span><h2 class="fpm-title">{{ displayName }}</h2></div>
          <button class="fpm-close" aria-label="关闭预览" @click="closeWithMotion">×</button>
        </header>
        <div class="fpm-body" :aria-busy="loading">
          <div v-if="loading" class="fpm-state" role="status"><span class="spinner" /><strong>正在打开这份记忆…</strong><span>让灵感重新浮现。</span></div>
          <div v-else-if="error" class="fpm-state" role="alert"><b class="fpm-state-mark">!</b><strong>{{ error }}</strong><button class="fpm-action" @click="load">重新加载 ↗</button></div>
          <template v-else>
            <p v-if="truncated" class="fpm-note">文件较长，仅预览前 1 MB。下载可查看完整内容。</p>
            <article v-if="kind === 'markdown'" class="fpm-document" v-html="mdHtml" />
            <pre v-else-if="kind === 'text'" class="fpm-text">{{ textContent || '这份文件还没有文字。' }}</pre>
            <div v-else-if="kind === 'csv'" class="fpm-csv">
              <p class="fpm-note">表格预览 · 首行为表头<span v-if="csv.truncated"> · 仅显示前 200 条数据、前 50 列</span><span v-if="csv.malformed"> · 引号未闭合，已按现有内容显示</span></p>
              <div class="fpm-table-scroll" tabindex="0" aria-label="CSV 表格，可横向滚动">
                <table v-if="csv.rows.length"><thead><tr><th v-for="(cell, i) in csv.rows[0]" :key="i" scope="col">{{ cell || '列 ' + (i + 1) }}</th></tr></thead><tbody><tr v-for="(row, r) in csv.rows.slice(1)" :key="r"><td v-for="(cell, c) in row" :key="c">{{ cell }}</td></tr></tbody></table>
                <p v-else>这份表格还没有内容。</p>
              </div>
            </div>
            <template v-else-if="kind === 'docx'"><p class="fpm-note">Word 内容预览 · 复杂页眉、图表和分页请下载原文件查看。</p><article class="fpm-document fpm-word" v-html="documentHtml || '<p>这份文档还没有文字。</p>'" /></template>
            <PdfDocumentPreview v-else-if="kind === 'pdf' && rawBlob" :blob="rawBlob" />
            <div v-else-if="kind === 'image'" class="fpm-image-view">
              <div class="fpm-image-tools"><button :aria-pressed="imageZoom === 1" @click="imageZoom = 1">适应窗口</button><button :aria-pressed="imageZoom === 2" @click="imageZoom = 2">放大查看</button></div>
              <div class="fpm-image-scroll" tabindex="0" aria-label="图片预览"><img :src="objectUrl" :alt="displayName" :style="{ maxWidth: imageZoom === 1 ? '100%' : 'none', width: imageZoom === 1 ? 'auto' : '200%' }" @error="mediaError"></div>
            </div>
            <div v-else-if="kind === 'audio'" class="fpm-audio">
              <div class="audio-disc" :class="{ 'is-playing': audioPlaying }" aria-hidden="true"><i /><span>KEEP<br>LISTENING.</span></div>
              <span class="audio-caption">SOUNDTRACK OF YOUR DAYS</span><h3>{{ displayName }}</h3>
              <audio :src="objectUrl" controls preload="metadata" :aria-label="displayName" @play="audioPlaying = true" @pause="audioPlaying = false" @ended="audioPlaying = false" @error="mediaError" />
              <p>按下播放，回到那个瞬间。</p>
            </div>
            <div v-else class="fpm-state"><b class="fpm-state-mark">↗</b><strong>这类文件暂不支持直接预览。</strong><span>下载原文件后，用对应的应用打开。</span></div>
          </template>
        </div>
        <footer class="fpm-foot"><span>KEEP WHAT MATTERS.</span><p v-if="downloadError" role="alert">{{ downloadError }}</p><button class="fpm-action" :disabled="downloading" @click="download">{{ downloading ? '下载中…' : '下载原文件 ↗' }}</button></footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.fpm-mask{position:fixed;inset:0;z-index:60;background:#06183ecc;backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:24px}
.fpm-card{width:100%;max-width:1020px;max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;background:#d6ebee;box-shadow:9px 10px 0 #66d9ec66,-6px -6px 0 #ec90b466;color:#203c68;border-top:5px solid #dfff77}
.fpm-head{display:flex;align-items:center;gap:17px;padding:23px 27px;background:#143872;color:#fff3de;flex-shrink:0}.fpm-badge{font:italic 900 27px var(--font-display);background:#efa3c2;color:#1e3970;padding:8px 13px;transform:rotate(-5deg);max-width:95px;overflow:hidden;text-overflow:ellipsis}.fpm-heading{min-width:0;flex:1}.fpm-heading>span{font:800 11px var(--font-display);letter-spacing:.16em;color:#a0e6ef}.fpm-title{font-size:18px;font-weight:800;margin-top:4px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.fpm-close{flex-shrink:0;background:#dfff77;color:#153975;width:40px;height:40px;font-size:29px;transform:rotate(4deg)}.fpm-close:hover{transform:rotate(-4deg)}
.fpm-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:23px;background:repeating-linear-gradient(125deg,transparent 0 30px,#2e5c8b0a 30px 31px),#d6ebee}.fpm-state{min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:30px;text-align:center;font-size:13px}.fpm-state strong{font-size:18px;max-width:40ch;overflow-wrap:anywhere}.fpm-state-mark{font:italic 900 60px var(--font-display);color:#b53d74}.fpm-note{font-size:11px;padding:0 0 15px;line-height:1.8;color:#3f5c78}
.fpm-document,.fpm-text{background:#fffdf5;padding:32px 40px;min-height:240px;box-shadow:4px 5px 0 #7dabc44a;font-size:15px;line-height:1.95;overflow-wrap:anywhere;color:#273e60;max-width:100%;overflow-x:auto}
.fpm-text{white-space:pre-wrap;font:13px/1.9 var(--font-mono)}.fpm-document :deep(h1){font-size:30px;line-height:1.45;border-bottom:3px solid #8edeea;padding-bottom:14px;margin-bottom:22px;color:#173b77}.fpm-document :deep(h2){font-size:23px;line-height:1.5;margin:25px 0 10px}.fpm-document :deep(h3){font-size:18px;margin:18px 0 9px}.fpm-document :deep(p){margin:10px 0}.fpm-document :deep(ul),.fpm-document :deep(ol){padding-left:25px;margin:12px 0}.fpm-document :deep(blockquote){border-left:4px solid #e88ab5;background:#f8e8ef;padding:10px 20px;margin:18px 0}.fpm-document :deep(pre){overflow:auto;background:#112f66;color:#e0f0ff;padding:17px;max-width:100%;white-space:pre}.fpm-document :deep(code){font-size:13px}.fpm-document :deep(a){color:#1758bc;text-decoration:underline}.fpm-document :deep(img){max-width:100%;height:auto}.fpm-document :deep(table),.fpm-csv table{border-collapse:collapse;font-size:13px;line-height:1.7}.fpm-document :deep(td),.fpm-document :deep(th),.fpm-csv td,.fpm-csv th{border:1px solid #8caac688;padding:10px 14px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;min-width:85px;max-width:420px}.fpm-document :deep(th),.fpm-csv th{background:#193e7f;color:#fff4dc}.fpm-csv tbody tr:nth-child(even){background:#dff0f2}.fpm-table-scroll{overflow:auto;max-height:60dvh;background:#fffdf6}.fpm-table-scroll table{width:100%}
.fpm-image-tools{display:flex;gap:8px;margin-bottom:15px}.fpm-image-tools button{background:#f9f3e6;padding:8px 14px;color:#234a7e;font-size:12px}.fpm-image-tools button[aria-pressed=true]{background:#173c80;color:white}.fpm-image-scroll{overflow:auto;text-align:center;max-height:62dvh;background:repeating-conic-gradient(#c3d7e0 0% 25%,#e1ebec 0% 50%) 50%/20px 20px;padding:15px}.fpm-image-scroll img{display:block;margin:0 auto;max-height:none}
.fpm-audio{display:flex;flex-direction:column;align-items:center;gap:18px;padding:25px 15px;background:#fae5ed;text-align:center}.audio-disc{height:200px;width:200px;border-radius:50%;background:repeating-radial-gradient(circle,#163673 0 2px,#244a87 3px 4px);position:relative;display:grid;place-items:center;box-shadow:8px 8px 0 #f2aecc;transform:rotate(-12deg)}.audio-disc i{position:absolute;width:75px;height:75px;border-radius:50%;background:#c7f28b}.audio-disc span{position:relative;font:italic 900 16px/.9 var(--font-display);color:#153975;transform:rotate(12deg)}.audio-caption{font:800 11px var(--font-display);letter-spacing:.15em}.fpm-audio h3{font-size:19px;overflow-wrap:anywhere;max-width:100%}.fpm-audio audio{width:min(100%,500px)}.fpm-audio p{font-size:12px;color:#5e6480}
.fpm-foot{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;flex-shrink:0;padding:17px 27px;border-top:1px dashed #7fa6c6;background:#f7efdf}.fpm-foot>span{font:italic 900 16px var(--font-display);color:#436688}.fpm-foot p{font-size:11px;color:#a93061;overflow-wrap:anywhere}.fpm-action{padding:10px 18px;min-height:40px;font-size:12px;font-weight:800;background:#173c80;color:#fff8df;box-shadow:3px 3px 0 #ed8bb5}.fpm-action:disabled{opacity:.5}
@media(max-width:599px){.fpm-mask{padding:12px}.fpm-card{max-height:94dvh}.fpm-head{padding:16px 14px;gap:11px}.fpm-badge{font-size:21px;padding:6px 8px;max-width:65px}.fpm-heading>span{font-size:9px}.fpm-title{font-size:15px}.fpm-close{width:34px;height:34px;font-size:26px}.fpm-body{padding:14px}.fpm-document,.fpm-text{padding:22px 18px;font-size:14px}.fpm-document :deep(h1){font-size:24px}.fpm-foot{padding:14px;gap:10px}.fpm-foot>span{font-size:11px}.fpm-action{padding:9px 12px}.fpm-state{padding:20px 5px;min-height:230px}.fpm-state strong{font-size:16px}.audio-disc{width:155px;height:155px}}
</style>
<style scoped>
.audio-disc{animation:vinyl-turn 9s linear infinite;animation-play-state:paused}.audio-disc.is-playing{animation-play-state:running}
@keyframes vinyl-turn{from{transform:rotate(-12deg)}to{transform:rotate(348deg)}}
@media(prefers-reduced-motion:reduce){.audio-disc{animation:none}}
</style>
