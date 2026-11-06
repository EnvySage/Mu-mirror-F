<script setup>
import { ref, onBeforeUnmount, nextTick } from 'vue'
const emit = defineEmits(['count', 'error'])
const images = ref([])
const viewer = ref(null)
const selected = ref(null)
function addFiles(files) {
  for (const file of files) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { emit('error', '请选择 PNG、JPEG 或 WebP 图片'); continue }
    if (file.size > 10 * 1024 * 1024) { emit('error', '单张图片不能超过 10 MB'); continue }
    if (images.value.length >= 4) { emit('error', '一次最多预览 4 张图片'); break }
    images.value.push({ id: crypto.randomUUID(), name: file.name || '粘贴的截图', url: URL.createObjectURL(file) })
  }
  emit('count', images.value.length)
}
function remove(item) {
  URL.revokeObjectURL(item.url)
  images.value = images.value.filter(image => image.id !== item.id)
  emit('count', images.value.length)
}
async function open(item) { selected.value = item; await nextTick(); viewer.value.showModal() }
onBeforeUnmount(() => images.value.forEach(item => URL.revokeObjectURL(item.url)))
defineExpose({ addFiles })
</script>

<template>
  <section v-if="images.length" class="image-draft" aria-label="待发送图片预览">
    <header><b>SNAP / {{ String(images.length).padStart(2, '0') }}</b><span>图片交互预览 · 尚未接入模型</span></header>
    <TransitionGroup name="snap" tag="div" class="image-strip">
      <div v-for="(item,index) in images" :key="item.id" class="image-tile">
        <button class="image-open" :aria-label="`放大图片 ${index + 1}`" @click="open(item)"><img :src="item.url" :alt="item.name"><i>0{{ index + 1 }}</i></button>
        <button class="image-remove" :aria-label="`移除图片 ${index + 1}`" @click="remove(item)">×</button>
      </div>
    </TransitionGroup>
    <p>图片仅在本机预览，未上传。移除图片后可继续发送文字。</p>
  </section>
  <Teleport to="body"><dialog ref="viewer" class="snap-viewer" aria-label="图片放大预览" @click="e => { if(e.target === viewer) viewer.close() }"><button aria-label="关闭图片预览" @click="viewer.close()">×</button><img v-if="selected" :src="selected.url" :alt="selected.name"></dialog></Teleport>
</template>

<style scoped>
.image-draft{flex-shrink:0;padding:10px 12px 6px;background:#123063;border-top:2px solid #71f3f1;color:#e9f8ff}.image-draft header{display:flex;align-items:center;justify-content:space-between;gap:8px}.image-draft b{font:italic 900 15px var(--font-display);color:#eaff70;letter-spacing:.08em}.image-draft header span,.image-draft p{font-size:10px;line-height:1.5;color:#b2d5eb}.image-draft p{margin:4px 0}.image-strip{display:flex;gap:14px;overflow-x:auto;padding:10px 5px 5px}.image-tile{position:relative;flex:0 0 70px;height:68px;transform:rotate(-3deg)}.image-tile:nth-child(even){transform:rotate(3deg)}.image-open{position:relative;height:100%;width:100%;border:2px solid #e9ff8d;box-shadow:3px 3px #ed3983;background:#10254a}.image-open img{width:100%;height:100%;object-fit:cover}.image-open i{position:absolute;bottom:0;left:0;background:#e9ff8d;color:#10254a;font:bold 10px monospace;padding:1px 4px}.image-remove{position:absolute;right:-9px;top:-9px;width:28px;height:28px;border-radius:50%;background:#e93880;color:white;font-size:22px;box-shadow:0 0 0 2px #123063}.snap-enter-active,.snap-leave-active{transition:opacity .2s,scale .3s cubic-bezier(.2,1.5,.4,1)}.snap-enter-from,.snap-leave-to{opacity:0;scale:.65}.snap-viewer{margin:auto;padding:38px 10px 10px;max-width:94vw;max-height:90dvh;background:#10254a;border:2px solid #72e9ef;color:white}.snap-viewer::backdrop{background:#020817df;backdrop-filter:blur(6px)}.snap-viewer img{display:block;max-width:88vw;max-height:75dvh;object-fit:contain}.snap-viewer>button{position:absolute;right:0;top:0;width:44px;height:38px;font-size:28px}.image-draft button:focus-visible,.snap-viewer button:focus-visible{outline:3px solid #ecff79;outline-offset:3px}@media(prefers-reduced-motion:reduce){.snap-enter-active,.snap-leave-active{transition:none}}
</style>
