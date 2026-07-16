import { getConfusableIds } from '../data/kana.js'

export const DEFAULT_HYPERPARAMS = {
  masteryGain: 0.18,
  mistakePenalty: 0.24,
  hintPenalty: 0.16,
  retireStreak: 6,
  masteredWeight: 0.2,
  recentMistakeBoost: 2.4,
  recentMistakeHours: 12,
  problemThreshold: 0.45,
  queueSize: 4,
  targetLatencyMs: 2500,
  confusionBoost: 1.8,
  unseenBoost: 2.8,
  seenOnlyBoostRatio: 0.55,
  staleBoost: 1.5,
  staleAfterHours: 6,
  staleRampHours: 18,
}

const CONFUSION_RECENCY_MS = 30 * 60_000
const RECENT_ANSWERS_LIMIT = 60
const DAILY_HISTORY_LIMIT = 60

export function createStatsRecord() {
  return {
    exposures: 0,
    clears: 0,
    errors: 0,
    hints: 0,
    streak: 0,
    bestStreak: 0,
    mastery: 0.12,
    avgLatencyMs: 0,
    fastestLatencyMs: 0,
    lastSeenAt: 0,
    lastClearAt: 0,
    lastErrorAt: 0,
    lastHintAt: 0,
    eventAccuracy: 0,
  }
}

export function createEmptyHistory() {
  return {
    daily: {},
    confusions: {},
    recent: [],
  }
}

export function createInitialSession(overrides = {}) {
  return {
    poolIds: [],
    recentHistory: [],
    lastCardId: null,
    mistakeQueue: [],
    sinceQueuePick: 0,
    mode: 'adaptive',
    ...overrides,
  }
}

export function createNextRoundState(shownAt = Date.now()) {
  return {
    shownAt,
    mistakes: 0,
    hintUsed: false,
    confusionLogged: false,
  }
}

// Инкрементальная проверка для режима автозачета: ошибка фиксируется,
// как только ввод перестает быть префиксом любого правильного ответа.
export function evaluateInput(answers, input) {
  if (!input) {
    return 'empty'
  }

  if (answers.includes(input)) {
    return 'correct'
  }

  if (answers.some((answer) => answer.startsWith(input))) {
    return 'pending'
  }

  return 'wrong'
}

// Проверка полного ответа для режима с Enter.
export function evaluateSubmission(answers, input) {
  if (!input) {
    return 'empty'
  }

  return answers.includes(input) ? 'correct' : 'wrong'
}

