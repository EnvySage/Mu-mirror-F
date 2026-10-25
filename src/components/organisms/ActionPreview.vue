<script setup>
import { computed } from 'vue'
import { useGrowthStore } from '@/stores/growth'
import { typeMap } from '@/constants/tags'

const props = defineProps({ proposal: { type: Object, required: true } })
const growth = useGrowthStore()
const preview = computed(() => props.proposal.preview || {})
const payload = computed(() => props.proposal.payload || {})
const record = computed(() => payload.value.recordDraft || preview.value.recordDraft)
const memory = computed(() => payload.value.memoryDraft || preview.value.memoryDraft)
const segments = computed(() => record.value?.segments || [])
const contributions = computed(() => record.value?.growthSuggestions || record.value?.growth_suggestions || [])
const finalText = computed(() => record.value?.finalContent || memory.value?.content || payload.value.content || payload.value.notes || '')
const labels = { title:'内容', content:'正文', notes:'备注', dueAt:'截止时间', currentStatus:'状态', status:'状态', kind:'类型', eventDate:'事实日期', expiresAt:'有效至', dimensionName:'成长维度', dimensionId:'成长维度', points:'分数', reason:'原因', memoryState:'记忆状态', enabled:'是否启用', delta:'分数变化', growthPointsRemoved:'移除分数', growthEntriesRemoved:'移除贡献笔数', warning:'影响说明', beforeMemoryState:'原记忆状态', afterMemoryState:'确认后记忆状态' }
const values = { not_started:'未开始', in_progress:'进行中', completed:'已完成', fact:'事实', preference:'偏好', event:'事件', plan:'计划', READY:'使用中', ACTIVE:'使用中', DISABLED:'已停用', PENDING:'待确认' }
function fields(object) {
  return Object.entries(object || {}).filter(([key, value]) => labels[key] && value != null && typeof value !== 'object').map(([key, value]) => ({ label: labels[key], value: typeof value === 'boolean' ? value ? '是' : '否' : (key === 'dimensionId' ? (growth.axesDefinition?.axes || []).find(axis => axis.id === value)?.name || value : values[value]) || String(value) }))
}
const metadata = computed(() => fields({ ...payload.value, ...memory.value, ...preview.value }).filter(item => !['正文', '备注'].includes(item.label)))
const changes = computed(() => [{ label:'修改前', items:fields(preview.value.before) }, { label:'确认后', items:fields(preview.value.after) }].filter(group => group.items.length))
function dimensionName(item) { return item.dimensionName || item.name || (record.value?.growthAxes || record.value?.growth_axes || growth.axesDefinition?.axes || []).find(axis => axis.id === (item.dimensionId || item.dimension_id))?.name || '成长贡献' }
</script>

<template>
  <div class="action-preview">
    <section v-if="finalText"><h3>{{ record ? '整理后的正文' : memory ? '记忆内容' : '内容' }}</h3><p class="preview-prose">{{ finalText }}</p></section>
    <dl v-if="metadata.length" class="preview-facts"><div v-for="(item, index) in metadata" :key="index"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
    <section v-for="group in changes" :key="group.label"><h3>{{ group.label }}</h3><dl class="preview-facts"><div v-for="item in group.items" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl></section>
    <section v-if="segments.length"><h3>整理成 {{ segments.length }} 个片段</h3><article v-for="(segment, index) in segments" :key="segment.draftId || index" class="preview-segment"><header><b>{{ typeMap[segment.contentType] || segment.contentType || '随记' }}</b><span v-for="tag in segment.tags || []" :key="tag">#{{ tag }}</span></header><p>{{ segment.text }}</p></article></section>
    <section v-if="contributions.length"><h3>成长贡献</h3><div v-for="(item, index) in contributions" :key="index" class="preview-growth"><b>{{ dimensionName(item) }} <span>{{ Number(item.points) > 0 ? '+' : '' }}{{ item.points }}</span></b><p>{{ item.reason || '未提供具体依据' }}</p></div></section>
    <section v-if="(payload.todoResolutions || record?.todoResolutions)?.length"><h3>关联待办</h3><p v-for="(item, index) in payload.todoResolutions || record.todoResolutions" :key="index">{{ item.todoTitle || item.title || '关联待办' }}：{{ item.action === 'dismissed' ? '本次忽略' : values[item.status] || item.status || '维持当前状态' }}</p></section>
    <details v-if="record?.rawContent" class="preview-original"><summary>查看原始输入</summary><p>{{ record.rawContent }}</p></details>
    <p v-if="!finalText && !metadata.length && !segments.length && !changes.length" class="preview-empty">{{ preview.description || '请确认这项操作的内容与影响。' }}</p>
  </div>
</template>

<style scoped>
.action-preview{font-size:14px;line-height:1.85;overflow-wrap:anywhere}.action-preview section+section{margin-top:23px}.action-preview h3{margin:0 0 10px;font-size:12px;color:#506c81;font-weight:700}.preview-prose{margin:0;white-space:pre-wrap;font-size:16px;line-height:1.9}.preview-facts{margin:20px 0;display:grid;gap:10px}.preview-facts>div{display:grid;grid-template-columns:95px minmax(0,1fr);gap:14px}.preview-facts dt{color:#526b7c;font-size:12px}.preview-facts dd{margin:0;white-space:pre-wrap}.preview-segment{border-left:3px solid #3877bf;padding:12px 16px;margin:10px 0;background:#e6eef0}.preview-segment header{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#3a6385}.preview-segment p{margin:8px 0 0;white-space:pre-wrap}.preview-growth{padding:10px 0;border-bottom:1px solid #d2dfe1}.preview-growth b{font-size:13px}.preview-growth b span{color:#155bba;margin-left:10px}.preview-growth p{margin:4px 0 0;font-size:12px;color:#526b7c}.preview-original{margin-top:23px;border-top:1px dashed #b9cdd1;padding-top:16px;font-size:12px;color:#526b7c}.preview-original summary{cursor:pointer;min-height:32px}.preview-original p{white-space:pre-wrap;margin:8px 0}.preview-original summary:focus-visible{outline:2px solid #164fd5;outline-offset:3px}
</style>
