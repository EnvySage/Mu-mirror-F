import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getPendingSuggestions as apiGetPendingSuggestions,
  resolveSuggestion as apiResolveSuggestion,
  setTodoStatus as apiSetTodoStatus,
  getTodos as apiGetTodos,
  getOpenChains as apiGetOpenChains,
} from '@/api/todo'
import { useStatsStore } from '@/stores/stats'

/**
 * 待办登记表 store（todo-registry-design.md §3.3 裁决期 / §4 F 行）
 *
 * 独立于 stats 的理由：stats 是读聚合（GET /mirror/stats），本 store 有写操作
 * （resolve/setTodoStatus），职责不同不并入。
 *
 * 数据来源：B 端点四件套（GET /todos/pending-suggestions、POST /todos/suggestions/{id}/resolve、
 * PUT /todos/{id}/status、GET /todos），见 api/todo.js。
 *
 * 写操作策略：乐观更新 + 失败回滚 + toast 反馈（成功 toast 由调用方发，
 * store 只负责数据一致性——失败时还原本地状态并把错误写进 error）。
 *
 * 字段口径（后端 camelCase，经 request.js 拦截器转 snake_case；证据为平铺字段）：
 * @typedef {Object} TodoSuggestion
 * @property {number|string} id             建议 id（裁决端点路径参数）
 * @property {number|string} todo_id        关联登记表条目 id
 * @property {string} title                 待办标题
 * @property {'not_started'|'in_progress'|'completed'} current_status
 * @property {'not_started'|'in_progress'|'completed'} suggested_status
 * @property {string} evidence_excerpt      证据摘录
 * @property {number|string} evidence_record_id  证据所在记录 id（跳记录详情）
 * @property {string} created_at
 *
 * @typedef {Object} TodoEntry
 * @property {number|string} id            todo_registry.id（直调端点目标）
 * @property {string} title
 * @property {'not_started'|'in_progress'|'completed'} current_status
 * @property {string} [source_chunk_id]
 * @property {number|string} [record_id]   来源记录（跳记录详情；联调字段需求）
 */

/** 三态合法值（防脏数据进本地缓存） */
const VALID_STATUSES = ['not_started', 'in_progress', 'completed']

/**
 * chains 专用 mock 开关（R17）：B 的 GET /todos/open-chain 并行开发中，mock 先行；
 * 建议/条目/直调三端点已上线走真接口，不受此开关影响。端点 ready 后置 false。
 */
const USE_MOCK_CHAINS = true

/** mock 延迟（ms） */
const MOCK_CHAIN_DELAY = 200

