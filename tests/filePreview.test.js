import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, previewType } from '../src/utils/filePreview.js'

test('CSV preserves commas, embedded newlines, escaped quotes and empty trailing cells', () => {
  assert.deepEqual(parseCsv('\uFEFFname,note,tail\r\nA,"one,two",\r\nB,"first\nsecond",x\r\nC,"say ""yes""",z\r\n').rows,
    [['name','note','tail'],['A','one,two',''],['B','first\nsecond','x'],['C','say "yes"','z']])
})
test('CSV display is bounded by rows and columns, with honest truncation', () => {
  const result = parseCsv('a,b,c\n1,2,3\n4,5,6\n', 2, 2)
  assert.deepEqual(result.rows, [['a','b'],['1','2']]); assert.equal(result.truncated, true)
  assert.equal(parseCsv('a\nb\n', 2).truncated, false)
  assert.equal(parseCsv('a\n"unfinished').malformed, true)
  assert.deepEqual(parseCsv('').rows, [])
})
test('CSV keeps HTML and formulas as literal strings for Vue text bindings', () => {
  assert.deepEqual(parseCsv('value\n<script>alert(1)</script>\n=1+1').rows, [['value'],['<script>alert(1)</script>'],['=1+1']])
})
test('known filenames restore media types when the server sends octet-stream', () => {
  assert.equal(previewType({ file_type: 'DOCX' }, 'application/octet-stream').kind, 'docx')
  assert.equal(previewType({ originalName: 'song.M4A' }).mime, 'audio/mp4')
  assert.equal(previewType({ fileType: 'webp', displayName: '无后缀的显示名称' }).kind, 'image')
  assert.equal(previewType({ original_name: 'file.pdf' }).kind, 'pdf')
  assert.equal(previewType({}, 'text/csv; charset=UTF-8').kind, 'csv')
  assert.equal(previewType({ fileType: 'svg' }, 'image/svg+xml').kind, 'unsupported')
  assert.equal(previewType({ fileType: 'exe' }).kind, 'unsupported')
})
