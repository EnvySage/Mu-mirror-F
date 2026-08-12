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

// 处理状态
export const PROCESSING_STATUS = ['processing', 'done', 'failed']

// 审核模式
export const REVIEW_MODES = [
  { key: 'full_manual', label: '全手动', desc: '每条都审核' },
  { key: 'semi_auto', label: '半自动', desc: 'AI 处理完确认（默认）' },
  { key: 'full_auto', label: '全自动', desc: 'AI 直接保存' },
]
