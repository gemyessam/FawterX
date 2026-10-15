import test from 'node:test'
import assert from 'node:assert/strict'
import { sortAndStaggerDocuments } from '../src/utils/uploadTime.js'

test('sortAndStaggerDocuments: orders documents naturally so Invoice 10 does not precede Invoice 1 or 2', () => {
  const inputDocs = [
    { internalID: 'INV-10', _fileName: 'invoice_10.pdf' },
    { internalID: 'INV-2', _fileName: 'invoice_2.pdf' },
    { internalID: 'INV-1', _fileName: 'invoice_1.pdf' },
    { internalID: 'INV-20', _fileName: 'invoice_20.pdf' },
    { internalID: 'INV-3', _fileName: 'invoice_3.pdf' }
  ]

  const result = sortAndStaggerDocuments(inputDocs, 3)

  assert.equal(result.length, 5)
  assert.equal(result[0].internalID, 'INV-1')
  assert.equal(result[1].internalID, 'INV-2')
  assert.equal(result[2].internalID, 'INV-3')
  assert.equal(result[3].internalID, 'INV-10')
  assert.equal(result[4].internalID, 'INV-20')
})

test('sortAndStaggerDocuments: staggers dateTimeIssued with strictly increasing seconds', () => {
  const inputDocs = [
    { internalID: '202303717', dateTimeIssued: '2026-10-15T12:00:00Z' },
    { internalID: '202303716', dateTimeIssued: '2026-10-15T12:00:00Z' }
  ]

  const result = sortAndStaggerDocuments(inputDocs, 3)

  // 716 should be first, 717 second
  assert.equal(result[0].internalID, '202303716')
  assert.equal(result[1].internalID, '202303717')

  const time0 = new Date(result[0].dateTimeIssued).getTime()
  const time1 = new Date(result[1].dateTimeIssued).getTime()

  // time1 should be exactly 3000ms after time0
  assert.equal(time1 - time0, 3000)
  assert.ok(time1 > time0)
})

test('sortAndStaggerDocuments: guarantees none of the staggered timestamps exceed current time', () => {
  const inputDocs = Array.from({ length: 15 }, (_, i) => ({
    internalID: `DOC-${i + 1}`,
    dateTimeIssued: new Date(Date.now() + 50000).toISOString() // Simulated clock skew in future
  }))

  const result = sortAndStaggerDocuments(inputDocs, 3)
  const now = Date.now()

  result.forEach((doc) => {
    const docTime = new Date(doc.dateTimeIssued).getTime()
    assert.ok(docTime <= now + 100, `doc ${doc.internalID} timestamp ${doc.dateTimeIssued} must not be in future`)
  })
})
