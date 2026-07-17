import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_HYPERPARAMS,
  createEmptyHistory,
  createInitialSession,
  createStatsRecord,
  evaluateInput,
  evaluateSubmission,
  getAdaptiveWeight,
  getConfusionMultiplier,
  getDayKey,
  getTopConfusions,
  pickNextCardId,
  recordConfusion,
  recordHistoryEvent,
  updateCardStats,
} from '../../src/shared/lib/trainer'
import { buildNumberPool } from '../../src/data/numbers'
import { buildPool } from '../../src/data/kana'

const H = DEFAULT_HYPERPARAMS
const NOW = Date.parse('2026-07-07T12:00:00Z')

describe('evaluateInput (автозачет)', () => {
  it('пустой ввод', () => {
    assert.equal(evaluateInput(['shi', 'si'], ''), 'empty')
  })

  it('точное совпадение с любым из ответов', () => {
    assert.equal(evaluateInput(['shi', 'si'], 'shi'), 'correct')
    assert.equal(evaluateInput(['shi', 'si'], 'si'), 'correct')
  })

  it('префикс правильного ответа еще не ошибка', () => {
    assert.equal(evaluateInput(['shi', 'si'], 'sh'), 'pending')
  })

  it('ошибка на первой неверной букве', () => {
    assert.equal(evaluateInput(['shi', 'si'], 'x'), 'wrong')
    assert.equal(evaluateInput(['shi', 'si'], 'sho'), 'wrong')
  })
})

describe('evaluateSubmission (режим Enter)', () => {
  it('принимает только полный правильный ответ', () => {
    assert.equal(evaluateSubmission(['tsu', 'tu'], 'tsu'), 'correct')
    assert.equal(evaluateSubmission(['tsu', 'tu'], 'ts'), 'wrong')
    assert.equal(evaluateSubmission(['tsu', 'tu'], ''), 'empty')
  })
})

describe('updateCardStats', () => {
  it('верный ответ растит мастерство и пишет время', () => {
    const before = createStatsRecord()
    const after = updateCardStats(before, 'correct', { now: NOW, latencyMs: 1500, mistakesOnCard: 0, hintUsed: false }, H)
    assert.ok(after.mastery > before.mastery)
    assert.equal(after.clears, 1)
    assert.equal(after.streak, 1)
    assert.equal(after.avgLatencyMs, 1500)
    assert.equal(after.fastestLatencyMs, 1500)
  })

  it('быстрый ответ дает больший прирост, чем медленный', () => {
    const base = createStatsRecord()
    const fast = updateCardStats(base, 'correct', { now: NOW, latencyMs: H.targetLatencyMs * 0.5, mistakesOnCard: 0, hintUsed: false }, H)
    const slow = updateCardStats(base, 'correct', { now: NOW, latencyMs: H.targetLatencyMs * 2, mistakesOnCard: 0, hintUsed: false }, H)
    assert.ok(fast.mastery > slow.mastery)
  })

  it('ошибка по Enter штрафует сильнее, чем в автозачете', () => {
    const base = { ...createStatsRecord(), mastery: 0.6 }
    const submitWrong = updateCardStats(base, 'wrong', { now: NOW, inputMode: 'submit' }, H)
    const instantWrong = updateCardStats(base, 'wrong', { now: NOW, inputMode: 'instant' }, H)
    assert.ok(submitWrong.mastery < instantWrong.mastery)
    assert.equal(submitWrong.streak, 0)
  })

  it('подсказка сбрасывает серию, снижает мастерство и учитывает время', () => {
    const base = { ...createStatsRecord(), mastery: 0.5, streak: 4 }
    const after = updateCardStats(base, 'hint', { now: NOW, latencyMs: 3000 }, H)
    assert.equal(after.streak, 0)
    assert.ok(after.mastery < 0.5)
    assert.equal(after.avgLatencyMs, 3000)
  })
})

describe('getAdaptiveWeight', () => {
  it('медленная карточка весит больше быстрой при прочих равных', () => {
    const fast = { ...createStatsRecord(), clears: 5, mastery: 0.5, avgLatencyMs: 1200, lastSeenAt: NOW }
    const slow = { ...fast, avgLatencyMs: H.targetLatencyMs * 2.2 }
    assert.ok(getAdaptiveWeight(slow, H, NOW) > getAdaptiveWeight(fast, H, NOW))
  })

  it('выученная серия снижает вес', () => {
    const normal = { ...createStatsRecord(), clears: 3, mastery: 0.5, lastSeenAt: NOW }
    const retired = { ...normal, streak: H.retireStreak }
    assert.ok(getAdaptiveWeight(retired, H, NOW) < getAdaptiveWeight(normal, H, NOW))
  })

  it('никогда не показанные карточки весят больше отработанных', () => {
    const unseen = createStatsRecord()
    const mastered = {
      ...createStatsRecord(),
      exposures: 40,
      clears: 35,
      mastery: 0.92,
      streak: H.retireStreak,
      lastSeenAt: NOW - 60_000,
      avgLatencyMs: 900,
      eventAccuracy: 98,
    }
    assert.ok(getAdaptiveWeight(unseen, H, NOW) > getAdaptiveWeight(mastered, H, NOW) * 2)
  })

  it('давно не виденные карточки поднимаются выше недавних', () => {
    const stale = {
      ...createStatsRecord(),
      exposures: 10,
      clears: 8,
      mastery: 0.7,
      lastSeenAt: NOW - 48 * 3_600_000,
      eventAccuracy: 90,
    }
    const recent = { ...stale, lastSeenAt: NOW - 30 * 60_000 }
    assert.ok(getAdaptiveWeight(stale, H, NOW) > getAdaptiveWeight(recent, H, NOW))
  })
})

