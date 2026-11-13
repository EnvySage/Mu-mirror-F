export const flowLabels = { EXPENSE: '支出', INCOME: '收入', RECOVERY: '收回款' }
export const validAmount = value => /^\d{1,10}(\.\d{1,2})?$/.test(String(value).trim()) && Number(value) > 0
export const currency = value => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value || 0))

export function entryHeadline(entry) {
  const income = Number(entry.income || 0), expense = Number(entry.expense || 0), recovery = Number(entry.recovery || 0)
  if (!expense && income && !recovery) return { amount: income, label: '收入', tone: 'income' }
  if (!expense && recovery && !income) return { amount: recovery, label: '收回', tone: 'recovery' }
  const net = Number(entry.net_expense || 0)
  return { amount: Math.abs(net), label: net < 0 ? '净收回' : '净支出', tone: net < 0 ? 'recovery' : 'expense' }
}
export const shanghaiToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

export function shiftDay(date, days) {
  const utc = new Date(date + 'T00:00:00Z')
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function makeFlow(initial = {}, today = shanghaiToday()) {
  return {
    key: globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
    id: initial.id || undefined,
    kind: initial.kind || 'EXPENSE',
    amount: initial.amount == null ? '' : String(initial.amount),
    categoryId: initial.category_id ?? initial.categoryId ?? 'other',
    occurredOn: initial.occurred_on ?? initial.occurredOn ?? today,
    note: initial.note ?? '',
    relatedExpenseId: initial.related_expense_id ?? initial.relatedExpenseId ?? '',
    evidenceId: initial.evidence_id ?? initial.evidenceId ?? null,
  }
}

export function flowPayload(flow) {
  const { key, ...fields } = flow
  return {
    ...fields,
    amount: String(fields.amount).trim(),
    note: fields.note.trim(),
    relatedExpenseId: fields.kind === 'RECOVERY' ? fields.relatedExpenseId || null : null,
  }
}

const receiptPreference = 'mirror.ledger.auto-receipt'
export const autoReceiptEnabled = () => localStorage.getItem(receiptPreference) === 'true'
export const setAutoReceiptEnabled = value => localStorage.setItem(receiptPreference, String(value))
