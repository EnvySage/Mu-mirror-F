import test from 'node:test'
import assert from 'node:assert/strict'
import * as ledger from '../src/utils/ledger.js'

const headline = entry => {
  assert.equal(typeof ledger.entryHeadline, 'function')
  return ledger.entryHeadline(entry)
}

test('income-only entries show the actual income instead of a zero net expense', () => {
  assert.deepEqual(headline({ expense: 0, income: '420.00', recovery: 0, net_expense: 0 }),
    { amount: 420, label: '收入', tone: 'income' })
})

test('AA entries keep the server-calculated net expense as the primary amount', () => {
  assert.deepEqual(headline({ expense: 228, income: 0, recovery: 114, net_expense: '114.00' }),
    { amount: 114, label: '净支出', tone: 'expense' })
})

test('recovery-only entries show the recovered amount with a recovery label', () => {
  assert.deepEqual(headline({ expense: 0, income: 0, recovery: '60.00', net_expense: -60 }),
    { amount: 60, label: '收回', tone: 'recovery' })
})

test('mixed income and spending do not relabel net expense as a cash balance', () => {
  assert.deepEqual(headline({ expense: 25, income: 420, recovery: 0, net_expense: 25 }),
    { amount: 25, label: '净支出', tone: 'expense' })
})
