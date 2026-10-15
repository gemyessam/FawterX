import test from 'node:test'
import assert from 'node:assert/strict'
import { getMeteorVelocity, advanceMeteor, advanceSnowflake } from '../src/utils/skyEffects.mjs'

test('dark-mode meteors share one diagonal travel direction with varied speed', () => {
  const slow = getMeteorVelocity(24)
  const fast = getMeteorVelocity(82)

  assert.ok(slow.vx < 0 && slow.vy > 0)
  assert.ok(fast.vx < 0 && fast.vy > 0)
  assert.ok(Math.abs(slow.vy / slow.vx - fast.vy / fast.vx) < 0.001)
  assert.ok(Math.hypot(fast.vx, fast.vy) > Math.hypot(slow.vx, slow.vy))
})

test('meteors advance smoothly in the shared direction and wrap from the leading edge', () => {
  const meteor = { x: 101, y: 80, vx: -60, vy: 18 }
  const moved = advanceMeteor(meteor, 0.5, 100, 100, 12)
  const wrapped = advanceMeteor({ ...moved, x: -8, y: 99 }, 0.1, 100, 100, 12)

  assert.equal(moved.x, 71)
  assert.equal(moved.y, 89)
  assert.ok(wrapped.x > 100)
  assert.ok(wrapped.y >= 0 && wrapped.y <= 100)
})

test('light-mode snow drifts downward and loops back to the sky', () => {
  const snow = { x: 30, y: 95, vx: 4, vy: 20 }
  const moved = advanceSnowflake(snow, 0.25, 100, 100)
  const wrapped = advanceSnowflake(moved, 0.5, 100, 100)

  assert.equal(moved.x, 31)
  assert.equal(moved.y, 100)
  assert.ok(wrapped.y < 0)
})
