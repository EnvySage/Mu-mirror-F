<script setup>
import { computed, ref, watch } from 'vue'
import { useGrowthStore } from '@/stores/growth'

const props = defineProps({ proposal: { type: Object, required: true } })
const emit = defineEmits(['save', 'cancel'])
const growth = useGrowthStore()
const payload = ref({})
const axes = computed(() => growth.axesDefinition?.axes || props.proposal.preview?.axes || props.proposal.payload?.axes || [])
const manualMin = computed(() => Number(growth.config?.manual_min ?? growth.config?.manualMin ?? NaN))
const manualMax = computed(() => Number(growth.config?.manual_max ?? growth.config?.manualMax ?? NaN))
const isCorrection = computed(() => Boolean(payload.value.entryId ?? payload.value.entry_id))

growth.fetchAxes().catch(() => {})

watch(() => props.proposal, card => {
  payload.value = JSON.parse(JSON.stringify(card?.payload || {}))
}, { immediate: true, deep: true })

function submit() { emit('save', { ...payload.value, points: Number(payload.value.points) }) }
</script>

<template>
  <form class="growth-action-form" @submit.prevent="submit">
    <p v-if="isCorrection" class="growth-target">更正账本条目 · 目标版本 {{ payload.expectedVersion ?? payload.expected_version }}</p>
    <label>成长维度<select v-model="payload.dimensionId" required><option v-for="axis in axes" :key="axis.id" :value="axis.id">{{ axis.name }}</option></select></label>
    <label>分值<input v-model.number="payload.points" type="number" :min="manualMin" :max="manualMax" step="1" :disabled="!growth.config" required></label>
    <label>原因<textarea v-model.trim="payload.reason" rows="3" maxlength="500" required /></label>
    <p class="growth-rule">{{ growth.config ? '分值必须符合成长配置的上下限；更正会替换目标条目的最终分值并保留审计记录。' : '暂时无法读取分值配置，不能编辑此贡献。' }}</p>
    <div class="growth-form-actions"><button type="button" @click="emit('cancel')">返回</button><button type="submit">保存修改</button></div>
  </form>
</template>

<style scoped>
.growth-action-form{display:grid;gap:10px;margin-top:14px;padding-top:13px;border-top:1px solid #8794ad33}.growth-action-form label{display:grid;gap:5px;color:var(--text-mid);font-size:12px}.growth-action-form input,.growth-action-form textarea,.growth-action-form select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #8794ad55;border-radius:7px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.growth-target,.growth-rule{margin:0;color:var(--text-mid);font-size:12px;line-height:1.5}.growth-form-actions{display:flex;justify-content:flex-end;gap:8px}.growth-form-actions button{padding:7px 12px;border:0;border-radius:6px;cursor:pointer}.growth-form-actions button:last-child{background:var(--accent,#4765db);color:#fff}
</style>
