import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useMirrorStore = defineStore('mirror', () => {
  const profile = ref({
    stats: { totalRecords: 5, totalDays: 3, dailyAvg: 1.7 },
    learning: {
      text: '你最近在深入学习 Spring Security，涵盖认证和授权两个核心模块。同时完成了数据库概念设计。',
      evidence: [
        { date: '2小时前', text: '学习了 Spring Security 认证流程...' },
      ],
    },
    mood: {
      segments: [
        { key: 'calm', label: '平静', percentage: 30, color: 'var(--accent)' },
        { key: 'happy', label: '开心', percentage: 40, color: 'var(--success)' },
        { key: 'anxious', label: '焦虑', percentage: 20, color: 'var(--warning)' },
        { key: 'exhausted', label: '疲惫', percentage: 10, color: '#7C3AED' },
      ],
    },
    todos: '你有 1 项待办未完成：准备项目进度会议的演示文稿',
    tags: '后端学习者 / 注重细节 / 善于社交 / 夜间活跃 / 项目驱动',
  })

  const generating = ref(false)

  return {
    profile,
    generating,
  }
})