describe('getConfusionMultiplier', () => {
  it('буст после недавней ошибки на двойнике', () => {
    const statsMap = Object.fromEntries(
      ['katakana:shi', 'katakana:tsu'].map((id) => [id, createStatsRecord()]),
    )
    statsMap['katakana:tsu'].lastErrorAt = NOW - 60_000
    assert.equal(getConfusionMultiplier('katakana:shi', statsMap, H, NOW), H.confusionBoost)
  })

  it('без недавних ошибок множитель равен 1', () => {
    const statsMap = Object.fromEntries(
      ['katakana:shi', 'katakana:tsu'].map((id) => [id, createStatsRecord()]),
    )
    assert.equal(getConfusionMultiplier('katakana:shi', statsMap, H, NOW), 1)
  })
})

describe('pickNextCardId', () => {
  function makeStatsMap(pool: Array<{ id: string }>) {
    return Object.fromEntries(pool.map((card) => [card.id, createStatsRecord()]))
  }

  function makeSession(overrides: Partial<ReturnType<typeof createInitialSession>> = {}) {
    return createInitialSession(overrides)
  }

  it('возвращает карточку из пула и избегает недавних', () => {
    const pool = buildPool('hiragana', ['vowels'])
    const statsMap = makeStatsMap(pool)
    const session = makeSession({ recentHistory: ['hiragana:a', 'hiragana:i'], mistakeQueue: [], sinceQueuePick: 0 })
    for (let i = 0; i < 20; i += 1) {
      const id = pickNextCardId(pool, statsMap, session, 'adaptive', H)
      assert.ok(id)
      assert.ok(pool.some((card) => card.id === id))
      assert.ok(!session.recentHistory.includes(id!))
    }
  })

  it('числа: возвращает карточку из пула и избегает недавних', () => {
    const pool = buildNumberPool({ mode: 'plain', rangeMin: 1, rangeMax: 5 })
    const statsMap = makeStatsMap(pool)
    const session = makeSession({ recentHistory: ['plain:1', 'plain:2'], mistakeQueue: [], sinceQueuePick: 0 })
    for (let i = 0; i < 20; i += 1) {
      const id = pickNextCardId(pool, statsMap, session, 'adaptive', H)
      assert.ok(id)
      assert.ok(pool.some((card) => card.id === id))
      assert.ok(!session.recentHistory.includes(id!))
    }
  })

  it('очередь ошибок возвращает карточку в любом режиме', () => {
    const pool = buildNumberPool({ mode: 'plain', rangeMin: 1, rangeMax: 5 })
    const statsMap = makeStatsMap(pool)
    const session = makeSession({ recentHistory: [], mistakeQueue: ['plain:4'], sinceQueuePick: 3 })
    const id = pickNextCardId(pool, statsMap, session, 'even', H, () => 0.1)
    assert.equal(id, 'plain:4')
  })

  it('очередь не срабатывает сразу после ошибки', () => {
    const pool = buildNumberPool({ mode: 'plain', rangeMin: 1, rangeMax: 5 })
    const statsMap = makeStatsMap(pool)
    const session = makeSession({ recentHistory: [], mistakeQueue: ['plain:4'], sinceQueuePick: 0 })
    const id = pickNextCardId(pool, statsMap, session, 'even', H, () => 0.1)
    assert.notEqual(id, 'plain:4')
  })

  it('пустой пул дает null', () => {
    assert.equal(pickNextCardId([], {}, makeSession(), 'adaptive', H), null)
  })
})

describe('история для графиков', () => {
  it('дневная запись накапливает исходы и время', () => {
    let history = createEmptyHistory()
    history = recordHistoryEvent(history, 'correct', { now: NOW, latencyMs: 2000 })
    history = recordHistoryEvent(history, 'wrong', { now: NOW })
    history = recordHistoryEvent(history, 'hint', { now: NOW })
    const day = history.daily[getDayKey(NOW)]
    assert.deepEqual(
      { clears: day.clears, errors: day.errors, hints: day.hints },
      { clears: 1, errors: 1, hints: 1 },
    )
    assert.equal(day.latencySum, 2000)
    assert.equal(history.recent.length, 1)
  })

  it('recent хранит не больше 60 верных ответов', () => {
    let history = createEmptyHistory()
    for (let i = 0; i < 80; i += 1) {
      history = recordHistoryEvent(history, 'correct', { now: NOW + i, latencyMs: 1000 + i })
    }
    assert.equal(history.recent.length, 60)
    assert.equal(history.recent.at(-1)!.l, 1079)
  })

  it('путаницы агрегируются и сортируются', () => {
    let history = createEmptyHistory()
    history = recordConfusion(history, 'katakana:shi', 'katakana:tsu')
    history = recordConfusion(history, 'katakana:shi', 'katakana:tsu')
    history = recordConfusion(history, 'katakana:so', 'katakana:n')
    const top = getTopConfusions(history)
    assert.equal(top[0].fromId, 'katakana:shi')
    assert.equal(top[0].count, 2)
    assert.equal(top.length, 2)
  })
})
