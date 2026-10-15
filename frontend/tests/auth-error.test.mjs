import test from 'node:test'
import assert from 'node:assert/strict'
import { googleLoginError } from '../src/utils/authError.mjs'
test('sign-in failures distinguish origin and popup configuration', () => {
  assert.match(googleLoginError({ code: 'auth/unauthorized-domain' }), /localhost/)
  assert.match(googleLoginError({ code: 'auth/popup-blocked' }), /النوافذ المنبثقة/)
  assert.match(googleLoginError({ code: 'auth/network-request-failed' }, 'en'), /connectivity/)
})
test('error display includes code without exposing raw error payloads', () => {
  assert.match(googleLoginError({ code: 'auth/internal-error', message: 'secret' }), /auth\/internal-error/)
  assert.doesNotMatch(googleLoginError({ message: 'secret' }), /secret/)
})
