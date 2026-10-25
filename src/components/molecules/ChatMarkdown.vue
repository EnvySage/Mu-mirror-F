<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/mdPreview'

const props = defineProps({
  content: { type: String, default: '' },
  sources: { type: Array, default: () => [] },
  vaultRefs: { type: Array, default: () => [] },
})
const emit = defineEmits(['open-source', 'open-vault'])

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function findSource(n) {
  const byN = props.sources.find(s => Number(s.n) === n)
  if (byN) return byN
  if (props.sources.some(s => s.n != null)) return null
  return props.sources[n - 1] || null
}

function citeTitle(source) {
  return [source.date, source.quote].filter(Boolean).join(' · ')
}

const html = computed(() => {
  const placeholders = []
  const source = String(props.content || '').replace(/\[(F?)(\d{1,3})\](?!\()/g, (m, file, num) => {
    const index = placeholders.length
    placeholders.push({ file: !!file, n: Number(num) })
    return `\u0000CITE${index}\u0000`
  })
  return renderMarkdown(source).replace(/\u0000CITE(\d+)\u0000/g, (_, raw) => {
    const item = placeholders[Number(raw)]
    if (!item) return ''
    if (item.file) {
      const ref = props.vaultRefs.find(r => Number(r.n) === item.n)
      if (!ref) return `<span class="cite-file-plain">[F${item.n}]</span>`
      return `<button type="button" class="cite-file-chip" data-vault-n="${item.n}" title="文件 · ${escapeHtml(ref.displayName)}">`
        + `<span class="cite-file-name">${escapeHtml(ref.displayName)}</span></button>`
    }
    const citation = findSource(item.n)
    if (!citation) return `<span>[${item.n}]</span>`
    return `<button type="button" class="cite-chip" data-cite-n="${item.n}" title="${escapeHtml(citeTitle(citation))}">${item.n}</button>`
  })
})

function onClick(event) {
  const target = event.target instanceof Element ? event.target : null
  if (!target) return
  const cite = target.closest('[data-cite-n]')
  if (cite) {
    const citation = findSource(Number(cite.getAttribute('data-cite-n')))
    if (citation) emit('open-source', citation)
    return
  }
  const file = target.closest('[data-vault-n]')
  if (file) {
    const ref = props.vaultRefs.find(r => Number(r.n) === Number(file.getAttribute('data-vault-n')))
    if (ref) emit('open-vault', ref)
  }
}
</script>

<template>
  <div class="chat-md" v-html="html" @click="onClick" />
</template>

<style scoped>
.chat-md { white-space: normal; }
.chat-md :deep(> :first-child){ margin-top: 0; }
.chat-md :deep(> :last-child){ margin-bottom: 0; }
.chat-md :deep(p) { margin: 0 0 .7em; }
.chat-md :deep(ul), .chat-md :deep(ol) { margin: .35em 0 .8em; padding-left: 1.45em; }
.chat-md :deep(li) { margin: .22em 0; }
.chat-md :deep(strong) { font-weight: 800; }
.chat-md :deep(em) { font-style: italic; }
.chat-md :deep(h1), .chat-md :deep(h2), .chat-md :deep(h3), .chat-md :deep(h4), .chat-md :deep(h5), .chat-md :deep(h6) {
  margin: .75em 0 .45em; line-height: 1.4; font-weight: 800;
}
.chat-md :deep(h1) { font-size: 1.3em; }
.chat-md :deep(h2) { font-size: 1.2em; }
.chat-md :deep(h3) { font-size: 1.1em; }
.chat-md :deep(code) {
  padding: 1px 5px; border-radius: 4px; background: #0f2b6610;
  font-family: var(--font-mono); font-size: .88em;
}
.chat-md :deep(pre) {
  margin: .6em 0; padding: 10px 12px; overflow-x: auto; border-radius: 6px;
  background: #0b1b3d; color: #e8f1ff; line-height: 1.6;
}
.chat-md :deep(pre code) { padding: 0; background: none; color: inherit; }
.chat-md :deep(blockquote) {
  margin: .6em 0; padding: 6px 12px; border-left: 3px solid var(--cyan);
  background: #0f2b6608; color: var(--text-mid);
}
.chat-md :deep(hr) { margin: .9em 0; border: 0; border-top: 1px solid var(--line); }
.chat-md :deep(a) { color: var(--accent); text-decoration: underline; }
</style>
