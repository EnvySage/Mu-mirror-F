import test from 'node:test'
import assert from 'node:assert/strict'
import { summarySourceIds } from '../src/utils/summarySources.js'

test('summary evidence survives both metadata-preserved camelCase and normalized snake_case responses', () => {
  assert.deepEqual(summarySourceIds({ contentType: 'daily_summary', sourceRecordIds: [11, 12] }), [11, 12])
  assert.deepEqual(summarySourceIds({ source_record_ids: [13] }), [13])
  assert.deepEqual(summarySourceIds({ sourceRecordIds: [], source_record_ids: [99] }), [])
  assert.equal(summarySourceIds({ contentType: 'daily_summary' }), null)
})
