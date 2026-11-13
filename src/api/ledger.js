import request from './request'

const path = '/ledger'
const data = response => response.data
export const getLedgerCategories = () => request.get(path + '/categories').then(data)
export const addLedgerCategory = name => request.post(path + '/categories', { name }).then(data)
export const getLedgerBrief = (start, end) => request.get(path + '/brief', { params: { start, end } }).then(data)
export const getLedgerRecords = params => request.get(path + '/records', { params }).then(data)
export const getLedgerRecord = id => request.get(path + '/records/' + id).then(data)
export const createLedgerRecord = input => request.post(path + '/records', input).then(data)
export const updateLedgerRecord = (id, input) => request.put(path + '/records/' + id, input).then(data)
export const removeLedgerRecord = id => request.delete(path + '/records/' + id).then(data)
export const appendLedgerFlows = (id, input) => request.post(path + '/records/' + id + '/flows', input).then(data)
export const removeLedgerFlow = (id, flowId) => request.delete(path + '/records/' + id + '/flows/' + flowId).then(data)
export const recognizeLedgerEvidence = vaultItemId => request.post(path + '/recognize', { vaultItemId }, { timeout: 60000 }).then(data)
export const getDiaryLedgerRecords = id => request.get(path + '/diaries/' + id + '/records').then(data)
export const linkDiaryLedgerRecords = (id, recordIds) => request.put(path + '/diaries/' + id + '/records', { recordIds }).then(data)
export const getWishes = () => request.get(path + '/wishes').then(data)
export const addWish = input => request.post(path + '/wishes', input).then(data)
export const changeWish = (id, input) => request.put(path + '/wishes/' + id, input).then(data)
export const removeWish = id => request.delete(path + '/wishes/' + id).then(data)
export const getWishEvents = (start, end) => request.get(path + '/wish-events', { params: { start, end } }).then(data)
export const getRecurringRules = () => request.get(path + '/recurring').then(data)
export const addRecurringRule = input => request.post(path + '/recurring', input).then(data)
export const removeRecurringRule = id => request.delete(path + '/recurring/' + id).then(data)
export const getDueLedgerRecords = () => request.get(path + '/recurring/due').then(data)
export const confirmDueLedgerRecord = (id, amount) => request.post(path + '/recurring/due/' + id + '/confirm', { amount }).then(data)
export const skipDueLedgerRecord = id => request.post(path + '/recurring/due/' + id + '/skip', {}).then(data)

export async function downloadLedger(format, start, end) {
  const blob = await request.get(path + '/export', { params: { format, start, end }, responseType: 'blob' })
  if (!(blob instanceof Blob)) throw new Error('没有收到导出文件')
  if (format === 'csv' && blob.type.includes('application/json')) {
    throw new Error(JSON.parse(await blob.text()).message || '导出失败')
  }
  if (format === 'json' && blob.type.includes('application/json')) {
    const document = JSON.parse(await blob.text())
    if (document.code && document.code !== 200) throw new Error(document.message || '导出失败')
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'mirror-ledger-' + start + '-' + end + '.' + format
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
