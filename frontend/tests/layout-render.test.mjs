import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

test('authenticated workspace renders with the tutorial open and closed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fawterx-layout-test-'))
  const output = join(directory, 'render.cjs')
  try {
    await build({
      stdin: {
        contents: `
          import React from 'react'
          import { renderToStaticMarkup } from 'react-dom/server'
          import { MemoryRouter } from 'react-router-dom'
          import { Layout, AppContext } from './src/App.jsx'
          export function renderWorkspace(showTutorialModal) {
            const noop = () => {}
            const context = {
              lang: 'ar', setLang: noop, t: { footer: 'Test workspace' },
              user: { displayName: 'Test User', email: 'test@example.invalid' },
              isAdmin: false, hasWarehouseAccess: false, handleLogout: noop,
              showTutorialModal, setShowTutorialModal: noop,
            }
            return renderToStaticMarkup(
              <AppContext.Provider value={context}>
                <MemoryRouter><Layout><div>WORKSPACE_CONTENT</div></Layout></MemoryRouter>
              </AppContext.Provider>
            )
          }
        `,
        resolveDir: resolve(import.meta.dirname, '..'),
        loader: 'jsx',
      },
      bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: output,
      define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"', 'window.location.hostname': '"localhost"' },
      logLevel: 'silent',
    })
    const { renderWorkspace } = createRequire(import.meta.url)(output)
    for (const tutorialOpen of [false, true]) {
      const html = renderWorkspace(tutorialOpen)
      assert.ok(html.includes('WORKSPACE_CONTENT'))
      assert.ok(html.includes('id="workspace-navigation"'))
      assert.ok(html.includes('id="workspace-content"'))
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
