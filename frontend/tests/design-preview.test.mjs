import test from 'node:test'
import assert from 'node:assert/strict'
import { previewResponse } from '../design-preview.mjs'

test('warehouse preview supplies projects and numeric stock without a backend', () => {
  const projects = previewResponse('GET', '/api/warehouse/projects?includeArchived=true')
  assert.equal(projects.status, 200)
  assert.ok(projects.body.projects[0].name.includes('تجريبي'))
  const stock = previewResponse('GET', '/api/warehouse/projects/design-demo/stock')
  assert.ok(stock.body.stock.length > 0)
  assert.ok(stock.body.stock.every(item => typeof item.quantityLm === 'number'))
})
test('preview blocks mutations and never passes unknown APIs through', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(previewResponse(method, '/api/warehouse/projects').status, 403)
  }
  assert.equal(previewResponse('GET', '/api/unknown').status, 404)
  assert.equal(previewResponse('GET', '/src/App.jsx'), null)
})
