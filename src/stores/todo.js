import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getPendingSuggestions as apiGetPendingSuggestions,
  getOpenChains as apiGetOpenChains,
  getTodos as apiGetTodos,
  deleteTodo as apiDeleteTodo,
} from '@/api/todo'
import { getRecordSuggestions as apiGetRecordSuggestions } from '@/api/records'

/**
 * 待办登记表 store（todo-registry-design.md §3.3 裁决期 / §4 F 行）
 *
 * 独立于 stats 的理由：stats 是读聚合（GET /mirror/stats），本 store 有写操作
 * （删除待办、关联待办裁决），职责不同不并入。
 *
 * 数据来源：GET /todos/pending-suggestions、GET /todos/open-chain、
 * GET /todos（登记列表，审核页手动关联选择面板）、GET /records/{id}/suggestions、
 * DELETE /todos/{id}，见 api/todo.js 与 api/records.js。
 *
 * 写操作策略：乐观更新 + 失败回滚 + toast 反馈（成功 toast 由调用方发，
 * store 只负责数据一致性——失败时还原本地状态并把错误写进 error）。
 *
 * 注：状态变更唯一入口 = 记录审核页（随「确认入库」提交），故旧直调
 * （PUT /todos/{id}/status）、逐条裁决（POST /todos/suggestions/{id}/resolve）
 * 及配套的 resolve/setStatus/staged 暂存、registry 直调反查缓存已全部下线。
 * （GET /todos 清单端点为「手动关联」选择面板重新启用，只读展示，不承担状态直调。）
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
 * @typedef {Object} TodoItem     GET /todos 登记条目（手动关联选择面板数据源）
 * @property {number|string} id
 * @property {string} title
 * @property {'not_started'|'in_progress'|'completed'} current_status
 * @property {number|string} [source_chunk_id]
 * @property {boolean} [orphan]
 * @property {number} [link_count]
 * @property {number} [pending_suggestion_count]
 * @property {string} [created_at]
 * @property {string} [closed_at]
 *
 * @typedef {Object} TodoChain    GET /todos/open-chain 单条（未完成待办，createdAt DESC）
 * @property {number|string} todo_id
 * @property {string} title
 * @property {'not_started'|'in_progress'|'completed'} current_status
 * @property {string} created_at
 * @property {{ chunk_id: number|string, record_id: number|string, excerpt: string,
 *              date: string }} [origin]   待办来源片段（null = orphan 降级）
 * @property {{ chunk_id: number|string, record_id: number|string, excerpt: string,
 *              date: string, confirmed_at: string }}[] evidence  已确认证据（按时间 ASC）
 * @property {number} pending_suggestion_count  该待办待裁决建议数（链尾虚线节点）
 */

/**
 * 剥包装层：后端返回 { data: { suggestions: [...] } } / { data: { todos: [...] } } /
 * { data: { chains: [...] } }，兼容裸数组与旧口径
 * @param {any} data
 * @param {string} key 包装字段名
 * @returns {Array}
 */
function unwrap(data, key) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.[key])) return data[key]
  return []
}

/**
 * 多键名剥包装：兼容 { todos } / { list } / { items } 与裸数组（后端包装口径可能微调）
 * @param {any} data
 * @param {string[]} keys
 * @returns {Array}
 */
function unwrapAny(data, keys) {
  if (Array.isArray(data)) return data
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k]
  }
  return []
}

