<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useAchievementsStore } from '@/stores/achievements'
import { achievementApi } from '@/api/achievements'
import { IS_DEMO_PREVIEW } from '@/preview/mode'
import AchievementMedal from '@/components/molecules/AchievementMedal.vue'
import AchievementRating from '@/components/molecules/AchievementRating.vue'

const emit = defineEmits(['inspect'])
const auth = useAuthStore()
const achievements = useAchievementsStore()
const localPreview = computed(() => IS_DEMO_PREVIEW || achievements.designMode)
const achievementGroups = computed(() => achievements.groups)
const available = computed(() => achievements.catalog.filter(medal => localPreview.value ? !medal.hidden : medal.earned))
const byCode = computed(() => new Map(available.value.map(medal => [medal.code, medal])))
const saved = ref({ capacity: 8, codes: [] })
const editing = ref(false)
const editor = ref(null)
const draftCapacity = ref(8)
const draftCodes = ref([])
const query = ref('')
const group = ref('all')
const choiceLimit = ref(24)
const notice = ref('')
const error = ref('')
const saving = ref(false)
const savedVersion = ref(0)
let generation = 0
let alive = true
const owner = computed(() => auth.user?.id ?? null)
const storageKey = computed(() => owner.value === null ? null : (achievements.designMode ? 'mirror.showcase.design.v2.' : 'mirror.showcase.v1.') + encodeURIComponent(owner.value))
const slots = computed(() => Array.from({ length: saved.value.capacity }, (_, index) => byCode.value.get(saved.value.codes[index]) || null))
const selected = computed(() => draftCodes.value.map(code => byCode.value.get(code)).filter(Boolean))
const overCapacity = computed(() => draftCodes.value.length > draftCapacity.value)
const choices = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return available.value.filter(medal => (group.value === 'all' || medal.group.id === group.value)
    && [medal.name, medal.code, medal.english].join(' ').toLocaleLowerCase().includes(search))
})
const shownChoices = computed(() => choices.value.slice(0, choiceLimit.value))
watch([query, group], () => { choiceLimit.value = 24 })
useDialogFocus(() => editing.value, editor, '.showcase-editor-close', () => { editing.value = false })

function readSaved() {
  saved.value = { capacity: 8, codes: [] }
  if (!storageKey.value) return
  try {
    const value = JSON.parse(localStorage.getItem(storageKey.value) || 'null')
    if (!value || value.version !== 1) return
    const capacity = value.capacity === 10 ? 10 : 8
    const codes = Array.isArray(value.codes) ? [...new Set(value.codes.filter(code => byCode.value.has(code)))].slice(0, capacity) : []
    saved.value = { capacity, codes }
  } catch {
    notice.value = '本机展架暂时无法读取，可以重新布置。'
  }
}
async function loadRemote() {
  const token = generation
  const result = await achievementApi.showcase()
  if (!alive || token !== generation) return false
  // Keep server codes while the independent catalog request is still loading.
  saved.value = { capacity: result.capacity, codes: result.codes }
  savedVersion.value = result.version
  return true
}
watch([owner, () => achievements.designMode], () => {
  generation++
  editing.value = false
  draftCodes.value = []
  saved.value = { capacity: 8, codes: [] }
  savedVersion.value = 0
  saving.value = false
  notice.value = error.value = ''
  if (localPreview.value) readSaved()
  else if (owner.value !== null) {
    const token = generation
    loadRemote().catch(() => { if (alive && token === generation) notice.value = '展架暂时无法读取，请稍后重试。' })
  }
}, { immediate: true, flush: 'sync' })

