import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_HYPERPARAMS,
  bumpSessionShow,
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
  appendRecentAnswer,
  countsFromRecentAnswers,
  isProblemByRecentAnswers,
  projectRecentAnswers,
  projectErrorRatioCounts,
  isProblemByErrorRatio,
  PROBLEM_RATIO_WINDOW,
  recordConfusion,
  recordHistoryEvent,
  setCardCooldown,
  successCooldownTurns,
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

  it('хорошо знакомые карточки весят заметно меньше слабых', () => {
    const known = {
      ...createStatsRecord(),
      exposures: 20,
      clears: 18,
      errors: 1,
      mastery: 0.88,
      streak: 3,
      lastSeenAt: NOW - 60_000,
      eventAccuracy: 95,
      avgLatencyMs: 1100,
    }
    const weak = {
      ...createStatsRecord(),
      exposures: 6,
      clears: 2,
      errors: 4,
      mastery: 0.28,
      streak: 0,
      lastSeenAt: NOW - 60_000,
      eventAccuracy: 40,
      avgLatencyMs: 3200,
    }
    assert.ok(getAdaptiveWeight(weak, H, NOW) > getAdaptiveWeight(known, H, NOW) * 5)
  })

  it('пенсия не умножает masteredWeight дважды — stale всё ещё влияет', () => {
    const recentRetired = {
      ...createStatsRecord(),
      exposures: 30,
      clears: 28,
      mastery: 0.9,
      streak: H.retireStreak,
      eventAccuracy: 95,
      lastSeenAt: NOW - 60_000,
    }
    const staleRetired = {
      ...recentRetired,
      lastSeenAt: NOW - 48 * 3_600_000,
    }
    const recentW = getAdaptiveWeight(recentRetired, H, NOW)
    const staleW = getAdaptiveWeight(staleRetired, H, NOW)
    assert.ok(staleW > recentW)
    // Single retirement discount keeps weight above the absolute floor in practice.
    assert.ok(staleW > 0.01)
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

  it('в сессии предпочитает ещё не показанные карточки', () => {
    const pool = Array.from({ length: 8 }, (_, index) => ({ id: `card:${index}` }))
    const statsMap = makeStatsMap(pool)
    for (const card of pool) {
      statsMap[card.id] = {
        ...createStatsRecord(),
        exposures: 5,
        clears: 4,
        mastery: 0.5,
        eventAccuracy: 80,
        lastSeenAt: NOW,
      }
    }
    const session = makeSession({
      recentHistory: [],
      mistakeQueue: [],
      sinceQueuePick: 0,
      showCounts: {
        'card:0': 4,
        'card:1': 4,
        'card:2': 3,
        'card:3': 3,
      },
    })
    const picks = new Map<string, number>()
    for (let i = 0; i < 40; i += 1) {
      const id = pickNextCardId(pool, statsMap, session, 'adaptive', H)
      assert.ok(id)
      picks.set(id!, (picks.get(id!) ?? 0) + 1)
    }
    const freshHits =
      (picks.get('card:4') ?? 0) +
      (picks.get('card:5') ?? 0) +
      (picks.get('card:6') ?? 0) +
      (picks.get('card:7') ?? 0)
    const wornHits =
      (picks.get('card:0') ?? 0) +
      (picks.get('card:1') ?? 0) +
      (picks.get('card:2') ?? 0) +
      (picks.get('card:3') ?? 0)
    assert.equal(wornHits, 0)
    assert.equal(freshHits, 40)
  })

  it('после первого круга предпочитает слабые, а не выученные', () => {
    const pool = Array.from({ length: 6 }, (_, index) => ({ id: `card:${index}` }))
    const statsMap = makeStatsMap(pool)
    for (let index = 0; index < 4; index += 1) {
      statsMap[`card:${index}`] = {
        ...createStatsRecord(),
        exposures: 20,
        clears: 18,
        errors: 1,
        mastery: 0.9,
        streak: 4,
        eventAccuracy: 95,
        lastSeenAt: NOW,
        avgLatencyMs: 1000,
      }
    }
    statsMap['card:4'] = {
      ...createStatsRecord(),
      exposures: 8,
      clears: 2,
      errors: 5,
      mastery: 0.25,
      streak: 0,
      eventAccuracy: 30,
      lastSeenAt: NOW,
      lastErrorAt: NOW - 60_000,
      avgLatencyMs: 3500,
    }
    statsMap['card:5'] = {
      ...createStatsRecord(),
      exposures: 6,
      clears: 1,
      errors: 4,
      mastery: 0.22,
      streak: 0,
      eventAccuracy: 25,
      lastSeenAt: NOW,
      lastErrorAt: NOW - 120_000,
      avgLatencyMs: 4000,
    }
    const showCounts = Object.fromEntries(pool.map((card) => [card.id, 1]))
    const session = makeSession({
      recentHistory: [],
      mistakeQueue: [],
      sinceQueuePick: 0,
      showCounts,
    })
    const picks = new Map<string, number>()
    for (let i = 0; i < 60; i += 1) {
      const id = pickNextCardId(pool, statsMap, session, 'adaptive', H)
      assert.ok(id)
      picks.set(id!, (picks.get(id!) ?? 0) + 1)
    }
    const weakHits = (picks.get('card:4') ?? 0) + (picks.get('card:5') ?? 0)
    const knownHits =
      (picks.get('card:0') ?? 0) +
      (picks.get('card:1') ?? 0) +
      (picks.get('card:2') ?? 0) +
      (picks.get('card:3') ?? 0)
    assert.ok(weakHits > knownHits * 3)
  })

  it('кулдаун после успеха убирает карточку из ближайших пиков', () => {
    const pool = Array.from({ length: 5 }, (_, index) => ({ id: `card:${index}` }))
    const statsMap = makeStatsMap(pool)
    let session = makeSession({
      showCounts: Object.fromEntries(pool.map((card) => [card.id, 1])),
    })
    session = setCardCooldown(session, 'card:0', successCooldownTurns(pool.length, true))
    for (let i = 0; i < 20; i += 1) {
      const id = pickNextCardId(pool, statsMap, session, 'adaptive', H, () => 0)
      assert.notEqual(id, 'card:0')
    }
    session = bumpSessionShow(session, 'card:1')
    // After enough ticks, cooldown can expire; just ensure helper decrements.
    assert.ok((session.cooldowns?.['card:0'] ?? 0) < successCooldownTurns(pool.length, true))
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

describe('isProblemByErrorRatio', () => {
  it('порог строго больше 1:2', () => {
    assert.equal(isProblemByErrorRatio({ errors: 1, clears: 0 }), true)
    assert.equal(isProblemByErrorRatio({ errors: 1, clears: 1 }), true)
    assert.equal(isProblemByErrorRatio({ errors: 1, clears: 2 }), false)
    assert.equal(isProblemByErrorRatio({ errors: 2, clears: 3 }), true)
    assert.equal(isProblemByErrorRatio({ errors: 2, clears: 4 }), false)
    assert.equal(isProblemByErrorRatio({ errors: 0, clears: 0 }), false)
  })

  it('учитывает только последние 15 ответов', () => {
    const oldWrongs = Array.from({ length: 10 }, () => 'wrong' as const)
    const recentGood = Array.from({ length: 15 }, () => 'correct' as const)
    const window = appendRecentAnswer([...oldWrongs, ...recentGood.slice(0, 14)], 'correct')
    assert.equal(window.length, PROBLEM_RATIO_WINDOW)
    assert.equal(isProblemByRecentAnswers(window), false)

    const stillBad = projectRecentAnswers(
      Array.from({ length: 10 }, () => 'wrong' as const),
      'correct',
    )
    assert.deepEqual(countsFromRecentAnswers(stillBad), { errors: 10, clears: 1 })
    assert.equal(isProblemByRecentAnswers(stillBad), true)
  })

  it('проекция учитывает wrong/correct и игнорирует hint', () => {
    const base = ['correct', 'correct', 'wrong'] as const
    assert.deepEqual(projectErrorRatioCounts([...base], 'wrong'), {
      errors: 2,
      clears: 2,
    })
    assert.deepEqual(projectErrorRatioCounts([...base], 'correct'), {
      errors: 1,
      clears: 3,
    })
    assert.deepEqual(projectErrorRatioCounts([...base], 'hint'), {
      errors: 1,
      clears: 2,
    })
  })
})
