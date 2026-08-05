import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  masteryOutcomeFromRound,
  startReviewPracticeSession,
} from '../../src/features/vocab/reviewSession.ts'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/slices/vocab.ts'
import type { VocabCard } from '../../src/shared/lib/types'

function card(id: string): VocabCard {
  return {
    id,
    writing: id,
    kana: id,
    romaji: id,
    answers: [id],
    meaning: id,
    meanings: [id],
  }
}

describe('masteryOutcomeFromRound', () => {
  it('считает медленный/обычный успех как correct, не hint', () => {
    assert.equal(masteryOutcomeFromRound({ wrong: false }), 'correct')
    assert.equal(
      masteryOutcomeFromRound({ wrong: false, hintUsed: false, wrongRecorded: false }),
      'correct',
    )
  })

  it('пишет wrong для провала и восстановления после ошибки', () => {
    assert.equal(masteryOutcomeFromRound({ wrong: true }), 'wrong')
    assert.equal(masteryOutcomeFromRound({ wrong: false, dontKnow: true }), 'wrong')
    assert.equal(masteryOutcomeFromRound({ wrong: false, wrongRecorded: true }), 'wrong')
  })

  it('пишет hint только после подсказки без ошибки', () => {
    assert.equal(masteryOutcomeFromRound({ wrong: false, hintUsed: true }), 'hint')
  })
})

describe('startReviewPracticeSession', () => {
  it('держит весь scope из «Слов за раз», не урезая до квоты новых', () => {
    const scope = Array.from({ length: 12 }, (_, i) => card(`w${i}`))
    const { session, planEmpty, newCount } = startReviewPracticeSession({
      scope,
      preferences: { ...DEFAULT_VOCAB_PREFERENCES, pickMode: 'adaptive', sessionMinutes: 15 },
      memory: {},
      stats: {},
      newUsedToday: 40,
    })

    assert.equal(planEmpty, false)
    assert.equal(session.poolIds.length, 12)
    assert.equal(newCount, 12)
  })
})