async function openEditor() {
  if (saving.value) return
  if (!localPreview.value) {
    try { if (!await loadRemote()) return } catch { notice.value = '展架暂时无法读取，请稍后重试。'; return }
  }
  draftCapacity.value = saved.value.capacity
  draftCodes.value = [...saved.value.codes]
  query.value = ''
  group.value = 'all'
  choiceLimit.value = 24
  error.value = ''
  editing.value = true
}
function toggleMedal(code) {
  const index = draftCodes.value.indexOf(code)
  if (index >= 0) draftCodes.value.splice(index, 1)
  else if (draftCodes.value.length < draftCapacity.value) draftCodes.value.push(code)
}
function moveMedal(index, offset) {
  const destination = index + offset
  if (destination < 0 || destination >= draftCodes.value.length) return
  const codes = [...draftCodes.value]
  const [code] = codes.splice(index, 1)
  codes.splice(destination, 0, code)
  draftCodes.value = codes
}
async function save() {
  if (!storageKey.value || overCapacity.value || saving.value) return
  const token = generation
  const next = { capacity: draftCapacity.value, codes: [...draftCodes.value] }
  saving.value = true
  try {
    if (localPreview.value) localStorage.setItem(storageKey.value, JSON.stringify({ version: 1, ...next }))
    else {
      const result = await achievementApi.saveShowcase({ ...next, expectedVersion: savedVersion.value })
      if (!alive || token !== generation) return
      savedVersion.value = result.version
    }
  } catch {
    if (alive && token === generation) error.value = localPreview.value ? '本机保存失败，请检查浏览器存储权限后重试。' : '保存失败或展架已在其他页面更新。请保留当前选择，重新打开后重试。'
    return
  } finally {
    if (token === generation) saving.value = false
  }
  saved.value = next
  notice.value = localPreview.value ? '展架已保存，在当前浏览器中保留。' : '展架已保存到你的账号。'
  editing.value = false
}
function syncFromStorage(event) {
  if (localPreview.value && event.key === storageKey.value && !editing.value) readSaved()
}
onMounted(() => window.addEventListener('storage', syncFromStorage))
onBeforeUnmount(() => { alive = false; generation++; window.removeEventListener('storage', syncFromStorage) })
</script>

