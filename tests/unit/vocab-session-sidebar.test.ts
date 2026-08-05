import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sortSessionCards, wordDisplayAccuracy } from '../../src/features/vocab/VocabSessionSidebar.tsx'
import type { StatsRecord, VocabCard } from '../../src/shared/lib/types'
import { createStatsRecord } from '../../src/shared/lib/trainer'

function card(id: string): VocabCard {
  return {
    id,
    writing: id,
    meaning: id,
    answers: [id],
    kana: id,
    romaji: id,
    meanings: [id],
  }
}

function stats(patch: Partial<StatsRecord>): StatsRecord {
  return { ...createStatsRecord(), ...patch }
}

describe('wordDisplayAccuracy', () => {
  it('считает точность по верным/ошибкам без подсказок', () => {
    assert.deepEqual(
      wordDisplayAccuracy(stats({ clears: 2, errors: 0, hints: 8, eventAccuracy: 20 })),
      { percent: 100, clears: 2, errors: 0 },
    )
  })

  it('предпочитает окно последних ответов', () => {
    assert.deepEqual(
      wordDisplayAccuracy(
        stats({
          clears: 100,
          errors: 0,
          recentAnswers: ['wrong', 'wrong', 'correct'],
        }),
      ),
      { percent: 33, clears: 1, errors: 2 },
    )
  })
})

describe('sortSessionCards', () => {
  const cards = [card('a'), card('b'), card('c')]

  it('сортирует по точности по возрастанию и убыванию', () => {
    const map = {
      a: stats({ clears: 1, errors: 1 }),
      b: stats({ clears: 4, errors: 0 }),
      c: stats({ clears: 0, errors: 2 }),
    }
    assert.deepEqual(
      sortSessionCards(cards, map, 'accuracy-asc').map((item) => item.id),
      ['c', 'a', 'b'],
    )
    assert.deepEqual(
      sortSessionCards(cards, map, 'accuracy-desc').map((item) => item.id),
      ['b', 'a', 'c'],
    )
  })

  it('новизна: по времени добавления в тренировку, новые сверху', () => {
    const map = {
      a: stats({ lastSeenAt: 99999 }),
      b: stats({ lastSeenAt: 0 }),
      c: stats({ lastSeenAt: 1 }),
    }
    const addedAt = { a: 1000, b: 3000, c: 2000 }
    assert.deepEqual(
      sortSessionCards(cards, map, 'novelty', addedAt).map((item) => item.id),
      ['b', 'c', 'a'],
    )
  })

  it('новизна: без метки добавления — более поздний индекс пула выше', () => {
    assert.deepEqual(
      sortSessionCards(cards, {}, 'novelty', {}).map((item) => item.id),
      ['c', 'b', 'a'],
    )
  })
})
