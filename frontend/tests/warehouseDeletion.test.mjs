import test from 'node:test'
import assert from 'node:assert/strict'
import { acquireStockDeletionLock, deleteAndVerifyStock } from '../src/utils/warehouseDeletion.mjs'
test('single and bulk callers cannot overlap until confirmation completes', () => {
  const ref = { current: false }
  const release = acquireStockDeletionLock(ref)
  assert.equal(typeof release, 'function')
  assert.equal(acquireStockDeletionLock(ref), null)
  release()
  assert.equal(typeof acquireStockDeletionLock(ref), 'function')
})
const deleted = async () => ({ success: true, deleted: true, itemKey: 'a', deletionContractVersion: 2 })
test('confirms absence with a fresh server read', async () => {
  const rows = await deleteAndVerifyStock('p', 'a', deleted, async (p, options) => {
    assert.equal(p, 'p'); assert.equal(options.fresh, true)
    return { success: true, stockReadVersion: 2, stock: [{ itemKey: 'b' }] }
  })
  assert.deepEqual(rows, [{ itemKey: 'b' }])
})
test('rejects success when item returns', async () => {
  await assert.rejects(deleteAndVerifyStock('p', 'a', deleted, async () => ({ success: true, stockReadVersion: 2, stock: [{ itemKey: 'a' }] })))
})
test('rejects stale backend and invalid confirmations', async () => {
  await assert.rejects(deleteAndVerifyStock('p', 'a', async () => ({ success: true }), async () => { throw Error('must not read') }))
  await assert.rejects(deleteAndVerifyStock('p', 'a', deleted, async () => ({ success: true, stock: [] })))
})
test('propagates delete failure without reading or claiming success', async () => {
  await assert.rejects(deleteAndVerifyStock('p', 'a', async () => { throw Error('delete failed') }, async () => { throw Error('must not read') }), /delete failed/)
})
