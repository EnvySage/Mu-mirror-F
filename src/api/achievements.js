import request from './request'
import { IS_DEMO_PREVIEW } from '@/preview/mode'

const data = promise => promise.then(response => response.data)
export const achievementApi = {
  collection: () => data(request.get('/achievements')),
  pending: () => data(request.get('/achievements/pending')),
  acknowledgeNotifications: notifications => data(request.post('/achievements/acknowledge', { notifications })),
  showcase: () => data(request.get('/achievements/showcase')),
  saveShowcase: payload => data(request.put('/achievements/showcase', payload)),
}

// Gestures are best-effort signals. Their sources are checked again by the server.
export function reportAchievementActivity(kind, subjectId, otherId = null, value = null, contextId = null) {
  if (IS_DEMO_PREVIEW || subjectId == null) return
  return request.post('/achievements/activity', {
    kind, subjectId: String(subjectId), otherId: otherId == null ? null : String(otherId), value,
    contextId: contextId == null ? null : String(contextId),
  }).then(() => true).catch(() => false)
}
