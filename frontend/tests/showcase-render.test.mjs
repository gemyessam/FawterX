import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

test('each showcase surface renders with sample inputs without a browser or live API', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fawterx-showcase-test-'))
  try {
    const output = join(directory, 'render.cjs')
    await build({
      stdin:{
        contents:`
          import React from 'react'
          import {renderToStaticMarkup} from 'react-dom/server'
          import DesignShowcase, {showcaseScreens} from './src/pages/DesignShowcase.jsx'
          import {TRANSLATIONS} from './src/App.jsx'
          export function renderScreens() {
            return showcaseScreens.map(([id]) => [id,renderToStaticMarkup(<DesignShowcase translations={TRANSLATIONS} initialScreen={id} />)])
          }
        `,
        resolveDir:resolve(import.meta.dirname,'..'), loader:'jsx',
      },
      bundle:true, platform:'node',format:'cjs',jsx:'automatic',outfile:output,
      banner:{js:'const fixtureStorage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};'},
      define:{'import.meta.env':'{"DEV":true}', 'process.env.NODE_ENV':'"production"', 'window.location.hostname':'"localhost"','window.location.pathname':'"/design-showcase"','localStorage':'fixtureStorage'},
      logLevel:'silent',
    })
    const {renderScreens} = createRequire(import.meta.url)(output)
    const rendered = renderScreens()
    assert.equal(rendered.length,26)
    for(const [id,html] of rendered) {
      assert.ok(html.includes('fx-showcase-stage'),id)
      assert.ok(html.includes('بيانات تجريبية منفصلة'),id)
      assert.ok(html.includes('aria-current="page"'),id)
    }
  } finally {
    await rm(directory,{recursive:true,force:true})
  }
})
