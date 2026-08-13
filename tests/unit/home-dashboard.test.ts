import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectContinueItems,
  continueItemFromLiveSession,
  countHomeVocabDue,
} from '../../src/features/home/dashboard.ts'
import { memoryKey } from '../../src/shared/lib/review/memory.ts'
import type { CardTrainerLiveSession, MemoryState } from '../../src/shared/lib/types.ts'

function liveSession(answered: number): CardTrainerLiveSession {
  return {
    view: 'practice',
    currentCardId: 'a',
    session: {
      poolIds: ['a'],
      recentHistory: [],
      lastCardId: null,
      mistakeQueue: [],
      sinceQueuePick: 0,
      mode: 'adaptive',
    },
    sessionStats: { answered, clean: 0, streak: 0 },
  }
}

describe('home dashboard', () => {
  it('собирает незавершённые сессии в порядке слов → кана → частицы → глаголы → числа', () => {
    const items = collectContinueItems({
      numbers: liveSession(2),
      kana: liveSession(4),
      verbs: liveSession(1),
      train: liveSession(9),
    })
    assert.deepEqual(
      items.map((item) => item.page),
      ['train', 'kana', 'verbs', 'numbers'],
    )
    assert.equal(items[0]?.answered, 9)
  })

  it('игнорирует сессию не в practice', () => {
    const idle = liveSession(3)
    idle.view = 'setup'
    assert.equal(continueItemFromLiveSession('kana', 'Кана', 'x', idle), null)
  })

  it('считает due и новые по memory', () => {
    const now = Date.UTC(2026, 7, 13)
    const memory: Record<string, MemoryState> = {
      [memoryKey('due', 1)]: {
        s: 8,
        d: 0.3,
        lastAt: now - 40 * 3_600_000,
        lastPresentedAt: now,
        reps: 3,
        lapses: 0,
        state: 'review',
        uncertain: false,
        modelVersion: 1,
        createdAt: now - 1000,
      },
      [memoryKey('fresh', 1)]: {
        s: 24,
        d: 0.3,
        lastAt: now - 1_000,
        lastPresentedAt: now,
        reps: 4,
        lapses: 0,
        state: 'review',
        uncertain: false,
        modelVersion: 1,
        createdAt: now - 1000,
      },
    }
    const counts = countHomeVocabDue({
      myWords: ['due', 'fresh', 'new-word'],
      memory,
      targetRetention: 0.9,
      now,
    })
    assert.equal(counts.due, 1)
    assert.equal(counts.newCards, 1)
  })
})
