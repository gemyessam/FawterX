// Explicit local design preview. This module has no connection to production data.
import { sampleDraft, sampleUsers, sampleDispatches } from './showcase-data.mjs'
const projects = [{ id: 'design-demo', name: 'مشروع تجريبي · معاينة التصميم', code: 'DEMO', archived: false }]
export const stock = [
  ['demo-01', 'DEMO-1001', 'قطاع ألومنيوم — عينة تصميم', 'STD', 36, 216, 302.4, 720],
  ['demo-02', 'DEMO-1002', 'قطاع إطار — عينة تصميم', 'WHITE', 24, 144, 172.8, 650],
  ['demo-03', 'DEMO-1003', 'قطاع ضلفة — عينة تصميم', 'BLACK', 18, 108, 162, 810],
  ['demo-04', 'DEMO-1004', 'قطاع زاوية — عينة تصميم', 'STD', 42, 252, 201.6, 430],
].map(([itemKey, itemCode, description, finish, quantityBar, quantityLm, quantityKg, lastUnitCost]) => ({
  itemKey, itemCode, description, finish, quantityBar, quantityLm, quantityKg, lastUnitCost,
  customerCode: 'DEMO', lengthMm: 6000, currency: 'EGP', lastSalesOrder: 'DEMO-01',
}))

export function previewResponse(method, url) {
  const pathname = new URL(url, 'http://localhost').pathname
  if (!pathname.startsWith('/api/')) return null
  if (method !== 'GET') return { status: 403, body: { success: false, message: 'معاينة تصميم فقط: الحفظ والإرسال والتعديل غير متاحين. Design preview is read-only.' } }
  let data
  if (pathname === '/api/warehouse/access') data = { enabled: true, role: 'admin' }
  else if (pathname === '/api/warehouse/projects') data = { projects }
  else if (pathname === '/api/warehouse/users' || pathname === '/api/admin/users') data = { users: sampleUsers }
  else if (pathname === '/api/warehouse/projects/design-demo/stock') data = { stock }
  else if (/^\/api\/warehouse\/projects\/design-demo\/(dispatches|aliases|invoices|audit-logs|restore-points)$/.test(pathname)) {
    const field = { dispatches: 'dispatches', aliases: 'aliases', invoices: 'invoices', 'audit-logs': 'logs', 'restore-points': 'points' }[pathname.split('/').pop()]
    data = { [field]: field === 'dispatches' ? sampleDispatches : [] }
  } else if (pathname === '/api/eta/usage') data = { isSubscribed: false, dailyCount: 0, dailyLimit: 10, submissionsCount: 0 }
  else if (pathname === '/api/eta/settings') data = { settings: null }
  else if (pathname === '/api/eta/operations') data = { operations: [] }
  else if (pathname === '/api/eta/customers') data = { customers: [] }
  else if (pathname === '/api/eta/drafts') data = { drafts: [sampleDraft] }
  else if (pathname === '/api/eta/drafts/design-draft') data = { draft: sampleDraft }
  else if (pathname === '/api/admin/stats') data = { stats: { totalUsers: 0, subscribedUsers: 0, suspendedUsers: 0, adminUsers: 0 } }
  else return { status: 404, body: { success: false, message: 'هذه العملية غير متاحة في معاينة التصميم المحلية.' } }
  return { status: 200, body: { success: true, designPreview: true, ...data } }
}

export function designPreviewPlugin({ taggedOnly = false } = {}) {
  return {
    name: 'fawterx-local-design-preview', apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (taggedOnly && req.headers['x-fawterx-showcase'] !== '1') return next()
        const response = previewResponse(req.method, req.url)
        if (!response) return next()
        res.statusCode = response.status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(response.body))
      })
    },
  }
}
