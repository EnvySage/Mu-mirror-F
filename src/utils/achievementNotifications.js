export function notificationKey(notification) {
  return `${notification.kind || 'earned'}:${notification.code}`
}

export function notificationMedal(notification, catalog) {
  const medal = notification && catalog.find(item => item.code === notification.code)
  return medal ? { ...medal, plated: notification.kind === 'plated', notificationKind: notification.kind || 'earned' } : null
}