/** x天前（yyyy-MM-dd HH:mm:ss，与后端时间口径同构；mock 用） */
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const p = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`
}

/**
 * mock 证据链（走查口径）：2 条带 1-2 evidence 的链 + 1 条仅 origin；
 * todo_id 与走查注入的 pending 建议（101/102）及 /todos 条目对齐，
 * 建议 todo_id=999 刻意不在此列——orphan 降级路径的验证样本。
 * 字段 snake_case（与 request.js 拦截器输出一致；契约原文 camelCase 见 api/todo.js）
 */
function buildMockChains() {
  return [
    {
      todo_id: 102,
      title: '投递两份简历',
      current_status: 'in_progress',
      created_at: daysAgo(6),
      origin: { chunk_id: 9011, record_id: 9102, excerpt: '本周把简历和作品集改一版，目标投两家', date: daysAgo(6) },
      evidence: [
        { chunk_id: 9012, record_id: 9106, excerpt: 'A 公司约了下周一面，B 公司还在等回复', date: daysAgo(2), confirmed_at: daysAgo(1) },
      ],
      pending_suggestion_count: 1,
    },
    {
      todo_id: 103,
      title: '预约周四体检',
      current_status: 'not_started',
      created_at: daysAgo(3),
      origin: { chunk_id: 9013, record_id: 9103, excerpt: '医院体检套餐有活动，周四之前得约上', date: daysAgo(3) },
      evidence: [],
      pending_suggestion_count: 0,
    },
    {
      todo_id: 101,
      title: '整理 Three.js 笔记第三章',
      current_status: 'not_started',
      created_at: daysAgo(9),
      origin: { chunk_id: 9001, record_id: 9101, excerpt: 'Three.js 笔记第三章光照模型部分没理顺，先整理一遍', date: daysAgo(9) },
      evidence: [
        { chunk_id: 9002, record_id: 9107, excerpt: '光照模型章节读完了，PBR 参数那里记一下坑', date: daysAgo(5), confirmed_at: daysAgo(4) },
        { chunk_id: 9003, record_id: 9108, excerpt: '阴影贴图章节也补完了，周末整理成篇发博客', date: daysAgo(1), confirmed_at: daysAgo(0) },
      ],
      pending_suggestion_count: 1,
    },
  ]
}

/**
 * 剥包装层：后端返回 { data: { suggestions: [...] } } / { data: { todos: [...] } }，
 * 兼容裸数组与旧口径
 * @param {any} data
 * @param {string} key 包装字段名
 * @returns {Array}
 */
function unwrap(data, key) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.[key])) return data[key]
  return []
}

export const useTodoStore = defineStore('todo', () => {
  /** @type {import('vue').Ref<TodoSuggestion[]>} pending 建议列表 */
  const pendingSuggestions = ref([])
  /** @type {import('vue').Ref<TodoEntry[]>} 登记表条目（直调状态操作目标） */
  const todos = ref([])
  /** @type {import('vue').Ref<Array>} 未完成待办证据链（TodoChainCard 数据源，createdAt DESC） */
  const chains = ref([])

  const loading = ref(false)
  /** chains 独立 loading（open-chain 端点 B 并行开发中，mock 先行；不牵动主 fetch 的 loading） */
  const chainsLoading = ref(false)
  /** 写操作进行中的 suggestion/todo id（防双击，UI 禁按钮） */
  const resolvingId = ref(null)
  const error = ref(null)

  /**
   * 审核窗口暂存的裁决：suggestionId → { action, status }
   *
   * 审核态不做任何真实改动（记录尚未入库，改状态没有记录支撑），
   * 用户在审核窗口选的三态 / 点的拒绝都先存在这里，
   * 等他点「确认入库」再由 commitStaged() 一次性提交。
   * 用户不入库直接关掉 → 暂存自然作废（clearStaged）。
   */
  const staged = ref({})

  /** pending 角标数（侧栏待办卡卡头小蓝点） */
  const pendingCount = computed(() => pendingSuggestions.value.length)

  /** title → registry 条目反查（open_items 与 registry 关联的兜底桥） */
  const todoByTitle = computed(() => {
    const m = {}
    todos.value.forEach(t => { m[t.title] = t })
    return m
  })

  /**
   * 拉取 pending 建议 + 登记表条目（侧栏打开 / 审核完成后刷新）
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetch() {
    loading.value = true
    error.value = null
    try {
      // 建议列表与条目清单并行拉；任一失败整体报错（页面有兜底文案不白屏）
      const [sugRes, todoRes] = await Promise.all([
        apiGetPendingSuggestions(),
        apiGetTodos().catch(() => null), // 条目清单失败不阻断建议展示（只影响直调反查）
      ])
      pendingSuggestions.value = unwrap(sugRes.data, 'suggestions')
      if (todoRes) todos.value = unwrap(todoRes.data, 'todos')
      return true
    } catch (err) {
      console.error('Failed to fetch todos:', err)
      error.value = err.message || '待办加载失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 拉取未完成待办证据链（GET /todos/open-chain；R17 TodoChainCard 数据源）
   *
   * 独立于 fetch()：open-chain 端点 B 并行开发中，mock 先行不牵动建议/条目的真接口路径；
   * 失败静默兜底（chains 保持旧值/error 记错，宿主有空态文案，不白屏）。
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetchChains() {
    chainsLoading.value = true
    try {
      if (USE_MOCK_CHAINS) {
        await new Promise(r => setTimeout(r, MOCK_CHAIN_DELAY))
        chains.value = buildMockChains()
      } else {
        const res = await apiGetOpenChains()
        chains.value = unwrap(res.data, 'chains')
      }
      return true
    } catch (err) {
      console.error('Failed to fetch todo chains:', err)
      error.value = err.message || '证据链加载失败'
      return false
    } finally {
      chainsLoading.value = false
    }
  }

  /**
   * 按待办标题找 registry 条目（open_items 无 todo_id 时的关联桥；
   * B 契约定稿后建议带 todo_id 直接命中）
   * @param {string} title
   * @returns {TodoEntry|null}
   */
  function findTodoByTitle(title) {
    return todoByTitle.value[title] || null
  }

  /**
   * 裁决建议：确认（带用户选定状态，双写落库）或忽略（永久静默）
   * 本地先行：卡片摘除 + 确认时同步改条目状态；请求失败回滚。
   * @param {TodoSuggestion} suggestion
   * @param {'confirmed'|'dismissed'} action
   * @param {string} status - action=confirmed 时：用户最终选定状态（可改 LLM 建议）
   * @returns {Promise<boolean>}
   */
  async function resolve(suggestion, action, status) {
    if (resolvingId.value) return false
    resolvingId.value = suggestion.id
    error.value = null

    // —— 本地快照（回滚用）——
    const sugSnapshot = pendingSuggestions.value.slice()
    const todoSnapshot = todos.value.map(t => ({ ...t }))
    const entry = todos.value.find(t => t.id === suggestion.todo_id)
    const prevEntryStatus = entry?.current_status

    // 乐观更新：卡片摘除；确认时条目状态同步推进
    pendingSuggestions.value = pendingSuggestions.value.filter(
      s => s.id !== suggestion.id)
    if (action === 'confirmed' && entry && VALID_STATUSES.includes(status)) {
      entry.current_status = status
    }
    // 证据链 L1 状态圈镜像（链可能来自 mock/尚未刷新，找不到不报错）
    const chain = chains.value.find(c => String(c.todo_id ?? c.todoId) === String(suggestion.todo_id))
    const prevChainStatus = chain?.current_status

    try {
      await apiResolveSuggestion(suggestion.id, action, status)
      if (action === 'confirmed' && chain && VALID_STATUSES.includes(status)) {
        chain.current_status = status
      }
      return true
    } catch (err) {
      // 回滚：建议卡复原 + 条目状态还原 + 链状态还原
      console.error('Failed to resolve suggestion:', err)
      pendingSuggestions.value = sugSnapshot
      todos.value = todoSnapshot
      if (chain) chain.current_status = prevChainStatus
      error.value = err.message || (action === 'confirmed' ? '确认失败' : '操作失败')
      return false
    } finally {
      resolvingId.value = null
    }
  }

  /**
   * 侧栏直调三态：改条目状态（chunk + registry 双写在 B 端点事务内；
   * 该待办的 pending 建议后端自动作废——前端同步摘除对应建议卡）
   * @param {TodoEntry} entry
   * @param {'not_started'|'in_progress'|'completed'} status
   * @returns {Promise<boolean>}
   */
  async function setStatus(entry, status) {
    if (!entry || !VALID_STATUSES.includes(status) || resolvingId.value) return false
    if (entry.current_status === status) return true // 同态点击不重发
    resolvingId.value = entry.id
    error.value = null

    const prevStatus = entry.current_status
    const sugSnapshot = pendingSuggestions.value.slice()
    // 乐观更新：状态先行 + 该待办的 pending 建议同步作废（用户手动改了，建议作废）
    // 注意：作废粒度是"该 todo 的所有 pending 建议"，不是当前这一张——
    // 所以侧栏直调后，审核窗口里同一 todo 的卡也会一起消失（预期行为，非 bug）
    entry.current_status = status
    pendingSuggestions.value = pendingSuggestions.value.filter(s => s.todo_id !== entry.id)
    // 证据链 L1 状态圈镜像（链视图宿主即时反馈；链未加载/未含该条目则跳过）
    const chain = chains.value.find(c => String(c.todo_id ?? c.todoId) === String(entry.id))
    const prevChainStatus = chain?.current_status
    if (chain) chain.current_status = status

    try {
      await apiSetTodoStatus(entry.id, status)
      return true
    } catch (err) {
      // 回滚：状态还原 + 建议卡复原 + 链状态还原
      console.error('Failed to set todo status:', err)
      entry.current_status = prevStatus
      pendingSuggestions.value = sugSnapshot
      if (chain) chain.current_status = prevChainStatus
      error.value = err.message || '状态更新失败'
      return false
    } finally {
      resolvingId.value = null
    }
  }

  /**
   * 暂存一条裁决（审核窗口专用，不发请求）
   * @param {number|string} suggestionId
   * @param {'confirmed'|'dismissed'} action
   * @param {string} [status] action=confirmed 时的目标状态
   */
  function stageResolution(suggestionId, action, status) {
    staged.value = { ...staged.value, [suggestionId]: { action, status } }
  }

  /** 撤下某条暂存（用户改回未操作 / 点了撤销） */
  function unstageResolution(suggestionId) {
    const next = { ...staged.value }
    delete next[suggestionId]
    staged.value = next
  }

  /** 清空暂存（审核窗口关闭 / 提交完成后调用） */
  function clearStaged() {
    staged.value = {}
  }

  /**
   * 确认入库后提交全部暂存的裁决
   *
   * 逐条串行调 resolve（乐观更新+回滚在 resolve 内）。单条失败不阻断后续，
   * 只记下来返回 false，由调用方决定要不要提示——入库本身已成功，不该被打断。
   * @returns {Promise<{ ok: boolean, failed: number }>}
   */
  async function commitStaged() {
    const entries = Object.entries(staged.value)
    if (!entries.length) return { ok: true, failed: 0 }
    let failed = 0
    for (const [id, { action, status }] of entries) {
      const suggestion = pendingSuggestions.value.find(s => String(s.id) === String(id))
      if (!suggestion) continue // 入库后已被后端自动作废/消失，跳过
      const ok = await resolve(suggestion, action, status)
      if (!ok) failed += 1
    }
    clearStaged()
    return { ok: failed === 0, failed }
  }

  /**
   * stats.open_items 同步（乐观更新后的旁路镜像——stats store 30s 缓存期内
   * 侧栏待办速览仍读 stats.todo，直接改它让两处 UI 即时一致）。
   * 独立导出供组件在写成功后调用；stats 缓存过期后自然被真接口覆盖。
   * @param {string} title - 待办标题（open_items 关联键）
   * @param {'not_started'|'in_progress'|'completed'} status
   */
  function syncStatsOpenItem(title, status) {
    const stats = useStatsStore()
    const items = stats.stats?.todo?.open_items
    if (!Array.isArray(items)) return
    const item = items.find(i => (i.title || i.summary) === title)
    if (item) item.task_status = status
  }

  return {
    pendingSuggestions, todos, chains,
    loading, chainsLoading, resolvingId, error, staged,
    pendingCount, todoByTitle,
    fetch, fetchChains, findTodoByTitle, resolve, setStatus, syncStatsOpenItem,
    stageResolution, unstageResolution, clearStaged, commitStaged,
  }
})
