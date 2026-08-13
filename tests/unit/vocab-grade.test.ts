import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createInitialSession, createStatsRecord } from '../../src/shared/lib/trainer.ts'
import {
  applyOptimisticStat,
  dropCardFromPracticeSession,
  nextSessionAfterVocabGrade,
  problemWordIdsForCard,
} from '../../src/features/vocab/vocabGrade.ts'
import type { VocabCard } from '../../src/shared/lib/types.ts'

const card: VocabCard = {
  id: 'w1',
  writing: '水',
  kana: 'みず',
  romaji: 'mizu',
  answers: ['mizu'],
  meaning: 'вода',
  meanings: ['вода'],
}

describe('vocab grade helpers', () => {
  it('оптимистичная статистика считает clear / wrong / hint', () => {
    const afterClear = applyOptimisticStat(undefined, 'correct')
    assert.equal(afterClear.clears, 1)
    assert.equal(afterClear.eventAccuracy, 100)
    const afterWrong = applyOptimisticStat(afterClear, 'wrong')
    assert.equal(afterWrong.errors, 1)
    assert.equal(afterWrong.eventAccuracy, 50)
    const afterHint = applyOptimisticStat(afterWrong, 'hint')
    assert.equal(afterHint.hints, 1)
    assert.equal(afterHint.recentAnswers?.length, 2)
  })

  it('успех убирает карточку из очереди ошибок', () => {
    const session = createInitialSession({
      poolIds: ['w1', 'w2'],
      mistakeQueue: ['w1'],
    })
    const next = nextSessionAfterVocabGrade({
      session,
      cardId: 'w1',
      grade: 4,
      wrong: false,
      hintUsed: false,
      statsOutcome: 'correct',
      clean: true,
      usesReviewV2: false,
      pool: [card],
    })
    assert.ok(!next.mistakeQueue.includes('w1'))
    assert.equal(next.lastCardId, 'w1')
  })

  it('ошибка ставит карточку в очередь', () => {
    const session = createInitialSession({ poolIds: ['w1'] })
    const next = nextSessionAfterVocabGrade({
      session,
      cardId: 'w1',
      grade: 1,
      wrong: true,
      hintUsed: false,
      statsOutcome: 'wrong',
      clean: false,
      usesReviewV2: false,
      pool: [card],
    })
    assert.deepEqual(next.mistakeQueue, ['w1'])
  })

  it('drop убирает id из пула и очереди', () => {
    const session = createInitialSession({
      poolIds: ['w1', 'w2'],
      mistakeQueue: ['w1'],
      lastCardId: 'w1',
    })
    const next = dropCardFromPracticeSession(session, 'w1', {
      usesReviewV2: false,
      fallbackPoolIds: ['w1', 'w2'],
    })
    assert.deepEqual(next.poolIds, ['w2'])
    assert.deepEqual(next.mistakeQueue, [])
    assert.equal(next.lastCardId, null)
  })

  it('problem ids берёт варианты', () => {
    assert.deepEqual(problemWordIdsForCard(card), ['w1'])
    assert.deepEqual(problemWordIdsForCard({ ...card, variantIds: ['a', 'b'] }), ['a', 'b'])
  })
})

describe('createStatsRecord baseline', () => {
  it('пустая запись не считается проблемной статистикой', () => {
    const empty = createStatsRecord()
    assert.equal(empty.clears + empty.errors + empty.hints, 0)
  })
})
