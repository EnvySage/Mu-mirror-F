import previewCatalog from '@/preview/achievementCatalog.json'

// Generated from Mu-mirror-B's authoritative catalog by scripts/sync-achievements.py.
export const achievements = previewCatalog
export const achievementGroups = [...new Map(achievements.map(item => [item.group.id, item.group])).values()]
export const achievementDifficulties = [
  { level: 1, label: '入门', description: '完成一次体验或基础设置。', color: '#a9e5ee' },
  { level: 2, label: '进阶', description: '需要累计使用或完成多步协作。', color: '#e0f49b' },
  { level: 3, label: '挑战', description: '需要跨月积累或完成高门槛收藏。', color: '#ffbd82' },
]
export const dialogueAchievement = achievements.find(item => item.code === 'D-01')
