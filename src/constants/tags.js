// 内容类型
export const CONTENT_TYPES = [
  { key: 'todo', label: '待办' },
  { key: 'thought', label: '感想' },
  { key: 'learning', label: '学习' },
  { key: 'plan', label: '计划' },
  { key: 'note', label: '随记' },
  { key: 'work', label: '工作' },
  { key: 'social', label: '社交' },
  { key: 'health', label: '健康' },
]

export const typeMap = Object.fromEntries(CONTENT_TYPES.map(t => [t.key, t.label]))

// 情绪分组
export const MOOD_GROUPS = {
  positive: [
    { key: 'happy', label: '开心' },
    { key: 'excited', label: '兴奋' },
    { key: 'satisfied', label: '满足' },
    { key: 'grateful', label: '感恩' },
    { key: 'expecting', label: '期待' },
  ],
  neutral: [
    { key: 'calm', label: '平静' },
    { key: 'bored', label: '无聊' },
    { key: 'confused', label: '困惑' },
  ],
  negative: [
    { key: 'anxious', label: '焦虑' },
    { key: 'sad', label: '难过' },
    { key: 'angry', label: '愤怒' },
    { key: 'exhausted', label: '疲惫' },
    { key: 'stressed', label: '压力' },
  ],
}

export const ALL_MOODS = [
  ...MOOD_GROUPS.positive,
  ...MOOD_GROUPS.neutral,
  ...MOOD_GROUPS.negative,
]

export const moodMap = Object.fromEntries(ALL_MOODS.map(m => [m.key, m.label]))

// 情绪 → 标签颜色 class 映射
export const MOOD_COLOR_MAP = {
  happy: '', satisfied: '', grateful: '',
  excited: '', expecting: '', calm: '',
  bored: '', confused: '',
  anxious: 'anxious',
  sad: 'sad', angry: 'sad',
  exhausted: 'tired',
  stressed: 'anxious',
}

// 处理状态（8.2 状态机：processing / reviewing / done / failed）
export const PROCESSING_STATUS = ['processing', 'reviewing', 'done', 'failed']

/** 审核模式（5.5：manual 默认 / auto 无审核窗口） */
export const REVIEW_MODES = [
  { key: 'manual', label: '手动审核', desc: 'AI 处理后需手动确认，可调整片段' },
  { key: 'auto', label: '自动审核', desc: '无审核窗口，AI 自动确认（无法手动调整片段）' },
]

/** 任务状态（仅 todo/plan 类内容显示，8.4） */
export const TASK_STATUSES = [
  { key: 'not_started', label: '未开始' },
  { key: 'in_progress', label: '进行中' },
  { key: 'completed', label: '已完成' },
]

export const taskStatusMap = Object.fromEntries(TASK_STATUSES.map(t => [t.key, t.label]))