export function updateCardStats(existingStats, outcome, context, hyperparams) {
  const stats = { ...existingStats }
  const { now } = context

  if (outcome === 'seen') {
    stats.exposures += 1
    stats.lastSeenAt = now
    return withDerivedFields(stats)
  }

  if (outcome === 'wrong') {
    stats.errors += 1
    stats.streak = 0
    stats.lastErrorAt = now
    stats.lastSeenAt = now
    // В режиме с Enter ошибка осознанная (полный ответ), штраф полный;
    // в автозачете срабатывает на первой неверной букве, поэтому мягче.
    const modeFactor = context.inputMode === 'submit' ? 1 : 0.75
    const drop = hyperparams.mistakePenalty * modeFactor * (0.45 + stats.mastery * 0.55)
    stats.mastery = clamp(stats.mastery - drop, 0.02, 1)
    return withDerivedFields(stats)
  }

  if (outcome === 'hint') {
    stats.hints += 1
    stats.streak = 0
    stats.lastHintAt = now
    stats.lastSeenAt = now
    const drop = hyperparams.hintPenalty * (0.45 + stats.mastery * 0.5)
    stats.mastery = clamp(stats.mastery - drop, 0.04, 1)

    const latencyMs = Math.max(200, context.latencyMs || 0)
    stats.avgLatencyMs = stats.avgLatencyMs
      ? Math.round(stats.avgLatencyMs * 0.82 + latencyMs * 0.18)
      : latencyMs
    return withDerivedFields(stats)
  }

  if (outcome === 'correct') {
    stats.clears += 1
    stats.streak += 1
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak)
    stats.lastClearAt = now
    stats.lastSeenAt = now

    const latencyMs = Math.max(200, context.latencyMs || 0)
    stats.fastestLatencyMs = stats.fastestLatencyMs
      ? Math.min(stats.fastestLatencyMs, latencyMs)
      : latencyMs
    stats.avgLatencyMs = stats.avgLatencyMs
      ? Math.round(stats.avgLatencyMs * 0.82 + latencyMs * 0.18)
      : latencyMs

    const target = hyperparams.targetLatencyMs
    const clean = context.mistakesOnCard === 0 && !context.hintUsed
    const fluencyBonus = latencyMs <= target * 0.7 ? 1.18 : latencyMs >= target * 1.7 ? 0.8 : 1
    const recoveryPenalty = clean ? 1 : 0.48
    const streakBonus = 1 + Math.min(stats.streak, hyperparams.retireStreak) * 0.045
    const gain =
      hyperparams.masteryGain *
      (1 - stats.mastery) *
      fluencyBonus *
      recoveryPenalty *
      streakBonus

    stats.mastery = clamp(stats.mastery + gain, 0.02, 1)
    return withDerivedFields(stats)
  }

  return withDerivedFields(stats)
}

function withDerivedFields(stats) {
  const totalEvents = stats.clears + stats.errors + stats.hints
  stats.eventAccuracy = totalEvents ? Math.round((stats.clears / totalEvents) * 100) : 0
  return stats
}

export function getAdaptiveWeight(stats, hyperparams, now) {
  const masteryGap = 1 - stats.mastery
  const totalEvents = stats.clears + stats.errors + stats.hints
  const recentFailureHours = stats.lastErrorAt ? (now - stats.lastErrorAt) / 3_600_000 : Number.POSITIVE_INFINITY
  const recentHintHours = stats.lastHintAt ? (now - stats.lastHintAt) / 3_600_000 : Number.POSITIVE_INFINITY
  const recentMistakeBoost =
    recentFailureHours <= hyperparams.recentMistakeHours ||
    recentHintHours <= hyperparams.recentMistakeHours
      ? hyperparams.recentMistakeBoost
      : 0
  const accuracyPenalty = totalEvents === 0 ? 0.3 : (100 - stats.eventAccuracy) / 100
  const slownessBoost = stats.avgLatencyMs
    ? clamp(stats.avgLatencyMs / hyperparams.targetLatencyMs - 1, 0, 1.5) * 0.7
    : 0
  const streakReducer =
    stats.streak >= hyperparams.retireStreak
      ? hyperparams.masteredWeight
      : 1 - Math.min(stats.streak, hyperparams.retireStreak - 1) * 0.06

  // Новые и «забытые» карточки: никогда не показывались, только видели без ответа,
  // или давно не встречались — получают заметный приоритет над уже отработанными.
  let noveltyBoost = 0
  if (stats.exposures === 0) {
    noveltyBoost = hyperparams.unseenBoost
  } else if (totalEvents === 0) {
    noveltyBoost = hyperparams.unseenBoost * hyperparams.seenOnlyBoostRatio
  } else if (stats.lastSeenAt > 0) {
    const hoursUnseen = (now - stats.lastSeenAt) / 3_600_000
    if (hoursUnseen >= hyperparams.staleAfterHours) {
      noveltyBoost = clamp(hoursUnseen / hyperparams.staleRampHours, 0, hyperparams.staleBoost)
    }
  }

  return clamp(
    (0.15 +
      masteryGap ** 1.6 * 2.5 +
      accuracyPenalty * 1.4 +
      noveltyBoost +
      recentMistakeBoost +
      slownessBoost) *
      streakReducer,
    0.05,
    9,
  )
}

