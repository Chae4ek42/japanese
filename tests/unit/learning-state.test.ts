import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDefaultAppState, normalizeAppState } from '../../src/shared/state/app-state.ts'
import { sanitizeTheoryState } from '../../src/shared/state/slices/theory.ts'
import { sanitizeContextState } from '../../src/shared/state/slices/contexts.ts'

describe('learning data persistence', () => {
  it('opens existing backups without creating false learning evidence', () => {
    const state = normalizeAppState({ version: 32, vocab: { myWords: [] } })!
    assert.deepEqual(state.theory, { lessons: {} })
    assert.deepEqual(state.contexts, { examples: [], stats: {} })
  })

  it('keeps explicit reading/check evidence and original sentence across a backup roundtrip', () => {
    const state = createDefaultAppState()
    state.theory.lessons.verbs = { readAt: 10, checkAttempts: 2, lastCheckAt: 20, lastScore: 1, questionCount: 2 }
    state.contexts = { examples: [{ id: 'ctx1', wordId: 'w1', sentence: '水を飲みます。', surface: '水',
      sourceKind: 'reader', sourceId: 'text1', sourceTitle: 'Мой текст', createdAt: 30 }],
      stats: { ctx1: { attempts: 3, correct: 2, lastAt: 40 } } }
    const restored = normalizeAppState(JSON.parse(JSON.stringify(state)))!
    assert.deepEqual(restored.theory, state.theory)
    assert.deepEqual(restored.contexts, state.contexts)
  })

  it('normalizes impossible counts and drops incomplete examples', () => {
    assert.equal(sanitizeTheoryState({ lessons: { x: { lastScore: 100, questionCount: 2 } } }).lessons.x?.lastScore, 2)
    assert.deepEqual(sanitizeContextState({ examples: [{ id: 'x', wordId: 'w', sentence: '文', surface: '語' }] }).examples, [])
    assert.deepEqual(sanitizeContextState({ examples: [], stats: { missing: { attempts: 10, correct: 20, lastAt: 0 } } }).stats, {})
  })
})
