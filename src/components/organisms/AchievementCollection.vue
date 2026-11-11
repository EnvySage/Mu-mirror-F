<script setup>
import { computed, onMounted, ref, useId, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { achievementDifficulties, dialogueAchievement } from '@/constants/achievements'
import { useAchievementsStore } from '@/stores/achievements'
import { achievementSets } from '@/preview/achievementSets'
import AchievementMedal from '@/components/molecules/AchievementMedal.vue'
import AchievementRating from '@/components/molecules/AchievementRating.vue'
import AchievementDialog from '@/components/organisms/AchievementDialog.vue'
import AchievementShowcase from '@/components/organisms/AchievementShowcase.vue'

const auth = useAuthStore()
const store = useAchievementsStore()
const achievements = computed(() => store.catalog)
const achievementGroups = computed(() => store.groups)
onMounted(() => store.load())
const filter = ref('all')
const query = ref('')
const kind = ref('all')
const difficulties = ref([1, 2, 3])
const filtersOpen = ref(false)
const filterToggle = ref(null)
const filterPanelId = `achievement-filters-${useId()}`
const expanded = ref(new Set(store.designMode ? ['R'] : []))
const selected = ref(null)
const reveal = ref(false)
const descriptions = {
  M: '接通模型，建立属于你的连接。',
  R: '把日常写下，让生活留下痕迹。',
  D: '在一问一答之间听见回响。',
  K: '整理记忆，让镜子理解你的词语。',
  P: '登记计划，让建议成为行动。',
  C: '翻过日历，重新遇见过去的片段。',
  REF: '生成和对比不同时刻的自己。',
  T: '每日一张，收藏偶然的相遇。',
  V: '收纳文件与素材，找回需要的线索。',
  G: '定义成长维度，记录具体的进步。',
  S: '从情绪、类型和数据中看见生活。',
  SYS: '按自己的习惯布置个人空间。',
}
const filtering = computed(() => filter.value !== 'all' || kind.value !== 'all' || query.value.trim() || difficulties.value.length !== 3)
const activeFilterCount = computed(() => Number(filter.value !== 'all') + Number(kind.value !== 'all') + Number(!!query.value.trim()) + Number(difficulties.value.length !== 3))
const filterSummary = computed(() => [
  query.value.trim() ? `搜索「${query.value.trim().slice(0, 18)}」` : '',
  filter.value !== 'all' ? achievementGroups.value.find(group => group.id === filter.value)?.label : '',
  { starter: '新手启程', plating: '可镀层', plated: '已镀层', hidden: '隐藏成就' }[kind.value],
  difficulties.value.length !== 3 ? `难度 ${[...difficulties.value].sort().join(' / ') || '未选择'}` : '',
].filter(Boolean).join(' · '))
const visibleMedals = computed(() => achievements.value.filter(medal => {
  const search = query.value.trim().toLocaleLowerCase()
  const text = medal.hidden && !medal.earned ? '隐藏成就 CLASSIFIED' : [medal.code, medal.name, medal.english, medal.condition].join(' ')
  return (filter.value === 'all' || medal.group.id === filter.value)
    && (kind.value === 'all' || (kind.value === 'starter' ? medal.starter : kind.value === 'plating' ? medal.plating : kind.value === 'plated' ? medal.plated : medal.hidden))
    && difficulties.value.includes(medal.difficulty)
    && text.toLocaleLowerCase().includes(search)
}))
const visibleGroups = computed(() => achievementGroups.value
  .map(group => ({ ...group, set: achievementSets.find(set => set.id === group.id), medals: visibleMedals.value.filter(medal => medal.group.id === group.id), total: achievements.value.filter(medal => medal.group.id === group.id).length,
    earned: achievements.value.filter(medal => medal.group.id === group.id && medal.earned).length,
    plated: achievements.value.filter(medal => medal.group.id === group.id && medal.plated).length }))
  .filter(group => group.medals.length))
watch([query, filter, kind], () => {
  if (query.value.trim() || filter.value !== 'all' || kind.value !== 'all') expandMatches()
})

function toggleDifficulty(level) {
  difficulties.value = difficulties.value.includes(level) ? difficulties.value.filter(item => item !== level) : [...difficulties.value, level]
}
function resetFilters() {
  query.value = ''
  filter.value = kind.value = 'all'
  difficulties.value = [1, 2, 3]
}
function closeFilters() {
  filtersOpen.value = false
  filterToggle.value?.focus()
}
function expandMatches() {
  expanded.value = new Set(visibleGroups.value.map(group => group.id))
}
function syncExpanded(event, id) {
  const next = new Set(expanded.value)
  if (event.target.open) next.add(id)
  else next.delete(id)
  expanded.value = next
}

function closeMedal() {
  selected.value = null
  reveal.value = false
}
function previewDialogue() {
  selected.value = achievements.value.find(item => item.code === 'D-01') || dialogueAchievement
  reveal.value = true
}
watch(() => auth.user?.id, () => { closeMedal(); store.load() })
watch(() => store.designMode, () => { closeMedal(); resetFilters(); filtersOpen.value = false; expanded.value = new Set(store.designMode ? ['R'] : []) })
</script>

<template>
  <section class="achievement-hall" aria-label="成就章展区">
    <div class="edition-switch">
      <p>{{ store.designMode ? '新版章集预览 · 12 套 × 8 枚 · 24 枚支持镀层' : '我的账号成就' }}<small v-if="store.designMode">获得与镀层状态为演示，不计入账号进度。点开“可镀层”的章比较两种外观。</small></p>
      <button type="button" :aria-pressed="store.designMode" @click="store.designMode = !store.designMode">{{ store.designMode ? '返回当前图鉴' : '查看新版章集' }}</button>
    </div>
    <p v-if="store.loading && !achievements.length" role="status">正在读取成就…</p>
    <div v-else-if="store.error && !achievements.length" role="alert">{{ store.error }} <button type="button" @click="store.load()">重新加载</button></div>
    <AchievementShowcase v-else @inspect="selected = $event" />

    <header class="achievement-shelf">
      <div><span>ETCHED MEDAL INDEX</span><h2>成就图鉴</h2></div>
      <button type="button" class="feature-play" @click="previewDialogue"><span aria-hidden="true">▶</span> 首次对话解锁预览</button>
    </header>
    <div class="achievement-result-tools">
      <span class="filter-count" role="status"><b>{{ visibleMedals.length }}</b> / {{ achievements.length }} 枚 <span>{{ visibleGroups.length }} 个章集</span></span>
      <div class="catalog-actions">
        <button ref="filterToggle" type="button" class="filter-toggle" :aria-expanded="filtersOpen" :aria-controls="filterPanelId" @click="filtersOpen = !filtersOpen" @keydown.esc.stop.prevent="closeFilters">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M5 10h10M8 15h4" /></svg>
          {{ filtersOpen ? '收起筛选' : '筛选' }}<b v-if="activeFilterCount">{{ activeFilterCount }}</b><i aria-hidden="true">{{ filtersOpen ? '−' : '+' }}</i>
        </button>
        <button v-if="filtering" type="button" @click="resetFilters">重置</button>
        <button type="button" :disabled="!visibleGroups.length" @click="expandMatches">展开章集</button>
        <button type="button" @click="expanded = new Set()">全部收起</button>
      </div>
    </div>
    <p v-if="filtering && !filtersOpen" class="active-filter-summary">{{ filterSummary }}</p>
    <Transition name="filter-fold">
    <div v-if="filtersOpen" :id="filterPanelId" class="filter-fold" @keydown.esc.stop.prevent="closeFilters">
    <div class="filter-fold-clip">
    <div class="achievement-filters" role="search" aria-label="筛选成就图鉴">
      <div class="achievement-search">
        <label class="medal-search-input"><span>搜索成就</span><input v-model="query" type="search" placeholder="名称、编号或获得条件" /></label>
        <label><span>功能分类</span>
          <select v-model="filter">
            <option value="all">全部成就</option>
            <option v-for="group in achievementGroups" :key="group.id" :value="group.id">{{ group.label }}</option>
          </select>
        </label>
        <label><span>特别选择</span>
          <select v-model="kind"><option value="all">全部类型</option><option value="starter">新手启程</option><option value="plating">可镀层</option><option value="plated">已镀层</option><option value="hidden">隐藏成就</option></select>
        </label>
      </div>
      <div class="difficulty-filters" role="group" aria-label="难度筛选">
        <span>难度</span>
        <button type="button" class="difficulty-all" @click="difficulties = [1, 2, 3]">全选</button>
        <button type="button" class="difficulty-all" @click="difficulties = []">清空</button>
        <button v-for="difficulty in achievementDifficulties" :key="difficulty.level" type="button" :aria-pressed="difficulties.includes(difficulty.level)" :title="difficulty.description" @click="toggleDifficulty(difficulty.level)">
          <AchievementRating :level="difficulty.level" label />
        </button>
      </div>
      <p class="difficulty-legend">★ 一次体验　★★ 累计或多步操作　★★★ 长期积累或高门槛收藏</p>
    </div>
    </div>
    </div>
    </Transition>
    <div class="medal-categories">
      <details v-for="group in visibleGroups" :key="group.id" class="medal-category" :style="{ '--room-ink': group.ink }" :open="expanded.has(group.id)" @toggle="syncExpanded($event, group.id)">
        <summary>
          <span class="category-chevron" aria-hidden="true">›</span>
          <span class="category-code">{{ group.id }}</span>
          <h3>{{ store.designMode ? group.set.name : group.label }}<small>{{ group.medals.length }} / {{ group.total }}</small></h3>
          <span class="category-description">{{ store.designMode ? group.set.description : descriptions[group.id] }}</span>
        </summary>
        <div v-if="store.designMode && expanded.has(group.id)" class="set-progress"><span>已获得 {{ group.earned }} / 8</span><meter :value="group.earned" min="0" max="8" :aria-label="`${group.set.name}已获得 ${group.earned} 枚，共 8 枚`" /><span>镜闪 {{ group.plated }} 枚</span></div>
        <ul v-if="expanded.has(group.id)" class="medal-entries">
          <li v-for="(medal, index) in group.medals" :key="medal.code" :style="{ '--entry-delay': `${index * 18}ms` }">
            <button type="button" class="medal-entry" :class="{ 'entry-earned': medal.earned, 'entry-plated': medal.plated }" :style="{ '--badge-ink': medal.group.ink }" @click="selected = medal">
              <span class="entry-band"><span>{{ medal.hidden && !medal.earned ? '???' : medal.code }}</span><AchievementRating :level="medal.difficulty" /></span>
              <span class="tile-art"><AchievementMedal :medal="medal" :concealed="medal.hidden && !medal.earned" /></span>
              <span class="entry-copy">
                <span class="entry-heading"><strong>{{ medal.hidden && !medal.earned ? '隐藏成就' : medal.name }}</strong></span>
                <span class="tile-code">{{ medal.hidden && !medal.earned ? 'CLASSIFIED' : medal.english }}</span>
                <span class="entry-condition">{{ medal.hidden && !medal.earned ? '获得后揭晓章面和解锁条件。' : medal.condition }}</span>
                <span class="entry-footer"><span class="tile-status">{{ medal.earned ? '✓ 已获得' : medal.hidden ? '待揭晓' : '未解锁' }}</span><span v-if="medal.plating" class="plating-mark">✧ {{ medal.plated ? '镜闪' : '可镀层' }}</span></span>
              </span>
              <span class="entry-corner" aria-hidden="true">↗</span>
            </button>
          </li>
        </ul>
      </details>
    </div>
    <div v-if="!visibleMedals.length" class="medal-no-results" role="status"><p>没有符合当前条件的成就。</p><button type="button" @click="resetFilters">重置筛选 ↻</button></div>
    <AchievementDialog :medal="selected" :reveal="reveal" @close="closeMedal" @preview="previewDialogue" />
  </section>
</template>

<style scoped src="@/assets/styles/achievement-collection.css"></style>
