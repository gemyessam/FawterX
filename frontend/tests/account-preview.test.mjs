import test from 'node:test'
import assert from 'node:assert/strict'
import { accountPreviewAllows } from '../account-preview.mjs'

test('account preview permits known data reads and rejects all mutations', () => {
  for (const path of ['/api/eta/usage', '/api/eta/drafts/id', '/api/warehouse/access', '/api/warehouse/projects/id/stock', '/api/admin/users']) {
    assert.equal(accountPreviewAllows('GET', path), true)
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(accountPreviewAllows(method, path), false)
  }
})
test('account preview refuses ETA actions, unknown paths and disguised methods', () => {
  for (const path of ['/api/eta/test-auth', '/api/eta/submit', '/api/eta/user-sync', '/api/unknown', '/api/eta/drafts/id/submit']) assert.equal(accountPreviewAllows('GET', path), false)
  assert.equal(accountPreviewAllows('HEAD', '/api/eta/usage'), false)
})
