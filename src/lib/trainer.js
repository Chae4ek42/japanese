export const DEFAULT_HYPERPARAMS = {
  masteryGain: 0.18,
  mistakePenalty: 0.24,
  hintPenalty: 0.16,
  retireStreak: 6,
  masteredWeight: 0.2,
  recentMistakeBoost: 2.4,
  problemThreshold: 0.45,
  queueSize: 4,
}

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

export function createInitialSession(overrides = {}) {
  return {
    poolIds: [],
    recentHistory: [],
    lastCardId: null,
    mistakeQueue: [],
    mode: 'adaptive',
    ...overrides,
  }
}

export function createNextRoundState(shownAt = Date.now()) {
  return {
    shownAt,
    mistakes: 0,
    hintUsed: false,
  }
}

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
    const drop = hyperparams.mistakePenalty * (0.45 + stats.mastery * 0.55)
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

    const clean = context.mistakesOnCard === 0 && !context.hintUsed
    const fluencyBonus = latencyMs <= 1700 ? 1.18 : latencyMs >= 4200 ? 0.8 : 1
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
  const unseenBoost = totalEvents === 0 ? 1.35 : 0
  const recencyBoost = stats.lastSeenAt === 0 ? 0.35 : clamp((now - stats.lastSeenAt) / 43_200_000, 0, 0.9)
  const recentMistakeBoost = recentFailureHours <= 12 || recentHintHours <= 12 ? hyperparams.recentMistakeBoost : 0
  const accuracyPenalty = totalEvents === 0 ? 0.3 : (100 - stats.eventAccuracy) / 100
  const streakReducer =
    stats.streak >= hyperparams.retireStreak
      ? hyperparams.masteredWeight
      : 1 - Math.min(stats.streak, hyperparams.retireStreak - 1) * 0.06

  return clamp(
    (0.15 + masteryGap ** 1.6 * 2.5 + accuracyPenalty * 1.4 + unseenBoost + recencyBoost + recentMistakeBoost) *
      streakReducer,
    0.05,
    9,
  )
}

export function getCardProblemScore(stats, hyperparams, now) {
  const totalEvents = stats.clears + stats.errors + stats.hints
  const masteryGap = 1 - stats.mastery
  const accuracyGap = totalEvents === 0 ? 0.55 : (100 - stats.eventAccuracy) / 100
  const freshness = stats.lastSeenAt === 0 ? 0.7 : clamp((now - stats.lastSeenAt) / 86_400_000, 0, 0.65)
  const recentMiss = stats.lastErrorAt && now - stats.lastErrorAt < 43_200_000 ? 0.35 : 0
  const streakDiscount = stats.streak >= hyperparams.retireStreak ? -0.22 : 0

  return clamp(masteryGap * 0.45 + accuracyGap * 0.3 + freshness * 0.15 + recentMiss + streakDiscount, 0, 1.5)
}

export function pickNextCardId(pool, statsMap, session, mode, hyperparams) {
  if (!pool.length) {
    return null
  }

  const now = Date.now()
  const blocked = new Set(session.recentHistory)
  let candidates = pool.filter((card) => !blocked.has(card.id))
  if (!candidates.length) {
    candidates = pool
  }

  if (mode === 'problem') {
    const problemCards = candidates.filter(
      (card) => getCardProblemScore(statsMap[card.id], hyperparams, now) >= hyperparams.problemThreshold,
    )
    if (problemCards.length) {
      candidates = problemCards
    }
  }

  if (mode === 'mistakes') {
    const queued = session.mistakeQueue
      .map((id) => candidates.find((card) => card.id === id))
      .filter(Boolean)
    if (queued.length) {
      return queued[0].id
    }
  }

  if (mode === 'even') {
    return chooseRandomCard(candidates).id
  }

  return chooseWeightedCard(
    candidates.map((card) => ({
      card,
      weight:
        mode === 'problem'
          ? getCardProblemScore(statsMap[card.id], hyperparams, now) + 0.2
          : getAdaptiveWeight(statsMap[card.id], hyperparams, now),
    })),
  )?.id
}

function chooseRandomCard(cards) {
  const index = Math.floor(Math.random() * cards.length)
  return cards[index]
}

function chooseWeightedCard(weightedCards) {
  const total = weightedCards.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) {
    return weightedCards[0]?.card ?? null
  }

  let cursor = Math.random() * total
  for (const entry of weightedCards) {
    cursor -= entry.weight
    if (cursor <= 0) {
      return entry.card
    }
  }

  return weightedCards.at(-1)?.card ?? null
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
