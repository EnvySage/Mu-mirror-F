const labels = {
  'todo.create': '创建待办',
  'todo.update': '修改待办',
  'todo.complete': '完成待办',
  'todo.delete': '删除待办',
  'record.create': '新建记录',
  'record.organize': '整理记录',
  'record.delete': '删除记录',
  'record.memory.disable': '永久移除记忆',
  'growth.adjust': '更正成长贡献',
  'memory.accept': '确认记忆候选',
  'memory.edit': '修改记忆候选',
  'memory.forget': '遗忘聊天记忆',
}

export function getActionLabel(kind) {
  return labels[kind] || '操作'
}
