import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationKey, notificationMedal } from '../src/utils/achievementNotifications.js'

test('ordinary and plated awards for the same medal are separate notifications', () => {
  assert.notEqual(notificationKey({ code: 'R-04', kind: 'earned' }), notificationKey({ code: 'R-04', kind: 'plated' }))
  assert.equal(notificationKey({ code: 'R-04' }), 'earned:R-04')
})

test('ordinary award displays its base finish even if plating unlocked at the same time', () => {
  const catalog = [{ code: 'R-04', earned: true, plated: true, name: '一日三记' }]
  const base = notificationMedal({ code: 'R-04', kind: 'earned' }, catalog)
  const plated = notificationMedal({ code: 'R-04', kind: 'plated' }, catalog)
  assert.equal(base.plated, false)
  assert.equal(plated.plated, true)
  assert.equal(plated.notificationKind, 'plated')
  assert.equal(catalog[0].plated, true)
  assert.equal(notificationMedal({ code: 'missing', kind: 'earned' }, catalog), null)
})
