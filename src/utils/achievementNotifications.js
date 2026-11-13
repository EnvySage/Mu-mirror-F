export function notificationKey(notification) {
  return `${notification.kind || 'earned'}:${notification.code}`
}

export function notificationMedal(notification, catalog) {
  const medal = notification && catalog.find(item => item.code === notification.code)
  return medal ? { ...medal, plated: notification.kind === 'plated', notificationKind: notification.kind || 'earned' } : null
}

export function notificationBatch(pending, catalog, dismissed = new Set()) {
  const seen = new Set(dismissed)
  return pending.flatMap(item => {
    if (!item?.code || !['earned', 'plated'].includes(item.kind || 'earned')) return []
    const notification = { code: item.code, kind: item.kind || 'earned' }
    const key = notificationKey(notification)
    const medal = notificationMedal(notification, catalog)
    if (seen.has(key) || !medal) return []
    seen.add(key)
    return [{ key, notification, medal }]
  })
}
