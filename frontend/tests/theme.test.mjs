import test from 'node:test'
import assert from 'node:assert/strict'
import { readTheme, saveTheme, nextTheme, startThemeTransition } from '../src/utils/theme.mjs'

test('light is the default for missing or invalid preferences', () => {
  for (const value of [null, 'green', '']) assert.equal(readTheme({ getItem: () => value }), 'light')
})
test('saved light and dark preferences are respected', () => {
  for (const value of ['light', 'dark']) assert.equal(readTheme({ getItem: () => value }), value)
})
test('storage errors do not prevent the UI rendering', () => {
  const storage = { getItem() { throw new Error('unavailable') }, setItem() { throw new Error('unavailable') } }
  assert.equal(readTheme(storage), 'light')
  assert.doesNotThrow(() => saveTheme('dark', storage))
})
test('toggle changes theme and saves the selected preference', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'light')
  let saved
  saveTheme('dark', { setItem: (key, value) => { saved = [key, value] } })
  assert.deepEqual(saved, ['fawterx_theme', 'dark'])
})

test('theme transition starts at the toggle and removes its temporary state', () => {
  const classes = new Set()
  const properties = new Map()
  let finishTransition
  const root = {
    offsetWidth: 1,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    style: { setProperty: (name, value) => properties.set(name, value) },
  }
  const document = { documentElement: root }
  const window = {
    innerWidth: 1000,
    innerHeight: 800,
    matchMedia: () => ({ matches: false }),
    setTimeout: (callback) => { finishTransition = callback; return 1 },
    clearTimeout: () => {},
  }

  startThemeTransition({ currentTarget: { getBoundingClientRect: () => ({ left: 400, top: 20, width: 40, height: 40 }) } }, { document, window })
  assert.equal(properties.get('--theme-transition-x'), '42%')
  assert.equal(properties.get('--theme-transition-y'), '5%')
  assert.equal(classes.has('theme-transitioning'), true)
  finishTransition()
  assert.equal(classes.has('theme-transitioning'), false)
})

test('theme transition respects reduced-motion preference', () => {
  let timerStarted = false
  const root = {
    classList: { add() { throw new Error('transition should not start') }, remove() {} },
    style: { setProperty() { throw new Error('transition should not start') } },
  }
  startThemeTransition(undefined, {
    document: { documentElement: root },
    window: {
      matchMedia: () => ({ matches: true }),
      setTimeout: () => { timerStarted = true },
      clearTimeout() {},
    },
  })
  assert.equal(timerStarted, false)
})
