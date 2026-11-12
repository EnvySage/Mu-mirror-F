import { reportAchievementActivity } from '@/api/achievements'
import { vReadEnd } from '@/composables/useReadingEnd'
import PageMasthead from '@/components/molecules/PageMasthead.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useGlossaryStore } from '@/stores/glossary'
import { useUIStore } from '@/stores/ui'
import { exportData } from '@/api/export'
import SettingsItem from '@/components/molecules/SettingsItem.vue'
import TermCard from '@/components/molecules/TermCard.vue'
import SelectMenu from '@/components/atoms/SelectMenu.vue'
import { usePresentationMode } from '@/composables/usePresentationMode'
import { prefersReducedMotion } from '@/motion/core'
import { usePaperEntrance } from '@/motion/usePaperEntrance'

export function useSettingsView() {
const router = useRouter()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const toast = useToastStore()
const glossary = useGlossaryStore()
const ui = useUIStore()
const presentation = usePresentationMode()
const homePage = ref(localStorage.getItem('mirror.home-page') || 'auto')
const scrollArea = ref(null)
usePaperEntrance(scrollArea, () => true, '.settings-identity, .settings-group')
const activeSection = ref('settings-presentation')
const sections = [
  ['presentation', 'DISPLAY', '页面呈现'], ['model', 'CONNECTION', '模型中心'],
  ['authorization', 'PERMISSION', 'AI 使用与授权'],
  ['glossary', 'LEXICON', '个人词典'], ['memory', 'MEMORY', '镜子的记忆'], ['data', 'ARCHIVE', '数据与账号'],
]
function trackSection() {
  const root = scrollArea.value
  if (!root) return
  const top = root.getBoundingClientRect().top + Math.min(200, root.clientHeight * .35)
  const groups = [...root.querySelectorAll('.settings-group')]
  activeSection.value = (groups.filter(el => el.getBoundingClientRect().top <= top).at(-1) || groups[0])?.id
}
function jumpSection(id) {
  const root = scrollArea.value
  const target = root?.querySelector('#' + id)
  if (!target) return
  activeSection.value = id
  root.scrollTo({ top: root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 22, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
}

function setHomePage(value) {
  const previous = homePage.value
  if (value === previous) return
  try {
    if (value === 'auto') localStorage.removeItem('mirror.home-page')
    else localStorage.setItem('mirror.home-page', value)
  } catch { toast.error('浏览器暂时无法保存首页设置'); return }
  homePage.value = value
  if (value !== 'auto') reportAchievementActivity('home.changed', value, previous)
}

// ==================== 个人词典（lexicon-design.md 5b） ====================

/** 已忽略组折叠态 */
const dismissedOpen = ref(false)
/** 已生效组折叠态：默认收起——词典卡是管理入口不是阅读页，整卡长度不该随词条数无上限拉长 */
const confirmedOpen = ref(false)
/** 「教镜子一个词」空表单展开态 */
const addOpen = ref(false)
const addDraft = ref({ term: '', aliasesText: '', description: '' })
/** 正在操作（确认/保存）的词条 id */
const busyTermId = ref(null)

onMounted(() => {
  settingsStore.fetchSettings()
  // 词条三组：设置图标角标 + 词典卡共用同一 store（MainLayout 不重复拉）
  glossary.fetch()
})

/** 词条操作统一收口：成功 toast 分文案，失败透 store.error */
async function runTermAction(id, action, payload, successMsg) {
  busyTermId.value = id
  const ok = action === 'update' ? await glossary.update(id, payload) : await glossary[action](id)
  busyTermId.value = null
  if (ok) toast.success(successMsg)
  else toast.error(glossary.error || '操作失败')
  return ok
}

/** 待确认：确认（词条卡确认按钮） */
function onTermConfirm(term) {
  runTermAction(term.id, 'confirm', null, `「${term.term}」已生效 · 下次对话开始使用`)
}

/** 改一改/编辑：保存（原地展开编辑框，PUT） */
function onTermSave(term, data) {
  runTermAction(term.id, 'update', data, '已更新')
}

/** 不要/删除按钮：待确认与已生效 = 忽略（dismiss 沉底不删行），已忽略组 = 真删除 */
function onTermDismiss(term) {
  if (term.status === 'dismissed') {
    runTermAction(term.id, 'remove', null, `「${term.term}」已删除`)
  } else {
    runTermAction(term.id, 'dismiss', null, `「${term.term}」已忽略 · 30 天后可能重新浮现`)
  }
}

/** 已忽略 → 恢复（重新确认进已生效） */
function onTermRestore(term) {
  runTermAction(term.id, 'confirm', null, `「${term.term}」已恢复生效`)
}

/** 「依据：查看原文」（设置页确认弹窗里该行隐藏，防御性兜底）
 *
 * 用 source_record_id（records 主键）——详情面板按 records.id 查，传 chunks 主键会翻错记录。
 */
function onTermOpenSource(term) {
  if (term.source_record_id == null) return
  ui.openRecordWithActivity(term.source_record_id, { kind: 'glossary.source_opened', subjectId: term.id, otherId: term.source_record_id })
}

/** 教镜子一个词：空表单新增（POST，直接 confirmed） */
async function submitAdd() {
  const { term, aliasesText, description } = addDraft.value
  if (!term.trim() || !description.trim()) {
    toast.warning('词条和理解说明都要填')
    return
  }
  const aliases = aliasesText.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean)
  const ok = await glossary.add({ term: term.trim(), aliases, description: description.trim() })
  if (ok) {
    toast.success(`「${term.trim()}」已教给镜子 · 下次对话开始使用`)
    addOpen.value = false
    addDraft.value = { term: '', aliasesText: '', description: '' }
  } else {
    toast.error(glossary.error || '新增失败')
  }
}

/** 手动触发抽取（懒人立即出候选，POST /glossary/extract） */
async function handleExtract() {
  const ok = await glossary.extract()
  if (ok) {
    toast.success(glossary.pending.length
      ? `抽取完成 · ${glossary.pending.length} 条候选待确认`
      : '抽取完成 · 近 14 天语料没有新候选')
  } else {
    toast.error(glossary.error || '抽取失败')
  }
}

/** rag_half_life 滑块（7-365，默认 30，6.4） */
const halfLifeDraft = ref(30)
const halfLifeEditing = ref(false)
const halfLifeValue = computed(() => Number(settingsStore.settings.rag_half_life) || 30)
const effectiveHalfLife = computed(() => (halfLifeEditing.value ? halfLifeDraft.value : halfLifeValue.value))

/** mirror_lookback 回看深度（0-3，默认 1，rolling-mirror-design.md §2）：选中即保存（同 chips/toggle 模式） */
const lookbackOptions = [
  { value: 0, label: '只继承上月镜子', desc: '最省 · 生成时只带上月镜子全文，不翻原文' },
  { value: 1, label: '带上月原文', desc: '推荐 · 上月镜子 + 上月原文一起给 AI' },
  { value: 2, label: '带近三月原文', desc: '上月镜子 + 近三个月的原文' },
  { value: 3, label: '全部原文', desc: '慢 · 带全部历史原文，记录多时消耗大' },
]
/** 触发器/菜单项显示形如 "1 = 带上月原文"，desc 作为菜单里的副行说明 */
const lookbackSelectOptions = computed(() => lookbackOptions.map(o => ({
  value: o.value,
  label: `${o.value} = ${o.label}`,
  desc: o.desc,
})))
const lookbackSaving = ref(false)
const lookbackValue = computed(() => {
  const raw = settingsStore.settings.mirror_lookback
  if (raw == null) return 1 // Number(null)=0 的坑：null/undefined 直接走默认，不进数值判定
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 3 ? n : 1
})

async function onLookbackChange(val) {
  const next = Number(val)
  if (next === lookbackValue.value || lookbackSaving.value) return
  lookbackSaving.value = true
  const ok = await settingsStore.updateSettings({ mirror_lookback: next })
  lookbackSaving.value = false
  if (ok) toast.success('已保存回看深度')
  else toast.error(settingsStore.error || '保存失败')
}

async function setDefaultRecordMode(mode) {
  if (settingsStore.settings.default_record_mode === mode) return
  const ok = await settingsStore.updateSettings({ defaultRecordMode: mode })
  if (ok) toast.success(mode === 'AI_ASSISTED' ? '新记录默认由 AI 准备候选' : '新记录默认仅保存')
  else toast.error(settingsStore.error || '保存失败')
}

async function saveHalfLife() {
  const ok = await settingsStore.updateSettings({ rag_half_life: halfLifeDraft.value })
  if (ok) {
    toast.success('已保存检索时间衰减参数')
    halfLifeEditing.value = false
  } else {
    toast.error(settingsStore.error || '保存失败')
  }
}

/** 衰减权重预览 final_score = 相似度 × 1/(1 + 天数差/half_life) */
const halfLifePreview = computed(() =>
  `记录经过 ${effectiveHalfLife.value} 天后，时间权重降为当天的一半。数值越大，越重视较早的经历。`
)

/** 导出（GET /api/export/json | /api/export/markdown，blob 下载） */
const exportingKind = ref('')
async function handleExport(kind) {
  if (exportingKind.value) return
  exportingKind.value = kind
  const result = await exportData(kind === 'JSON' ? 'json' : 'markdown')
  exportingKind.value = ''
  result.ok ? toast.success(result.message) : toast.error(result.message)
}

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    auth.logout()
    router.push('/auth/login')
  }
}

return { reportAchievementActivity, vReadEnd, PageMasthead, ref, SettingsItem, TermCard, SelectMenu, router, settingsStore, auth, glossary, presentation, homePage, scrollArea, activeSection, sections, trackSection, jumpSection, setHomePage, dismissedOpen, confirmedOpen, addOpen, addDraft, busyTermId, onTermConfirm, onTermSave, onTermDismiss, onTermRestore, onTermOpenSource, submitAdd, handleExtract, halfLifeDraft, halfLifeEditing, halfLifeValue, effectiveHalfLife, lookbackSelectOptions, lookbackSaving, lookbackValue, onLookbackChange, setDefaultRecordMode, saveHalfLife, halfLifePreview, exportingKind, handleExport, handleLogout }
}
