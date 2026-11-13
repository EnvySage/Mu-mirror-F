<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchPreviewBlob } from '@/api/vault'
import LedgerDialog from './LedgerDialog.vue'

const props = defineProps({ id: { type: [Number, String], required: true }, title: String })
defineEmits(['close'])
const url = ref(''), error = ref(''), loading = ref(true)
let active = true
async function load() {
  loading.value = true; error.value = ''
  try {
    const file = await fetchPreviewBlob(props.id)
    if (!(file instanceof Blob) || !file.type.startsWith('image/')) throw new Error('没有读取到图片')
    if (active) url.value = URL.createObjectURL(file)
  } catch (e) { if (active) error.value = e.message || '无法读取图片' }
  finally { if (active) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => { active = false; if (url.value) URL.revokeObjectURL(url.value) })
</script>

<template>
  <LedgerDialog open :title="title || '查看凭证'" @close="$emit('close')">
    <p v-if="loading" role="status">正在读取图片…</p>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
    <img v-else-if="url" :src="url" :alt="title || '支付凭证'" />
  </LedgerDialog>
</template>

<style scoped>
img{display:block;max-width:100%;max-height:67dvh;object-fit:contain;margin:auto}
</style>
