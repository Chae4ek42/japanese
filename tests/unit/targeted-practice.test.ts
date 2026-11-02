import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { consumeTargetedPractice, readTargetedPractice, requestTargetedPractice, TARGETED_PRACTICE_KEY } from '../../src/shared/lib/targetedPractice.ts'

const store = new Map<string, string>()
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
} })

describe('targeted practice navigation intent', () => {
  beforeEach(() => store.clear())
  it('survives repeated render reads and is consumed once by the matching trainer', () => {
    requestTargetedPractice({ section: 'kana', cardIds: ['a', 'b', 'a'] })
    assert.deepEqual(readTargetedPractice('kana')?.cardIds, ['a', 'b'])
    assert.deepEqual(readTargetedPractice('kana')?.cardIds, ['a', 'b'])
    assert.equal(consumeTargetedPractice('verbs'), null)
    assert.deepEqual(consumeTargetedPractice('kana')?.cardIds, ['a', 'b'])
    assert.equal(consumeTargetedPractice('kana'), null)
  })
  it('rejects stale, malformed and empty intents', () => {
    for (const value of [
      '{broken', JSON.stringify({ section: 'kana', cardIds: [], createdAt: Date.now() }),
      JSON.stringify({ section: 'kana', cardIds: ['a'], createdAt: Date.now() - 660_000 }),
      JSON.stringify({ section: 'kana', cardIds: [2], createdAt: Date.now() }),
    ]) {
      store.set(TARGETED_PRACTICE_KEY, value)
      assert.equal(readTargetedPractice('kana'), null)
    }
  })
})
