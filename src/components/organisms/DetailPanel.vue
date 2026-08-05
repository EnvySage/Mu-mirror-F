<script setup>
import { ref, computed, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { typeMap, moodMap, MOOD_COLOR_MAP, CONTENT_TYPES, ALL_MOODS } from '@/constants/tags'

const ui = useUIStore()
const recordsStore = useRecordsStore()

const record = computed(() => {
  if (!ui.selectedRecordId) return null
  return recordsStore.getById(ui.selectedRecordId)
})

// Review state
const reviewData = ref(null)
const reviewKeywords = ref('')

function simulateAI(text) {
  const lower = text.toLowerCase()
  let content_type = 'note'
  let mood = ['calm']
  let keywords = []
  if (/学|learn|study|spring|python|课/.test(lower)) content_type = 'learning'
  else if (/会|要|准备|计划|todo/.test(lower)) content_type = 'todo'
  else if (/朋友|吃饭|聊天|社交/.test(lower)) content_type = 'social'
  else if (/项目|设计|工作|完成|database/.test(lower)) content_type = 'work'
  else if (/觉得|感觉|想|心情/.test(lower)) content_type = 'thought'
  if (/开心|不错|完成|好|happy/.test(lower)) mood = ['happy']
  else if (/累|疲惫/.test(lower)) mood = ['tired']
  else if (/焦虑|紧张|担心/.test(lower)) mood = ['anxious']
  else if (/难过/.test(lower)) mood = ['sad']
  keywords = text.split(/[\s,，。.!！?？、]+/).filter(w => w.length > 1).slice(0, 3)
  const title = text.length > 15 ? text.substring(0, 15) + '...' : text
  return { title, content_type, mood, keywords }
}

// Processing animation
const processingStep = ref(-1)
let processingTimer = null

function startProcessing() {
  processingStep.value = 0
  processingTimer = setTimeout(() => { processingStep.value = 1 }, 800)
  setTimeout(() => { processingStep.value = 2 }, 1600)
  setTimeout(() => {
    processingStep.value = 3
    // Transition to review
    const r = record.value
    if (r) {
      const ai = simulateAI(r.content)
      reviewData.value = { ...ai }
      reviewKeywords.value = ai.keywords.join(', ')
      ui.detailMode = 'review'
    }
  }, 2200)
}

watch(() => ui.selectedRecordId, (id) => {
  if (!id) return
  const r = recordsStore.getById(id)
  if (!r) return
  if (r.status === 'processing') {
    ui.detailMode = 'processing'
    startProcessing()
  } else {
    ui.detailMode = 'view'
  }
  reviewData.value = null
})

function close() {
  ui.showDetail = false
  ui.selectedRecordId = null
  reviewData.value = null
  if (processingTimer) clearTimeout(processingTimer)
}

function selectType(type) {
  if (reviewData.value) reviewData.value.content_type = type
}

function toggleMood(mood) {
  if (!reviewData.value) return
  const idx = reviewData.value.mood.indexOf(mood)
  if (idx >= 0) reviewData.value.mood.splice(idx, 1)
  else reviewData.value.mood.push(mood)
}

function confirmReview() {
  if (!reviewData.value || !record.value) return
  const keywords = reviewKeywords.value.split(/[,，]/).map(k => k.trim()).filter(Boolean)
  recordsStore.updateRecord(record.value.id, {
    status: 'done',
    title: reviewData.value.title,
    content_type: reviewData.value.content_type,
    mood: reviewData.value.mood,
    keywords,
    summary: reviewData.value.title,
  })
  reviewData.value = null
  ui.detailMode = 'view'
}
</script>

<template>
  <div v-if="ui.selectedRecordId && record" class="detail-page" :class="{ show: ui.showDetail }">
    <div class="detail-header">
      <button class="detail-back" @click="close">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        返回
      </button>
      <span class="detail-title">
        {{ ui.detailMode === 'processing' ? 'AI 整理中' : ui.detailMode === 'review' ? '审核标签' : '记录详情' }}
      </span>
      <button
        :class="['detail-action', { show: ui.detailMode === 'review' }]"
        @click="confirmReview"
      >确认</button>
    </div>

    <div class="detail-content">
      <!-- Processing View -->
      <div v-if="ui.detailMode === 'processing'" class="processing-view">
        <div class="processing-ring" />
        <div class="processing-title">正在分析你的记录</div>
        <div class="processing-desc">AI 正在理解你的内容，通常需要几秒钟</div>
        <div class="processing-steps">
          <div :class="['processing-step', { active: processingStep === 0, done: processingStep > 0 }]">
            <div class="processing-step-dot" />文本清洗
          </div>
          <div :class="['processing-step', { active: processingStep === 1, done: processingStep > 1 }]">
            <div class="processing-step-dot" />内容分类
          </div>
          <div :class="['processing-step', { active: processingStep === 2, done: processingStep > 2 }]">
            <div class="processing-step-dot" />生成标签
          </div>
        </div>
      </div>

      <!-- Review View -->
      <div v-else-if="ui.detailMode === 'review' && reviewData" class="review-view">
        <div class="review-original">
          <div class="section-label">原始内容</div>
          <div class="review-original-text">{{ record.content }}</div>
        </div>
        <div class="review-card">
          <div class="review-card-title">{{ reviewData.title }}</div>
          <div class="review-field">
            <div class="section-label">内容类型</div>
            <div class="review-field-tags">
              <span
                v-for="t in CONTENT_TYPES"
                :key="t.key"
                :class="['review-tag', { selected: reviewData.content_type === t.key }]"
                @click="selectType(t.key)"
              >{{ t.label }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">情绪状态</div>
            <div class="review-field-tags">
              <span
                v-for="m in ALL_MOODS"
                :key="m.key"
                :class="['review-tag', { selected: reviewData.mood.includes(m.key) }]"
                @click="toggleMood(m.key)"
              >{{ m.label }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">关键词</div>
            <input v-model="reviewKeywords" class="review-keywords-input" />
          </div>
        </div>
      </div>

      <!-- Done/View -->
      <div v-else-if="ui.detailMode === 'view' && record.status === 'done'">
        <div class="review-original">
          <div class="section-label">原始内容</div>
          <div class="review-original-text">{{ record.content }}</div>
        </div>
        <div class="review-card">
          <div class="review-card-title">{{ record.title }}</div>
          <div class="review-field">
            <div class="section-label">类型</div>
            <div class="review-field-tags">
              <span class="tag tag-type">{{ typeMap[record.content_type] || record.content_type }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">情绪</div>
            <div class="review-field-tags">
              <span
                v-for="m in (record.mood || [])"
                :key="m"
                :class="['tag', 'tag-mood', MOOD_COLOR_MAP[m] || '']"
              >{{ moodMap[m] || m }}</span>
            </div>
          </div>
          <div v-if="record.keywords && record.keywords.length" class="review-field">
            <div class="section-label">关键词</div>
            <div class="review-field-tags">
              <span v-for="k in record.keywords" :key="k" class="keyword">#{{ k }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: var(--bg); z-index: 220;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.detail-page.show { transform: translateX(0); }

.detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px;
  background: rgba(245,245,247,0.92);
  backdrop-filter: blur(20px);
  position: sticky; top: 0; z-index: 5;
  border-bottom: 0.5px solid var(--border);
}
.detail-back { display: flex; align-items: center; font-size: 15px; color: var(--accent); background: none; border: none; cursor: pointer; padding: 4px 0; font-family: var(--font); }
.detail-back svg { width: 18px; height: 18px; stroke: var(--accent); }
.detail-title { font-size: 16px; font-weight: 600; flex: 1; }
.detail-action {
  font-size: 14px; font-weight: 600; color: #fff; background: var(--accent);
  border: none; cursor: pointer; padding: 8px 20px;
  border-radius: var(--radius-full); opacity: 0; pointer-events: none;
  transition: all 0.2s; font-family: var(--font);
}
.detail-action.show { opacity: 1; pointer-events: auto; }
.detail-action.show:hover { background: var(--accent-hover); }
.detail-content { padding: 16px; max-width: 640px; }

@media (min-width: 900px) {
  .detail-header { padding: 16px 36px; }
  .detail-content { padding: 24px 36px; max-width: 700px; }
}

/* Processing */
.processing-view { padding: 60px 20px; text-align: center; }
.processing-ring { width: 64px; height: 64px; margin: 0 auto 24px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.processing-title { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
.processing-desc { font-size: 14px; color: var(--text-secondary); }
.processing-steps { margin-top: 32px; text-align: left; max-width: 200px; margin-left: auto; margin-right: auto; }
.processing-step { display: flex; align-items: center; gap: 12px; padding: 10px 0; font-size: 14px; color: var(--text-tertiary); transition: color 0.3s; }
.processing-step.active { color: var(--accent); }
.processing-step.done { color: var(--success); }
.processing-step-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); flex-shrink: 0; transition: background 0.3s; }
.processing-step.active .processing-step-dot { background: var(--accent); animation: dotPulse 1s ease infinite; }
.processing-step.done .processing-step-dot { background: var(--success); }
@keyframes dotPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }

/* Review */
.review-view { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.review-original { background: var(--surface); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px; border: 0.5px solid var(--border); }
.review-original-text { font-size: 14px; color: var(--text-primary); line-height: 1.7; }
.review-card { background: var(--surface); border-radius: var(--radius-md); padding: 20px; margin-bottom: 12px; border: 0.5px solid var(--border); }
.review-card-title { font-size: 16px; font-weight: 600; margin-bottom: 18px; }
.review-field { margin-bottom: 18px; }
.review-field:last-child { margin-bottom: 0; }
.review-field-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.review-tag {
  padding: 7px 16px; border-radius: var(--radius-full); font-size: 13px; font-weight: 500;
  border: 1.5px solid var(--border); background: var(--surface); color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s ease; font-family: var(--font);
}
.review-tag:hover { border-color: var(--text-tertiary); }
.review-tag:active { transform: scale(0.95); }
.review-tag.selected { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
.review-keywords-input {
  width: 100%; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  font-size: 14px; font-family: var(--font); color: var(--text-primary); outline: none; transition: border-color 0.2s;
}
.review-keywords-input:focus { border-color: var(--accent); }

/* Section label (local override) */
.section-label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
</style>
