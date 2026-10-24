<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl
const props = defineProps({ blob: { type: Blob, required: true } })
const canvas = ref(null), container = ref(null), pageNumber = ref(1), total = ref(0)
const zoom = ref(1), busy = ref(true), error = ref(''), text = ref(''), showText = ref(false)
let task, document, rendering, observer, generation = 0, paintGeneration = 0, disposed = false
let paintQueue = Promise.resolve()
const resourceBase = `${import.meta.env.BASE_URL}pdf-resources/`

async function load() {
  const id = ++generation
  rendering?.cancel(); await task?.destroy()
  if (disposed || id !== generation) return
  busy.value = true; error.value = ''; total.value = 0; pageNumber.value = 1
  try {
    const data = new Uint8Array(await props.blob.arrayBuffer())
    if (disposed || id !== generation) return
    task = getDocument({ data, cMapUrl: resourceBase + 'cmaps/', standardFontDataUrl: resourceBase + 'standard_fonts/', wasmUrl: resourceBase + 'wasm/', iccUrl: resourceBase + 'iccs/', isEvalSupported: false })
    task.onPassword = () => { error.value = '这份 PDF 需要密码，请下载后打开。'; busy.value = false; task.destroy() }
    document = await task.promise
    if (disposed || id !== generation) return
    total.value = document.numPages
    schedulePaint()
  } catch (e) {
    if (!disposed && id === generation) { error.value ||= 'PDF 无法读取，文件可能已损坏。'; busy.value = false }
  }
}

// Serialize canvas ownership; a canceled render must release it before reuse.
function schedulePaint() {
  const id = ++paintGeneration
  rendering?.cancel()
  paintQueue = paintQueue.catch(() => {}).then(async () => {
    if (disposed || id !== paintGeneration || !document || !canvas.value) return
    busy.value = true; error.value = ''
    try {
      const page = await document.getPage(pageNumber.value)
      if (disposed || id !== paintGeneration) return
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(1.45, Math.max(180, container.value.clientWidth - 32) / base.width) * zoom.value
      const viewport = page.getViewport({ scale })
      const ratio = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(12_000_000 / (viewport.width * viewport.height)))
      canvas.value.width = Math.floor(viewport.width * ratio)
      canvas.value.height = Math.floor(viewport.height * ratio)
      canvas.value.style.width = `${viewport.width}px`; canvas.value.style.height = `${viewport.height}px`
      rendering = page.render({ canvasContext: canvas.value.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
      await rendering.promise
      const content = await page.getTextContent()
      if (!disposed && id === paintGeneration) text.value = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('')
    } catch (e) {
      if (!disposed && id === paintGeneration && e.name !== 'RenderingCancelledException') error.value = '这一页未能显示，请重新打开文件。'
    } finally { if (!disposed && id === paintGeneration) busy.value = false }
  })
}
watch([pageNumber, zoom], schedulePaint)
watch(() => props.blob, load)
onMounted(async () => { await nextTick(); observer = new ResizeObserver(schedulePaint); observer.observe(container.value); load() })
onBeforeUnmount(() => { disposed = true; generation++; paintGeneration++; observer?.disconnect(); rendering?.cancel(); task?.destroy(); document = null })
</script>

<template>
  <div class="pdf-reader">
    <div class="pdf-tools" aria-label="PDF 阅读工具">
      <button aria-label="PDF 上一页" :disabled="pageNumber <= 1 || !total" @click="pageNumber--">←</button>
      <span aria-live="polite">{{ pageNumber }} / {{ total || '—' }}</span>
      <button aria-label="PDF 下一页" :disabled="pageNumber >= total" @click="pageNumber++">→</button>
      <button aria-label="缩小 PDF" :disabled="zoom <= .75" @click="zoom = Math.max(.75, zoom - .25)">−</button>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <button aria-label="放大 PDF" :disabled="zoom >= 2" @click="zoom = Math.min(2, zoom + .25)">＋</button>
      <button :aria-pressed="showText" @click="showText = !showText">{{ showText ? '版面' : '文字' }}</button>
    </div>
    <p v-if="error" class="pdf-message" role="alert">{{ error }}</p>
    <p v-else-if="busy" class="pdf-message" role="status">正在翻开第 {{ pageNumber }} 页…</p>
    <div ref="container" class="pdf-stage" :aria-busy="busy">
      <canvas v-show="!showText && !error" ref="canvas" role="img" :aria-label="`PDF 第 ${pageNumber} 页；可切换文字视图阅读内容`" />
      <pre v-if="showText && !error" class="pdf-text">{{ busy ? '正在提取文字…' : text || '本页没有可提取的文字，可能是扫描图片。' }}</pre>
    </div>
  </div>
</template>

<style scoped>
.pdf-tools{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;background:#153975;color:#fff4df;padding:10px;position:sticky;top:0;z-index:1;font-size:12px}.pdf-tools button{min-width:34px;min-height:34px;padding:4px 8px;background:#d4f0f1;color:#17396e;font-weight:800}.pdf-tools button:disabled{opacity:.4;cursor:default}.pdf-tools button[aria-pressed=true]{background:#f5aac8}.pdf-stage{overflow:auto;max-height:65dvh;min-height:160px;padding:16px;background:#c7dce9;scrollbar-gutter:stable}.pdf-stage canvas{display:block;margin:0 auto;background:white;box-shadow:0 8px 22px #17376733}.pdf-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.9;color:#243d62;background:#fffdf7;padding:20px}.pdf-message{padding:12px;color:#244c7d;font-size:12px}.pdf-message[role=alert]{color:#9e2858}@media(max-width:599px){.pdf-tools{gap:6px}.pdf-stage{padding:16px 8px}.pdf-tools button{min-width:30px}}
</style>