export function getConfusionMultiplier(cardId, statsMap, hyperparams, now) {
  for (const confusableId of getConfusableIds(cardId)) {
    const stats = statsMap[confusableId]
    if (!stats) {
      continue
    }
    const recentError = stats.lastErrorAt && now - stats.lastErrorAt < CONFUSION_RECENCY_MS
    const recentHint = stats.lastHintAt && now - stats.lastHintAt < CONFUSION_RECENCY_MS
    if (recentError || recentHint) {
      return hyperparams.confusionBoost
    }
  }
  return 1
}

export function getCardProblemScore(stats, hyperparams, now) {
  const totalEvents = stats.clears + stats.errors + stats.hints
  const masteryGap = 1 - stats.mastery
  const accuracyGap = totalEvents === 0 ? 0.55 : (100 - stats.eventAccuracy) / 100
  const freshness = stats.lastSeenAt === 0 ? 0.7 : clamp((now - stats.lastSeenAt) / 86_400_000, 0, 0.65)
  const recentMiss = stats.lastErrorAt && now - stats.lastErrorAt < 43_200_000 ? 0.35 : 0
  const slowness = stats.avgLatencyMs
    ? clamp(stats.avgLatencyMs / hyperparams.targetLatencyMs - 1, 0, 1) * 0.2
    : 0
  const streakDiscount = stats.streak >= hyperparams.retireStreak ? -0.22 : 0

  return clamp(
    masteryGap * 0.45 + accuracyGap * 0.3 + freshness * 0.15 + recentMiss + slowness + streakDiscount,
    0,
    1.5,
  )
}

export function pickNextCardId(pool, statsMap, session, mode, hyperparams, rng = Math.random) {
  if (!pool.length) {
    return null
  }

  const now = Date.now()
  const blocked = new Set(session.recentHistory)
  let candidates = pool.filter((card) => !blocked.has(card.id))
  if (!candidates.length) {
    candidates = pool
  }

  // Очередь ошибок работает во всех режимах: карточка возвращается
  // через пару шагов после промаха, пока не будет отвечена чисто.
  if (session.mistakeQueue.length && session.sinceQueuePick >= 2) {
    const queuedCard = session.mistakeQueue
      .map((id) => candidates.find((card) => card.id === id))
      .find(Boolean)
    if (queuedCard && rng() < 0.5) {
      return queuedCard.id
    }
  }

  if (mode === 'problem') {
    const problemCards = candidates.filter(
      (card) => getCardProblemScore(statsMap[card.id], hyperparams, now) >= hyperparams.problemThreshold,
    )
    if (problemCards.length) {
      candidates = problemCards
    }
  }

  if (mode === 'even') {
    return chooseRandomCard(candidates, rng).id
  }

  return chooseWeightedCard(
    candidates.map((card) => {
      const base =
        mode === 'problem'
          ? getCardProblemScore(statsMap[card.id], hyperparams, now) + 0.2
          : getAdaptiveWeight(statsMap[card.id], hyperparams, now)
      return {
        card,
        weight: base * getConfusionMultiplier(card.id, statsMap, hyperparams, now),
      }
    }),
    rng,
  )?.id
}

function chooseRandomCard(cards, rng) {
  const index = Math.floor(rng() * cards.length)
  return cards[index]
}

function chooseWeightedCard(weightedCards, rng) {
  const total = weightedCards.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) {
    return weightedCards[0]?.card ?? null
  }

  let cursor = rng() * total
  for (const entry of weightedCards) {
    cursor -= entry.weight
    if (cursor <= 0) {
      return entry.card
    }
  }

  return weightedCards.at(-1)?.card ?? null
}