export const useTodoStore = defineStore('todo', () => {
  /** @type {import('vue').Ref<TodoSuggestion[]>} pending 建议列表 */
  const pendingSuggestions = ref([])
  /** @type {import('vue').Ref<Array>} 未完成待办证据链（TodoChainCard 数据源，createdAt DESC） */
  const chains = ref([])
  /** @type {import('vue').Ref<Array>} 审核页「关联待办」建议（GET /records/{id}/suggestions） */
  const recordSuggestions = ref([])
  /** @type {import('vue').Ref<TodoItem[]>} 登记列表（GET /todos，手动关联选择面板数据源） */
  const registry = ref([])
  /**
   * @type {import('vue').Ref<Array<{todoId:any, title:string, currentStatus:string, status:string, seq:number}>>}
   * 审核页「手动关联」行：status 预填 currentStatus（用户不改 = 只关联不改状态）；
   * seq 用于与 AI 建议行按 todo 去重时"最后操作优先"。
   */
  const manualLinks = ref([])

  /** 操作序号：AI 建议裁决 / 手动关联指向同一 todo 时，以最后一次操作为准（见 resolutionsPayload） */
  let opSeq = 0
  const nextSeq = () => ++opSeq

  const loading = ref(false)
  /** chains 独立 loading（数据源与宿主不同，单独按需拉取，不牵动主 fetch 的 loading） */
  const chainsLoading = ref(false)
  /** 审核页关联待办建议独立 loading（按记录切换拉取） */
  const recordSugLoading = ref(false)
  /** 手动关联选择面板独立 loading（GET /todos） */
  const registryLoading = ref(false)
  /** registry 是否已成功拉取过（面板重复打开不重复请求；失败不置位，允许重试） */
  let registryLoaded = false
  /** 删除进行中的 todo id（防双击，卡内删除按钮禁点） */
  const removingId = ref(null)
  const error = ref(null)

  /**
   * 审核页「关联待办」的用户裁决：suggestionId → { action: 'confirmed'|'dismissed', status }
   *
   * 拉到建议时按机器建议态预填（每项都有默认选择，用户只改要改的），
   * 点「确认入库」时由 resolutionsPayload 映射进 confirm body 的 todoResolutions 一起提交。
   */
  const resolutions = ref({})

  /** pending 角标数（侧栏待办卡卡头小蓝点） */
  const pendingCount = computed(() => pendingSuggestions.value.length)

  /**
   * 拉取 pending 建议（侧栏打开 / 审核完成后刷新）
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetPendingSuggestions()
      pendingSuggestions.value = unwrap(res.data, 'suggestions')
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
   * 独立于 fetch()：宿主与刷新时机都不同（侧栏/镜子页各拉各的），失败静默兜底
   * （chains 保持旧值/error 记错，宿主有空态文案，不白屏）。
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetchChains() {
    chainsLoading.value = true
    try {
      const res = await apiGetOpenChains()
      chains.value = unwrap(res.data, 'chains')
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
   * 拉取某条记录的关联待办建议（审核页「关联待办」区块）
   *
   * 契约 GET /records/{id}/suggestions 返回的每条都是"待用户裁决"的建议；
   * 拉到后按机器建议态预填 resolutions（每项都有默认选择，用户只改要改的）。
   * @param {number|string} recordId
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetchRecordSuggestions(recordId) {
    if (recordId == null) {
      recordSuggestions.value = []
      resolutions.value = {}
      return false
    }
    recordSugLoading.value = true
    try {
      const res = await apiGetRecordSuggestions(recordId)
      const list = unwrap(res.data, 'suggestions')
      recordSuggestions.value = list
      const seed = {}
      list.forEach(s => {
        const id = s.suggestion_id ?? s.suggestionId
        if (id == null) return
        seed[id] = { action: 'confirmed', status: s.suggested_status ?? s.suggestedStatus, seq: nextSeq() }
      })
      resolutions.value = seed
      return true
    } catch (err) {
      console.error('Failed to fetch record suggestions:', err)
      recordSuggestions.value = []
      resolutions.value = {}
      return false
    } finally {
      recordSugLoading.value = false
    }
  }

  /**
   * 设置单条关联待办的裁决（confirmed 带状态 / dismissed 忽略）
   * @param {number|string} suggestionId
   * @param {'confirmed'|'dismissed'} action
   * @param {string} [status] - action=confirmed 时的目标状态
   */
  function setSuggestionResolution(suggestionId, action, status) {
    if (suggestionId == null) return
    resolutions.value = { ...resolutions.value, [suggestionId]: { action, status, seq: nextSeq() } }
  }

  /** 清空审核页裁决暂存（切换记录 / 入库完成后调用） */
  function clearResolutions() {
    recordSuggestions.value = []
    resolutions.value = {}
    manualLinks.value = []
  }

  /**
   * 拉取待办登记列表（审核页「手动关联」选择面板；GET /todos）
   *
   * registryLoaded 置位后重复打开不重复请求；force=true 强制刷新（用完即弃场景）。
   * @param {boolean} [force]
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetchRegistry(force = false) {
    if (registryLoaded && !force) return true
    registryLoading.value = true
    try {
      const res = await apiGetTodos()
      registry.value = unwrapAny(res.data, ['todos', 'list', 'items'])
      registryLoaded = true
      return true
    } catch (err) {
      console.error('Failed to fetch todo registry:', err)
      error.value = err.message || '待办列表加载失败'
      return false
    } finally {
      registryLoading.value = false
    }
  }

  /** 归一化 todo 主键（后端 TodoItemVO.id / 兼容 todo_id、todoId 口径） */
  function todoIdOf(t) {
    return t?.id ?? t?.todo_id ?? t?.todoId ?? null
  }

  /**
   * 手动关联一个待办（审核页「＋ 手动关联待办」选中）
   *
   * 去重规则（用户拍板 #2）：
   * - 已在手动列表 → 'exists'
   * - 该 todo 的 AI 建议行存在且未被忽略 → 'already_suggested'（不产生第二行）
   * - 该 todo 的 AI 建议行已被忽略 → 允许挂载（最终由 resolutionsPayload 按 seq 去重，手动为准）
   *
   * status 预填 current_status（用户不改 = 仅关联不改状态）。
   * @param {TodoItem} todo
   * @returns {'ok'|'exists'|'already_suggested'|'invalid'}
   */
  function addManualLink(todo) {
    const todoId = todoIdOf(todo)
    if (todoId == null) return 'invalid'
    if (manualLinks.value.some(m => String(m.todoId) === String(todoId))) return 'exists'
    const sug = recordSuggestions.value.find(
      s => String(s.todo_id ?? s.todoId) === String(todoId))
    if (sug) {
      const sid = sug.suggestion_id ?? sug.suggestionId
      const r = sid != null ? resolutions.value[sid] : null
      if (!r || r.action !== 'dismissed') return 'already_suggested'
    }
    const currentStatus = todo.current_status ?? todo.currentStatus ?? todo.status ?? 'not_started'
    manualLinks.value = [...manualLinks.value, {
      todoId,
      title: todo.title ?? todo.todo_title ?? todo.todoTitle ?? '未命名待办',
      currentStatus,
      status: currentStatus,
      seq: nextSeq(),
    }]
    return 'ok'
  }

  /**
   * 修改手动关联行的目标状态（不改状态时即预填的 currentStatus）
   * @param {any} todoId
   * @param {string} status
   */
  function setManualLinkStatus(todoId, status) {
    if (todoId == null || !status) return
    manualLinks.value = manualLinks.value.map(m =>
      String(m.todoId) === String(todoId) ? { ...m, status, seq: nextSeq() } : m)
  }

  /** 移除手动关联行 */
  function removeManualLink(todoId) {
    manualLinks.value = manualLinks.value.filter(m => String(m.todoId) !== String(todoId))
  }

  /**
   * confirm body 的 todoResolutions：把每项选择映射成契约结构，两类条目混合提交
   * - AI 建议裁决：{ suggestionId, action: 'confirmed'|'dismissed', status? }
   * - 手动关联：  { todoId, action: 'confirmed', status }
   *
   * 按 todo 去重（用户拍板 #2）：同一 todo 的 AI 建议行与手动行同时存在时取 seq 最大者
   * （最后一次操作）——被忽略的建议行 + 手动挂载同一 todo 时，最终只提交一条。
   * @returns {Array<{suggestionId?:any, todoId?:any, action:string, status?:string}>}
   */
  const resolutionsPayload = computed(() => {
    /** todo 主键 → { seq, payload }（"最后操作为准"） */
    const byTodo = new Map()
    const consider = (key, seq, payload) => {
      const prev = byTodo.get(key)
      if (!prev || seq >= prev.seq) byTodo.set(key, { seq, payload })
    }
    for (const s of recordSuggestions.value) {
      const id = s.suggestion_id ?? s.suggestionId
      if (id == null) continue
      const r = resolutions.value[id]
      if (!r) continue
      const tid = s.todo_id ?? s.todoId
      const key = tid == null ? `s:${id}` : String(tid)
      consider(key, r.seq ?? 0, r.action === 'dismissed'
        ? { suggestionId: id, action: 'dismissed' }
        : { suggestionId: id, action: 'confirmed', status: r.status })
    }
    for (const m of manualLinks.value) {
      if (m.todoId == null) continue
      consider(String(m.todoId), m.seq ?? 0,
        { todoId: m.todoId, action: 'confirmed', status: m.status || m.currentStatus })
    }
    return [...byTodo.values()].map(e => e.payload)
  })

  /**
   * 删除待办（软删；侧栏「管理层操作」特例直点，调用前须经影响清单弹框确认）
   *
   * 成功后本地摘除 + 以服务端为准刷新清单与 pending 角标（需求：从清单消失 + 角标同步）。
   * @param {number|string} todoId
   * @returns {Promise<boolean>}
   */
  async function removeTodo(todoId) {
    if (todoId == null || removingId.value) return false
    removingId.value = todoId
    error.value = null
    try {
      await apiDeleteTodo(todoId)
      chains.value = chains.value.filter(c => String(c.todo_id ?? c.todoId) !== String(todoId))
      pendingSuggestions.value = pendingSuggestions.value.filter(
        s => String(s.todo_id ?? s.todoId) !== String(todoId))
      await Promise.all([fetch(), fetchChains()])
      return true
    } catch (err) {
      console.error('Failed to delete todo:', err)
      error.value = err.message || '删除待办失败'
      return false
    } finally {
      removingId.value = null
    }
  }

  return {
    pendingSuggestions, chains, recordSuggestions, registry, manualLinks,
    loading, chainsLoading, recordSugLoading, registryLoading, removingId, error, resolutions,
    pendingCount, resolutionsPayload,
    fetch, fetchChains, fetchRecordSuggestions, fetchRegistry,
    setSuggestionResolution, clearResolutions,
    addManualLink, setManualLinkStatus, removeManualLink,
    removeTodo,
  }
})
