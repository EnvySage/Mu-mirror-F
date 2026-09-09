import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getPendingSuggestions as apiGetPendingSuggestions,
  resolveSuggestion as apiResolveSuggestion,
  setTodoStatus as apiSetTodoStatus,
  getTodos as apiGetTodos,
} from '@/api/todo'
import { useStatsStore } from '@/stores/stats'

/**
 * 待办登记表 store（todo-registry-design.md §3.3 裁决期 / §4 F 行）
 *
 * 独立于 stats 的理由：stats 是读聚合（GET /mirror/stats），本 store 有写操作
 * （resolve/setTodoStatus），职责不同不并入。
 *
 * USE_MOCK=true：mock 先行（B 端点并行开发中）。mock 数据按任务书走查口径：
 * 2 条 pending 建议（completed + in_progress 各一）+ 5 条待办（三态分布）。
 * 接口 ready 后置 false 无缝切换，组件零改动。
 *
 * 写操作策略：乐观更新 + 失败回滚 + toast 反馈（成功 toast 由调用方发，
 * store 只负责数据一致性——失败时还原本地状态并把错误写进 error）。
 *
 * 字段口径（snake_case，与 request.js 拦截器输出一致；mock 同样给 snake_case）：
 * @typedef {Object} TodoSuggestion
 * @property {number|string} suggestion_id
 * @property {number|string} todo_id
 * @property {string} todo_title
 * @property {'not_started'|'in_progress'|'completed'} suggested_status
 * @property {{ chunk_id: number|string, excerpt: string, created_at: string,
 *              record_id?: number|string }} evidence
 * @property {string} todo_created_at
 *
 * @typedef {Object} TodoEntry
 * @property {number|string} id            todo_registry.id（直调端点目标）
 * @property {string} title
 * @property {'not_started'|'in_progress'|'completed'} current_status
 * @property {string} [source_chunk_id]
 * @property {number|string} [record_id]   来源记录（跳记录详情；联调字段需求）
 */

/** mock 开关：B todo 三端点未上线（探针返回 5006 通用错误），置 true 走 mock 走查 */
const USE_MOCK = true

/** mock 延迟（ms） */
const MOCK_DELAY = 200

/** mock 自增 id 起点（避开真 id） */
let mockSeq = 8000

/** 三态合法值（防脏数据进本地缓存） */
const VALID_STATUSES = ['not_started', 'in_progress', 'completed']

/** x天前 ISO（yyyy-MM-dd HH:mm:ss，与后端时间口径同构） */
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const p = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`
}

/**
 * mock 数据（任务书走查口径）
 * todo id 与 stats mock open_items record_id 无关——open_items 是 stats 聚合，
 * registry 是登记表实体，两套 id 各自独立（B 契约：suggestion.todo_id 指 registry.id）
 */
function buildMock() {
  return {
    suggestions: [
      {
        suggestion_id: ++mockSeq,
        todo_id: 101,
        todo_title: '整理 Three.js 笔记第三章',
        suggested_status: 'completed',
        evidence: {
          chunk_id: 9001,
          excerpt: 'Three.js 笔记第三章的光照模型部分终于补完了，整理成篇发了博客',
          created_at: daysAgo(0),
          record_id: 1,
        },
        todo_created_at: daysAgo(9),
      },
      {
        suggestion_id: ++mockSeq,
        todo_id: 102,
        todo_title: '投递两份简历',
        suggested_status: 'in_progress',
        evidence: {
          chunk_id: 9002,
          excerpt: 'A 公司那边约了下周一面，B 公司还在等回复，先把项目复盘再过一遍',
          created_at: daysAgo(1),
          record_id: 2,
        },
        todo_created_at: daysAgo(6),
      },
    ],
    todos: [
      { id: 101, title: '整理 Three.js 笔记第三章', current_status: 'not_started', source_chunk_id: 9001, record_id: 1 },
      { id: 102, title: '投递两份简历', current_status: 'in_progress', source_chunk_id: 9002, record_id: 2 },
      { id: 103, title: '预约周四体检', current_status: 'not_started', source_chunk_id: 9003, record_id: 3 },
      { id: 104, title: '读完《置身事内》第 4 章', current_status: 'in_progress', source_chunk_id: 9004, record_id: 4 },
      { id: 105, title: '给妈妈打电话', current_status: 'not_started', source_chunk_id: 9005, record_id: 5 },
    ],
  }
}

export const useTodoStore = defineStore('todo', () => {
  /** @type {import('vue').Ref<TodoSuggestion[]>} pending 建议列表 */
  const pendingSuggestions = ref([])
  /** @type {import('vue').Ref<TodoEntry[]>} 登记表条目（直调状态操作目标） */
  const todos = ref([])

  const loading = ref(false)
  /** 写操作进行中的 suggestion/todo id（防双击，UI 禁按钮） */
  const resolvingId = ref(null)
  const error = ref(null)
  /** 数据来源标记（mock / live），调试与透出用 */
  const source = ref(null)

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
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, MOCK_DELAY))
        const mock = buildMock()
        pendingSuggestions.value = mock.suggestions
        todos.value = mock.todos
        source.value = 'mock'
      } else {
        // 建议列表与条目清单并行拉；任一失败整体报错（页面有兜底文案不白屏）
        const [sugRes, todoRes] = await Promise.all([
          apiGetPendingSuggestions(),
          apiGetTodos().catch(() => null), // 条目清单失败不阻断建议展示（只影响直调反查）
        ])
        pendingSuggestions.value = sugRes.data || []
        if (todoRes) todos.value = todoRes.data || []
        source.value = 'live'
      }
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
    resolvingId.value = suggestion.suggestion_id
    error.value = null

    // —— 本地快照（回滚用）——
    const sugSnapshot = pendingSuggestions.value.slice()
    const todoSnapshot = todos.value.map(t => ({ ...t }))
    const entry = todos.value.find(t => t.id === suggestion.todo_id)
    const prevEntryStatus = entry?.current_status

    // 乐观更新：卡片摘除；确认时条目状态同步推进
    pendingSuggestions.value = pendingSuggestions.value.filter(
      s => s.suggestion_id !== suggestion.suggestion_id)
    if (action === 'confirmed' && entry && VALID_STATUSES.includes(status)) {
      entry.current_status = status
    }

    try {
      if (!USE_MOCK) await apiResolveSuggestion(suggestion.suggestion_id, action, status)
      // mock 延迟模拟网络
      else await new Promise(r => setTimeout(r, MOCK_DELAY))
      return true
    } catch (err) {
      // 回滚：建议卡复原 + 条目状态还原
      console.error('Failed to resolve suggestion:', err)
      pendingSuggestions.value = sugSnapshot
      todos.value = todoSnapshot
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
    entry.current_status = status
    pendingSuggestions.value = pendingSuggestions.value.filter(s => s.todo_id !== entry.id)

    try {
      if (!USE_MOCK) await apiSetTodoStatus(entry.id, status)
      else await new Promise(r => setTimeout(r, MOCK_DELAY))
      return true
    } catch (err) {
      // 回滚：状态还原 + 建议卡复原
      console.error('Failed to set todo status:', err)
      entry.current_status = prevStatus
      pendingSuggestions.value = sugSnapshot
      error.value = err.message || '状态更新失败'
      return false
    } finally {
      resolvingId.value = null
    }
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
    pendingSuggestions, todos,
    loading, resolvingId, error, source,
    pendingCount, todoByTitle,
    fetch, findTodoByTitle, resolve, setStatus, syncStatsOpenItem,
  }
})
