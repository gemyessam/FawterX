// A local UI with authenticated reads from the existing API. No write forwarding.
export function accountPreviewAllows(method, rawUrl) {
  if (method !== 'GET') return false
  const path = new URL(rawUrl, 'http://localhost').pathname
  if (/^\/api\/eta\/(usage|settings|customers|operations|drafts(?:\/[^/]+)?)$/.test(path)) return true
  if (/^\/api\/admin\/(whoami|stats|users(?:\/[^/]+)?)$/.test(path)) return true
  if (/^\/api\/warehouse\/(access|users|projects)$/.test(path)) return true
  return /^\/api\/warehouse\/projects\/[^/]+\/(stock|dispatches|invoices|audit-logs|restore-points|aliases|(?:stock|invoices)\/[^/]+\/movements)$/.test(path)
}

export function accountPreviewPlugin() {
  return {
    name: 'fawterx-local-account-preview', apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!new URL(req.url, 'http://localhost').pathname.startsWith('/api/')) return next()
        if (accountPreviewAllows(req.method, req.url)) return next()
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ success: false, message: 'تجربة حساب حقيقي محليًا: قراءة فقط. الحفظ والتعديل والإرسال غير متاحين.' }))
      })
    },
  }
}