<template>
  <section class="achievement-showcase" aria-labelledby="showcase-heading">
    <header class="showcase-heading">
      <div><span>YOUR MEDAL WALL</span><h2 id="showcase-heading">我的展示架 <small>{{ saved.codes.length }} / {{ saved.capacity }}</small></h2></div>
      <button type="button" class="showcase-edit" :disabled="owner === null" @click="openEditor">布置展架 <span aria-hidden="true">↗</span></button>
    </header>
    <div class="showcase-stage" :class="{ 'ten-slots': saved.capacity === 10 }">
      <span class="showcase-stamp" aria-hidden="true">MIRROR / PERSONAL COLLECTION</span>
      <ol class="showcase-grid" :style="{ '--rack-columns': saved.capacity / 2 }">
        <li v-for="(medal, index) in slots" :key="index" class="showcase-slot" :style="{ '--slot-x': index % (saved.capacity / 2) + (index >= saved.capacity / 2 ? .5 : 0), '--slot-row': index >= saved.capacity / 2 ? 1 : 0 }">
          <button type="button" :class="{ filled: medal }" :aria-label="medal ? `第 ${index + 1} 位，查看${medal.name}章面` : `第 ${index + 1} 位，选择展示章面`" @click="medal ? emit('inspect', medal) : openEditor()">
            <span class="showcase-hook" aria-hidden="true" />
            <AchievementMedal v-if="medal" :medal="medal" :preview="localPreview" />
            <span v-else class="showcase-empty" aria-hidden="true">＋<small>{{ String(index + 1).padStart(2, '0') }}</small></span>
            <span class="showcase-slot-code" aria-hidden="true">{{ medal?.code || 'EMPTY' }}</span>
          </button>
        </li>
      </ol>
    </div>
    <p class="showcase-caption">{{ localPreview ? '外观展示 · 挑选喜欢的章面，保存在本机。' : '挑选已获得的成就，布置属于自己的展示架。' }}</p>
    <p v-if="notice" class="showcase-notice" role="status">{{ notice }}</p>
  </section>

  <Teleport to="body">
    <div v-if="editing" class="showcase-backdrop" @click.self="editing = false">
      <section ref="editor" class="showcase-editor" role="dialog" aria-modal="true" aria-labelledby="showcase-editor-heading" aria-describedby="showcase-editor-note" tabindex="-1">
        <header class="showcase-editor-heading">
          <div><span>CURATE YOUR COLLECTION</span><h2 id="showcase-editor-heading">布置展示架</h2></div>
          <button type="button" class="showcase-editor-close" aria-label="取消布置，关闭编辑器" @click="editing = false">×</button>
        </header>
        <div class="showcase-editor-body">
        <p id="showcase-editor-note">{{ localPreview ? '选择喜欢的公开章面进行展示预览，按排列顺序挂上展架。' : '从已获得的成就中选择，按排列顺序挂上展架。' }}</p>
        <div class="showcase-capacity" role="group" aria-label="展示架容量">
          <span>展位</span>
          <button v-for="size in [8, 10]" :key="size" type="button" :aria-pressed="draftCapacity === size" @click="draftCapacity = size">{{ size }} 位</button>
          <b>{{ draftCodes.length }} / {{ draftCapacity }}</b>
        </div>
        <p v-if="overCapacity" class="showcase-error" role="alert">当前选择超过 {{ draftCapacity }} 枚，请移除 {{ draftCodes.length - draftCapacity }} 枚后保存。</p>
        <section class="showcase-chosen" aria-labelledby="showcase-chosen-heading">
          <div class="showcase-section-heading"><h3 id="showcase-chosen-heading">已选 {{ selected.length }} 枚</h3><button type="button" :disabled="!draftCodes.length" @click="draftCodes = []">清空选择</button></div>
          <p v-if="!selected.length" class="showcase-selection-empty">从下方选一枚，放上第一个展位。</p>
          <details v-else class="showcase-order">
            <summary>调整挂放顺序 <span aria-hidden="true">⌄</span></summary>
            <ol>
              <li v-for="(medal, index) in selected" :key="medal.code">
                <span><b>{{ String(index + 1).padStart(2, '0') }}</b> {{ medal.name }}</span>
                <button type="button" :disabled="index === 0" :aria-label="`将${medal.name}前移一位`" @click="moveMedal(index, -1)">↑</button>
                <button type="button" :disabled="index === selected.length - 1" :aria-label="`将${medal.name}后移一位`" @click="moveMedal(index, 1)">↓</button>
                <button type="button" :aria-label="`移除${medal.name}`" @click="toggleMedal(medal.code)">×</button>
              </li>
            </ol>
          </details>
        </section>
        <div class="showcase-picker-filters">
          <label><span>搜索章面</span><input v-model="query" type="search" placeholder="名称、编号或英文" /></label>
          <label><span>功能分类</span><select v-model="group"><option value="all">全部分类</option><option v-for="item in achievementGroups" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
        </div>
        <p v-if="draftCodes.length >= draftCapacity && !overCapacity" class="showcase-limit" role="status">展位已满。移除一枚即可替换。</p>
        <div class="showcase-picker">
          <button v-for="medal in shownChoices" :key="medal.code" type="button" :aria-label="`${medal.name}，${medal.difficulty} 星`" :aria-pressed="draftCodes.includes(medal.code)" :disabled="draftCodes.length >= draftCapacity && !draftCodes.includes(medal.code)" @click="toggleMedal(medal.code)">
            <AchievementMedal :medal="medal" :preview="localPreview" />
            <span>{{ medal.name }}</span><AchievementRating :level="medal.difficulty" />
            <b v-if="draftCodes.includes(medal.code)" class="picker-position" aria-hidden="true">{{ draftCodes.indexOf(medal.code) + 1 }}</b>
          </button>
        </div>
        <button v-if="shownChoices.length < choices.length" type="button" class="showcase-more" @click="choiceLimit += 24">更多章面 · 已显示 {{ shownChoices.length }} / {{ choices.length }} ↓</button>
        <p v-if="!choices.length" class="showcase-selection-empty" role="status">{{ available.length ? '没有匹配的章面。' : '获得第一枚成就后，就可以把它挂在这里。' }}</p>
        <p v-if="error" class="showcase-error" role="alert">{{ error }}</p>
        </div>
        <footer class="showcase-editor-actions">
          <button type="button" @click="editing = false">取消</button>
          <button type="button" class="showcase-save" :disabled="saving || overCapacity || owner === null" @click="save">{{ saving ? '保存中…' : '保存布置 ↗' }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.achievement-showcase { margin: 4px 0 21px; }
.showcase-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
.showcase-heading > div > span, .showcase-editor-heading > div > span { color: #a4f0f5; font: italic 800 11px var(--font-display); letter-spacing: .14em; }
.showcase-heading h2 { font-size: 24px; line-height: 1.2; margin-top: 4px; }
.showcase-heading h2 small { color: #cde8a4; font: italic 800 15px var(--font-display); margin-left: 7px; }
.showcase-edit, .showcase-save { position: relative; isolation: isolate; min-height: 44px; padding: 8px 13px; color: #0b2040; font-size: 13px; font-weight: 850; }
.showcase-edit::before, .showcase-save::before { content: ''; position: absolute; z-index: -1; inset: 2px 0; background: #e0f398; clip-path: polygon(7px 0,100% 5%,calc(100% - 7px) 100%,0 95%); }
.showcase-edit { transform: rotate(-2deg); }
.showcase-stage { position: relative; isolation: isolate; padding: 24px 28px 17px; }
.showcase-stage::before, .showcase-stage::after { content: ''; position: absolute; z-index: -1; pointer-events: none; }
.showcase-stage::before { inset: 3px 2px 7px 0; background: linear-gradient(130deg,#153c6dbf,#071b40e8); clip-path: polygon(1% 1%,100% 0,98% 98%,0 100%); }
.showcase-stage::after { inset: 0 5% 0 11%; background: repeating-linear-gradient(115deg,transparent 0 19px,#9bf0ef0b 19px 20px); }
.showcase-stamp { display: block; margin: 0 0 4px; color: #8ab2d6; font: 700 9px var(--font-display); letter-spacing: .2em; }
.showcase-grid { position: relative; width: 100%; max-width: 500px; aspect-ratio: calc((var(--rack-columns) + .5) * .8660254 / 1.75); margin: 9px auto 0; padding: 0; list-style: none; }
.ten-slots .showcase-grid { max-width: 620px; }
.showcase-slot { position: absolute; width: calc(100% / (var(--rack-columns) + .5)); height: calc(100% / 1.75); left: calc(100% * var(--slot-x) / (var(--rack-columns) + .5)); top: calc(100% * var(--slot-row) * .75 / 1.75); min-width: 0; text-align: center; pointer-events: none; }
.showcase-slot > button { position: relative; isolation: isolate; display: grid; place-items: center; width: 100%; height: 100%; min-height: 44px; padding: 8% 8% 14%; color: #a7cee5; pointer-events: auto; clip-path: polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
.showcase-slot > button::before, .showcase-slot > button::after { content: ''; position: absolute; z-index: -1; inset: 0; clip-path: polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); transition: background .22s; }
.showcase-slot > button::before { background: #5984a882; }
.showcase-slot > button::after { inset: 1px; background: #0a2145; }
.showcase-slot > button.filled::after { background: radial-gradient(ellipse at 50% 20%,#356895,#0b2648 72%); }
.showcase-slot :deep(.medal-surface) { width: 100%; filter: drop-shadow(2px 4px 0 #020c2580); transition: transform .28s var(--motion-enter); }
.showcase-hook { position: absolute; width: 5px; height: 5px; top: 5%; border-radius: 50%; border: 1px solid #a8d4e0; background: #0a1836; }
.showcase-empty { display: flex; flex-direction: column; align-items: center; font: 400 25px var(--font-display); line-height: 1.2; color: #73a4c3; }
.showcase-empty small { font: 700 10px var(--font-display); letter-spacing: .1em; }
.showcase-slot-code { position: absolute; bottom: 11%; left: 0; right: 0; pointer-events: none; color: #a9c7de; font: 700 9px var(--font-display); letter-spacing: .12em; }
.showcase-slot > button:focus-visible::before { background: white; }
.showcase-slot > button:focus-visible::after { inset: 3px; }
.showcase-caption, .showcase-notice { color: #c1d5ed; font-size: 11px; margin-top: 4px; }
.showcase-notice { color: #def69b; }
.showcase-backdrop { position: fixed; inset: 0; z-index: 1140; display: grid; place-items: center; padding: 16px; background: #030a20cc; backdrop-filter: blur(12px); }
.showcase-editor { display: flex; flex-direction: column; width: min(100%,790px); max-height: calc(100dvh - 32px); overflow: hidden; padding: 20px 22px 0; border-top: 3px solid #7fe4f2; color: #eef7ff; background: #0b2148; box-shadow: 8px 8px 0 #030c2b; outline: none; }
.showcase-editor-body { min-height: 0; overflow: auto; overscroll-behavior: contain; scroll-padding-block: 12px; padding-right: 3px; }
.showcase-editor-heading { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 4px; }
.showcase-editor-heading h2 { font-size: 26px; line-height: 1.2; }
.showcase-editor-close { width: 44px; height: 44px; flex: none; font-size: 28px; border: 1px solid #86a9d0; border-radius: 50%; }
#showcase-editor-note { margin: 12px 0; color: #bfd6f1; font-size: 13px; }
.showcase-capacity { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.showcase-capacity > button { min-width: 58px; min-height: 44px; border: 1px solid #5388ae; color: #e9f6ff; }
.showcase-capacity > button[aria-pressed=true] { background: #9ae9ed; color: #0c1d3a; border-color: #9ae9ed; }
.showcase-capacity > b { margin-left: auto; font: italic 800 20px var(--font-display); color: #dff49b; }
.showcase-chosen { margin: 14px 0; }
.showcase-section-heading { display: flex; align-items: center; justify-content: space-between; }
.showcase-section-heading h3 { font-size: 14px; }
.showcase-section-heading button { min-height: 44px; font-size: 12px; color: #a7dce9; }
.showcase-chosen ol { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 3px 14px; padding: 0; list-style: none; }
.showcase-chosen li { display: grid; grid-template-columns: minmax(0,1fr) repeat(3,44px); align-items: center; border-bottom: 1px solid #5984ad54; }
.showcase-chosen li > span { min-width: 0; font-size: 12px; overflow-wrap: anywhere; }
.showcase-chosen li b { font: 800 12px var(--font-display); color: #83d7e4; margin-right: 3px; }
.showcase-chosen li button { width: 44px; height: 44px; color: #c6e8f4; font-size: 18px; }
.showcase-order > summary { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 5px 9px; background: #19395b; font-size: 12px; cursor: pointer; list-style: none; }
.showcase-order > summary::-webkit-details-marker { display: none; }
.showcase-order > summary span { color: #90dce9; font-size: 18px; transition: transform .18s; }
.showcase-order[open] > summary span { transform: rotate(180deg); }
.showcase-editor button:disabled { opacity: .4; cursor: not-allowed; }
.showcase-picker-filters { display: grid; grid-template-columns: minmax(0,1fr) minmax(130px,.55fr); gap: 10px; margin: 15px 0 12px; }
.showcase-picker-filters label { display: flex; flex-direction: column; min-width: 0; gap: 4px; font-size: 11px; color: #b9d7ef; }
.showcase-picker-filters :is(input,select) { min-width: 0; width: 100%; height: 44px; padding: 7px 9px; color: #f2f7ff; border: 1px solid #6391b7; background: #071836; border-radius: 0; font-size: 13px; }
.showcase-picker { display: grid; grid-template-columns: repeat(auto-fill,minmax(105px,1fr)); gap: 9px; }
.showcase-picker > button { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 4px; min-width: 0; padding: 9px; color: #e7f3ff; border: 1px solid #3a5b83; background: #102e56; font-size: 12px; }
.showcase-picker > button[aria-pressed=true] { border-color: #dff49b; background: #25435d; }
.showcase-more { display: block; width: 100%; min-height: 44px; margin-top: 8px; color: #a9e6f0; font-size: 12px; border-bottom: 1px solid #376087; }
.showcase-picker :deep(.medal-surface) { max-width: 100px; }
.picker-position { position: absolute; left: 4px; top: 4px; display: grid; place-items: center; min-width: 24px; height: 24px; background: #dff49b; color: #15243c; font: 800 14px var(--font-display); }
.showcase-selection-empty, .showcase-limit { padding: 10px 0; color: #bfd6ed; font-size: 12px; }
.showcase-error { margin: 10px 0; padding: 8px 10px; border-left: 3px solid #ff94bd; background: #502747; color: #ffdfef; font-size: 13px; }
.showcase-editor-actions { flex: none; display: flex; justify-content: end; gap: 10px; padding: 12px 0 15px; margin-top: 12px; background: #0b2148f7; border-top: 1px solid #3b618b; }
.showcase-editor-actions > button { min-height: 44px; padding: 7px 16px; font-size: 13px; }
.achievement-showcase button:focus-visible, .showcase-editor :is(button,input,select,summary):focus-visible { outline: 2px solid white; outline-offset: 2px; }
@media (hover: hover) {
  .showcase-slot > button:hover::before { background: #b8f0e7; }
  .showcase-slot > button:hover :deep(.medal-surface) { transform: translateY(-3px) rotate(-3deg); }
}
@container (max-width: 480px) {
  .showcase-heading h2 { font-size: 21px; }
  .showcase-stage { padding: 17px 10px 12px; }
  .showcase-empty { font-size: 20px; }
  .showcase-slot-code { font-size: 8px; letter-spacing: .05em; }
}
@media (max-width: 650px) {
  .showcase-editor { padding-inline: 15px; }
  .showcase-chosen ol { grid-template-columns: minmax(0,1fr); }
  .showcase-picker { grid-template-columns: repeat(3,minmax(0,1fr)); }
  .showcase-picker > button { padding: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .showcase-slot > button::before, .showcase-slot > button::after, .showcase-slot :deep(.medal-surface), .showcase-order > summary span { transition: none; }
}
</style>