export function getDayKey(timestamp) {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function recordHistoryEvent(history, outcome, context) {
  const { now, latencyMs = 0 } = context
  const dayKey = getDayKey(now)
  const dayRecord = history.daily[dayKey] ?? {
    clears: 0,
    errors: 0,
    hints: 0,
    latencySum: 0,
    latencyCount: 0,
  }
  const nextDay = { ...dayRecord }

  if (outcome === 'correct') {
    nextDay.clears += 1
  } else if (outcome === 'wrong') {
    nextDay.errors += 1
  } else if (outcome === 'hint') {
    nextDay.hints += 1
  }

  if (outcome === 'correct' && latencyMs > 0) {
    nextDay.latencySum += latencyMs
    nextDay.latencyCount += 1
  }

  const daily = { ...history.daily, [dayKey]: nextDay }
  const dayKeys = Object.keys(daily).sort()
  if (dayKeys.length > DAILY_HISTORY_LIMIT) {
    for (const staleKey of dayKeys.slice(0, dayKeys.length - DAILY_HISTORY_LIMIT)) {
      delete daily[staleKey]
    }
  }

  let recent = history.recent
  if (outcome === 'correct' && latencyMs > 0) {
    recent = [...history.recent, { t: now, l: latencyMs }].slice(-RECENT_ANSWERS_LIMIT)
  }

  return { ...history, daily, recent }
}

export function recordConfusion(history, fromCardId, toCardId) {
  const key = `${fromCardId}>${toCardId}`
  return {
    ...history,
    confusions: {
      ...history.confusions,
      [key]: (history.confusions[key] ?? 0) + 1,
    },
  }
}

export function getTopConfusions(history, limit = 6) {
  return Object.entries(history.confusions)
    .map(([key, count]) => {
      const [fromId, toId] = key.split('>')
      return { fromId, toId, count }
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
}

export function getStatsStatus(stats, hyperparams) {
  const problemScore = getCardProblemScore(stats, hyperparams, Date.now())
  if (stats.exposures === 0) {
    return 'Не трогали'
  }
  if (stats.streak >= hyperparams.retireStreak && stats.mastery >= 0.8) {
    return 'Стабильно'
  }
  if (problemScore >= hyperparams.problemThreshold) {
    return 'Нужно добить'
  }
  return 'В процессе'
}

export function getGlobalStats(cards, statsMap, hyperparams) {
  const aggregate = cards.reduce(
    (summary, card) => {
      const stats = statsMap[card.id]
      summary.totalEvents += stats.clears + stats.errors + stats.hints
      summary.totalResolved += stats.clears
      summary.totalHints += stats.hints
      summary.cleanAnswers += stats.errors === 0 && stats.hints === 0 && stats.clears > 0 ? 1 : 0
      summary.mastery += stats.mastery
      summary.bestStreak = Math.max(summary.bestStreak, stats.bestStreak)
      summary.avgLatencyMs += stats.avgLatencyMs
      if (getCardProblemScore(stats, hyperparams, Date.now()) >= hyperparams.problemThreshold) {
        summary.problemCount += 1
      }
      if (stats.streak >= hyperparams.retireStreak && stats.mastery >= 0.8) {
        summary.retiredCount += 1
      }
      return summary
    },
    {
      totalEvents: 0,
      totalResolved: 0,
      totalHints: 0,
      cleanAnswers: 0,
      mastery: 0,
      bestStreak: 0,
      problemCount: 0,
      retiredCount: 0,
      avgLatencyMs: 0,
    },
  )

  const totalLatencyCards = cards.filter((card) => statsMap[card.id].avgLatencyMs > 0).length
  const clears = cards.reduce((sum, card) => sum + statsMap[card.id].clears, 0)

  return {
    ...aggregate,
    accuracy: aggregate.totalEvents ? Math.round((clears / aggregate.totalEvents) * 100) : 0,
    mastery: Math.round((aggregate.mastery / cards.length) * 100),
    avgLatencyMs: totalLatencyCards ? Math.round(aggregate.avgLatencyMs / totalLatencyCards) : 0,
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
