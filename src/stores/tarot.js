import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { tarotApi as api } from '@/api/tarot'
import { newTarotRequestId, referenceOptions, isAnalyzing } from '@/utils/tarotProtocol'

export const useTarotStore = defineStore('tarot', () => {
  const auth = useAuthStore()
  const cards = ref([]), daily = ref(null), collection = ref(null), preferences = ref(null)
  const reading = ref(null), analysis = ref(null), question = ref('')
  const loading = ref(false), busy = ref(false), saving = ref(false), error = ref(''), notice = ref('')
  let epoch = 0, pendingAnalysis = null, polling = false
  const owner = () => auth.user?.id || ''
  const active = token => token === epoch && !!owner()
  const dailyCard = computed(() => cards.value.find(c => c.id === daily.value?.draw?.card_id))
  const questionCard = computed(() => cards.value.find(c => c.id === reading.value?.card_id))
  const analyzing = computed(() => isAnalyzing(analysis.value))
  const unlocked = computed(() => new Set((collection.value?.entries || []).map(c => c.card_id)))
  watch(() => auth.user?.id, () => {
    epoch++; cards.value = []; daily.value = collection.value = preferences.value = reading.value = analysis.value = null
    question.value = error.value = notice.value = ''; loading.value = busy.value = saving.value = false
    pendingAnalysis = null; polling = false
  }, { flush: 'sync' })
  function requestKey(kind) { return `mirror.tarot.${owner()}.${kind}` }
  function requestId(kind) {
    const key = requestKey(kind)
    let id = sessionStorage.getItem(key)
    if (!id) { id = newTarotRequestId(); sessionStorage.setItem(key, id) }
    return id
  }
  async function load() {
    if (!owner() || loading.value) return
    const token = epoch; loading.value = true; error.value = ''
    try {
      const [catalog, day, collected, prefs, latest] = await Promise.all([api.cards(), api.daily(), api.collection(), api.preferences(), api.latest()])
      if (!active(token)) return
      cards.value = catalog.cards; daily.value = day; collection.value = collected; preferences.value = prefs
      reading.value = latest
      const restored = latest?.latest_analysis_id ? await api.analysis(latest.latest_analysis_id) : null
      if (!active(token)) return
      analysis.value = restored
      if (analysis.value) question.value = analysis.value.question || ''
    } catch (e) { if (active(token)) error.value = e.message }
    finally { if (active(token)) loading.value = false }
  }
  async function refreshDaily() {
    const token = epoch
    const [day, collected] = await Promise.all([api.daily(), api.collection()])
    if (active(token)) { daily.value = day; collection.value = collected }
  }
  async function drawDaily() {
    if (busy.value) return
    const token = epoch, key = requestKey('daily'); busy.value = true; error.value = notice.value = ''
    try {
      const result = await api.draw(requestId('daily'))
      if (!active(token)) return
      sessionStorage.removeItem(key)
      daily.value = result
      notice.value = result.draw?.draw_date !== result.server_date ? '已找回上次抽牌。今天的新牌可以继续抽取。' : result.newly_collected ? '新牌已收入收藏册。' : '今天的牌已确定，明天再来。'
      await refreshDaily()
    } catch (e) { if (active(token)) error.value = `${e.message}。再点一次会找回同一次抽牌。` }
    finally { if (active(token)) busy.value = false }
  }
  async function drawQuestion() {
    if (busy.value || analyzing.value || pendingAnalysis) return
    const token = epoch, key = requestKey('question'); busy.value = true; error.value = notice.value = ''
    try {
      const result = await api.reading(requestId('question'))
      if (!active(token)) return
      sessionStorage.removeItem(key); reading.value = result; analysis.value = null; pendingAnalysis = null
    } catch (e) { if (active(token)) error.value = `${e.message}。重试会找回同一张牌。` }
    finally { if (active(token)) busy.value = false }
  }
  async function savePreferences(next) {
    const token = epoch; saving.value = true; error.value = ''
    try {
      const result = await api.savePreferences({ ...referenceOptions(next), expectedVersion: preferences.value.version })
      if (active(token)) preferences.value = result
    } catch (e) {
      if (active(token)) error.value = e.message
      if (e.code === 409) { const current = await api.preferences(); if (active(token)) preferences.value = current }
    } finally { if (active(token)) saving.value = false }
  }
  async function analyze() {
    if (!reading.value || busy.value || analyzing.value || !question.value.trim()) return
    const token = epoch, readingId = reading.value.reading_id; busy.value = true; error.value = ''
    pendingAnalysis ||= { clientRequestId: newTarotRequestId(), question: question.value.trim(), options: referenceOptions(preferences.value) }
    try {
      const result = await api.analyze(readingId, pendingAnalysis)
      if (!active(token)) return
      analysis.value = result; pendingAnalysis = null
      reading.value.latest_analysis_id = result.analysis_id
    } catch (e) {
      if (!active(token)) return
      if (e.code && e.code < 500) pendingAnalysis = null
      error.value = `${e.message}。牌会保留，重新解读不会换牌。`
      // A response can be lost after the server persisted the job.
      try {
        const latest = await api.getReading(readingId)
        const result = latest.latest_analysis_id ? await api.analysis(latest.latest_analysis_id) : null
        if (active(token) && result && result.analysis_id !== analysis.value?.analysis_id) {
          reading.value = latest; analysis.value = result; pendingAnalysis = null; error.value = ''
        }
      } catch { /* The explicit retry reuses the frozen request. */ }
    } finally { if (active(token)) busy.value = false }
  }
  async function poll() {
    if (!analysis.value || polling) return
    const token = epoch, id = analysis.value.analysis_id; polling = true
    try {
      const result = await api.analysis(id)
      if (active(token) && analysis.value?.analysis_id === id) { analysis.value = result; error.value = '' }
    } catch (e) { if (active(token)) error.value = `${e.message}。连接恢复后会继续读取结果。` }
    finally { if (active(token)) polling = false }
  }
  return { cards, daily, collection, preferences, reading, analysis, question, loading, busy, saving, error, notice,
    dailyCard, questionCard, analyzing, unlocked, load, refreshDaily, drawDaily, drawQuestion, savePreferences, analyze, poll }
})
