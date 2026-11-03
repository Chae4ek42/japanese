import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CardTrainerLiveSession } from '../../src/shared/lib/types.ts'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/slices/vocab.ts'
import { createVocabTrainingSession, trainingSessionPoolLabel, updateVocabTrainingSession } from '../../src/features/vocab/trainingSessions.ts'

describe('independent vocabulary workouts', () => {
  it('starts with even picking and independent preference arrays', () => {
    const a = createVocabTrainingSession('a', DEFAULT_VOCAB_PREFERENCES, ' Первая ', 100)
    const b = createVocabTrainingSession('b', DEFAULT_VOCAB_PREFERENCES, 'Вторая', 200)
    assert.equal(a.name, 'Первая')
    assert.equal(a.preferences.sessionMode, 'drill')
    assert.equal(a.preferences.pickMode, 'even')
    a.preferences.selectedKanji.push('日')
    assert.deepEqual(b.preferences.selectedKanji, [])
    assert.deepEqual(DEFAULT_VOCAB_PREFERENCES.selectedKanji, [])
    assert.equal(a.liveSession, null)
    assert.equal(a.createdAt, 100)
  })

  it('saves progress and changed settings only in the selected workout', () => {
    const a = createVocabTrainingSession('a', DEFAULT_VOCAB_PREFERENCES, 'Первая', 100)
    const b = createVocabTrainingSession('b', DEFAULT_VOCAB_PREFERENCES, 'Вторая', 100)
    const live: CardTrainerLiveSession = {
      session: { poolIds: ['one', 'two'], recentHistory: ['one'], lastCardId: 'one', mistakeQueue: [], sinceQueuePick: 0, mode: 'even' },
      currentCardId: 'two', view: 'practice', sessionStats: { answered: 1, clean: 1, streak: 1 },
    }
    const saved = updateVocabTrainingSession([a, b], 'a', {
      liveSession: live, preferences: { ...a.preferences, source: 'problem' },
    }, 300)
    assert.equal(saved[0].liveSession, live)
    assert.equal(saved[0].preferences.source, 'problem')
    assert.equal(saved[0].updatedAt, 300)
    assert.equal(saved[0].createdAt, 100)
    assert.equal(saved[1], b)
    assert.equal(b.liveSession, null)
    assert.equal(a.liveSession, null)
    assert.equal(a.updatedAt, 100)
    assert.equal(updateVocabTrainingSession(saved, 'deleted', { liveSession: live }), saved)
  })

  it('normalizes obsolete SRS when creating a dedicated incoming workout', () => {
    const session = createVocabTrainingSession('incoming', {
      ...DEFAULT_VOCAB_PREFERENCES, source: 'kanji', selectedKanji: ['日'], sessionMode: 'srs',
    }, 'Из библиотеки')
    assert.equal(session.preferences.sessionMode, 'drill')
    assert.equal(session.preferences.pickMode, 'even')
    assert.equal(session.preferences.source, 'kanji')
    assert.deepEqual(session.preferences.selectedKanji, ['日'])
  })

  it('describes the effective review pool instead of an unused drill source', () => {
    const preferences = { ...DEFAULT_VOCAB_PREFERENCES, sessionMode: 'adaptive' as const, source: 'level' as const }
    assert.equal(trainingSessionPoolLabel(preferences), 'Мои слова')
    assert.equal(trainingSessionPoolLabel({ ...preferences, reviewScope: 'problem' }), 'Проблемные слова')
  })
})
