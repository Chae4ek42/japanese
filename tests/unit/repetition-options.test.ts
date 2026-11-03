import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDefaultAppState, normalizeAppState } from '../../src/shared/state/app-state.ts'
import { buildVocabPool } from '../../src/features/vocab/pool.ts'
import { createStatsRecord } from '../../src/shared/lib/trainer.ts'
import { rankedProblemWordIds } from '../../src/features/vocab/problemWords.ts'
import { startReviewPracticeSession } from '../../src/features/vocab/reviewSession.ts'

describe('repetition options and migration', () => {
  it('limits repetition to the worst qualified saved words and keeps the selected window size', () => {
    const state = createDefaultAppState()
    const vocab = state.vocab
    for (let i = 0; i < 10; i++) {
      const id = `custom:w${i}`
      vocab.myWords.push(id)
      vocab.customWords[id] = { id, writing: `語${i}`, kana: 'ご', romaji: 'go', meanings: ['слово'], kanji: [] }
      vocab.stats[id] = { ...createStatsRecord(), recentAnswers: i < 6 ? ['wrong', 'wrong', 'wrong', 'wrong', 'wrong'] : ['wrong', 'correct', 'correct', 'correct'] }
    }
    const preferences = { ...vocab.preferences, sessionMode: 'adaptive' as const,
      reviewScope: 'problem' as const, reviewProblemLimit: 4, reviewWindowSize: 7 }
    const pool = buildVocabPool(preferences, vocab.myWords, vocab.customWords, {
      problemWordIds: rankedProblemWordIds(Object.keys(vocab.stats), vocab.stats),
    })
    assert.equal(pool.length, 4)
    assert.ok(pool.every((card) => Number(card.id.split('w')[1]) < 6))
    const planned = startReviewPracticeSession({ scope: pool, preferences, stats: vocab.stats, memory: {}, newUsedToday: 0 })
    assert.equal(planned.session.adaptive?.windowSize, 7)
  })

  it('does not fill a problem-only session with untested or recovered words', () => {
    const vocab = createDefaultAppState().vocab
    const pool = buildVocabPool({ ...vocab.preferences, sessionMode: 'adaptive', reviewScope: 'problem' }, [], {}, { problemWordIds: [] })
    assert.deepEqual(pool, [])
  })

  it('migrates the old singleton interval session without losing the current card or counters', () => {
    const state = createDefaultAppState()
    const { trainingSessions: _sessions, activeSessionId: _active, ...legacyVocab } = state.vocab
    legacyVocab.preferences = { ...state.vocab.preferences, sessionMode: 'srs', source: 'mine' }
    legacyVocab.liveSession = {
      session: { poolIds: ['w'], recentHistory: [], lastCardId: 'w', mistakeQueue: [], sinceQueuePick: 0, mode: 'adaptive', vocabMode: 'srs' },
      currentCardId: 'w', view: 'practice', sessionStats: { answered: 7, clean: 5, streak: 2 },
    }
    const restored = normalizeAppState({ ...state, vocab: legacyVocab })!
    assert.equal(restored.vocab.preferences.sessionMode, 'drill')
    assert.equal(restored.vocab.trainingSessions.length, 1)
    assert.equal(restored.vocab.trainingSessions[0]?.liveSession?.currentCardId, 'w')
    assert.equal(restored.vocab.trainingSessions[0]?.liveSession?.sessionStats.answered, 7)
    assert.equal(restored.vocab.trainingSessions[0]?.liveSession?.session.vocabMode, 'drill')
  })
})
