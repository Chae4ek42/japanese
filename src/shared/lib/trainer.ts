import { getConfusableIds } from '../../data/kana'
import type {
  ConfusionEntry,
  GlobalStatsSummary,
  Hyperparams,
  InputMode,
  KanaCard,
  KanaPickMode,
  NumbersPickMode,
  PracticeHistory,
  PracticeSession,
  RoundState,
  StatsOutcome,
  StatsRecord,
  TrainerOutcome,
  UpdateStatsContext,
} from './types'

export const DEFAULT_HYPERPARAMS: Hyperparams = {
  masteryGain: 0.18,
  mistakePenalty: 0.24,
  hintPenalty: 0.16,
  retireStreak: 4,
  masteredWeight: 0.04,
  recentMistakeBoost: 2.4,
  recentMistakeHours: 8,
  problemThreshold: 0.45,
  queueSize: 5,
  targetLatencyMs: 2500,
  confusionBoost: 1.55,
  unseenBoost: 4.2,
  seenOnlyBoostRatio: 0.85,
  staleBoost: 2.2,
  staleAfterHours: 3,
  staleRampHours: 12,
  knownMasteryThreshold: 0.65,
  sessionFreshBoost: 2.2,
  weightTemperature: 0.55,
  mistakeQueueGap: 2,
  mistakeQueueChance: 0.62,
}

/** Keep enough history for anti-repeat across larger pools. */
export const RECENT_HISTORY_LIMIT = 32

const CONFUSION_RECENCY_MS = 30 * 60_000
const RECENT_ANSWERS_LIMIT = 60
const DAILY_HISTORY_LIMIT = 60

export function createStatsRecord(): StatsRecord {
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

export function createEmptyHistory(): PracticeHistory {
  return {
    daily: {},
    confusions: {},
    recent: [],
  }
}

export function createInitialSession(
  overrides: Partial<PracticeSession> = {},
): PracticeSession {
  return {
    poolIds: [],
    recentHistory: [],
    lastCardId: null,
    mistakeQueue: [],
    sinceQueuePick: 0,
    mode: 'adaptive',
    showCounts: {},
    cooldowns: {},
    ...overrides,
  }
}

/** Record that a card was answered / left — feeds anti-repeat in pickNextCardId. */
export function pushRecentCard(session: PracticeSession, cardId: string): PracticeSession {
  return {
    ...session,
    recentHistory: [...session.recentHistory, cardId].slice(-RECENT_HISTORY_LIMIT),
    lastCardId: cardId,
  }
}

/** Block a card for the next `turns` picks (after a clean success). */
export function setCardCooldown(
  session: PracticeSession,
  cardId: string,
  turns: number,
): PracticeSession {
  if (turns <= 0) return session
  const cooldowns = { ...(session.cooldowns ?? {}) }
  cooldowns[cardId] = Math.max(cooldowns[cardId] ?? 0, Math.floor(turns))
  return { ...session, cooldowns }
}

/** Suggested cooldown length after a successful answer. */
export function successCooldownTurns(poolSize: number, clean: boolean): number {
  if (poolSize <= 2) return 0
  if (clean) {
    return Math.min(poolSize - 1, Math.max(3, Math.floor(poolSize * 0.55)))
  }
  return Math.min(poolSize - 1, Math.max(2, Math.floor(poolSize * 0.3)))
}

/**
 * Tick cooldowns and bump show count when a card appears.
 * Call this instead of bare bumpSessionShow when cooldowns are in use.
 */
export function bumpSessionShow(session: PracticeSession, cardId: string): PracticeSession {
  const showCounts = { ...(session.showCounts ?? {}) }
  showCounts[cardId] = (showCounts[cardId] ?? 0) + 1

  const prevCooldowns = session.cooldowns ?? {}
  const cooldowns: Record<string, number> = {}
  for (const [id, remaining] of Object.entries(prevCooldowns)) {
    if (id === cardId) continue
    const next = remaining - 1
    if (next > 0) cooldowns[id] = next
  }

  return {
    ...session,
    showCounts,
    cooldowns,
  }
}

export function createNextRoundState(shownAt = Date.now()): RoundState {
  return {
    shownAt,
    mistakes: 0,
    hintUsed: false,
    confusionLogged: false,
  }
}

export function evaluateInput(answers: string[], input: string): TrainerOutcome {
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

export function evaluateSubmission(answers: string[], input: string): Exclude<TrainerOutcome, 'pending'> {
  if (!input) {
    return 'empty'
  }

  return answers.includes(input) ? 'correct' : 'wrong'
}

export function updateCardStats(
  existingStats: StatsRecord,
  outcome: StatsOutcome,
  context: UpdateStatsContext,
  hyperparams: Hyperparams,
): StatsRecord {
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

function withDerivedFields(stats: StatsRecord): StatsRecord {
  const totalEvents = stats.clears + stats.errors + stats.hints
  stats.eventAccuracy = totalEvents ? Math.round((stats.clears / totalEvents) * 100) : 0
  return stats
}

export function getAdaptiveWeight(stats: StatsRecord, hyperparams: Hyperparams, now: number): number {
  const masteryGap = 1 - stats.mastery
  const totalEvents = stats.clears + stats.errors + stats.hints
  const recentFailureHours = stats.lastErrorAt ? (now - stats.lastErrorAt) / 3_600_000 : Number.POSITIVE_INFINITY
  const recentHintHours = stats.lastHintAt ? (now - stats.lastHintAt) / 3_600_000 : Number.POSITIVE_INFINITY
  const hadRecentMiss =
    recentFailureHours <= hyperparams.recentMistakeHours ||
    recentHintHours <= hyperparams.recentMistakeHours

  const errorRate = totalEvents === 0 ? 0.35 : stats.errors / totalEvents
  const accuracyGap = totalEvents === 0 ? 0.4 : (100 - stats.eventAccuracy) / 100
  const slownessBoost = stats.avgLatencyMs
    ? clamp(stats.avgLatencyMs / hyperparams.targetLatencyMs - 1, 0, 1.8) * 0.7
    : 0

  // Prefer cards never answered (even if briefly shown) over “seen-only”.
  let noveltyBoost = 0
  if (totalEvents === 0 && stats.exposures === 0) {
    noveltyBoost = hyperparams.unseenBoost
  } else if (totalEvents === 0) {
    noveltyBoost = hyperparams.unseenBoost * hyperparams.seenOnlyBoostRatio
  } else if (stats.clears <= 1 && stats.errors + stats.hints >= 1) {
    noveltyBoost = 1.1
  } else if (stats.lastSeenAt > 0) {
    const hoursUnseen = (now - stats.lastSeenAt) / 3_600_000
    if (hoursUnseen >= hyperparams.staleAfterHours) {
      noveltyBoost = clamp(hoursUnseen / hyperparams.staleRampHours, 0, hyperparams.staleBoost)
    }
  }

  let knownPenalty = 1
  const knownThreshold = hyperparams.knownMasteryThreshold ?? 0.65
  if (stats.streak >= hyperparams.retireStreak && stats.mastery >= knownThreshold) {
    knownPenalty = hyperparams.masteredWeight
  } else if (stats.mastery >= knownThreshold && stats.eventAccuracy >= 80 && stats.clears >= 2) {
    const over = clamp((stats.mastery - knownThreshold) / Math.max(1e-6, 1 - knownThreshold), 0, 1)
    knownPenalty = 0.06 + (1 - over) * 0.14
  } else if (stats.mastery >= 0.5 && stats.eventAccuracy >= 85 && stats.clears >= 3 && stats.streak >= 2) {
    knownPenalty = 0.28
  }

  const streakReducer =
    stats.streak >= hyperparams.retireStreak
      ? hyperparams.masteredWeight
      : 1 - Math.min(stats.streak, hyperparams.retireStreak - 1) * 0.16

  const recentMissBoost = hadRecentMiss ? hyperparams.recentMistakeBoost : 0

  // Polarized: weak/new cards dominate; comfortable cards nearly drop out.
  const raw =
    (0.08 +
      masteryGap ** 2.4 * 4.2 +
      errorRate * 2.4 +
      accuracyGap * 1.35 +
      noveltyBoost +
      recentMissBoost +
      slownessBoost) *
    streakReducer *
    knownPenalty

  return clamp(raw, 0.01, 14)
}

export function getSessionShowCount(session: PracticeSession, cardId: string): number {
  return session.showCounts?.[cardId] ?? 0
}

function recentAvoidCount(poolSize: number): number {
  if (poolSize <= 2) return 0
  if (poolSize <= 4) return 1
  if (poolSize <= 8) return Math.min(3, poolSize - 1)
  return Math.min(Math.max(5, Math.floor(poolSize * 0.4)), 20, poolSize - 1)
}

function isOnCooldown(session: PracticeSession, cardId: string): boolean {
  return (session.cooldowns?.[cardId] ?? 0) > 0
}

export function getConfusionMultiplier(
  cardId: string,
  statsMap: Record<string, StatsRecord>,
  hyperparams: Hyperparams,
  now: number,
): number {
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

export function getCardProblemScore(stats: StatsRecord, hyperparams: Hyperparams, now: number): number {
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

type PickableCard = Pick<KanaCard, 'id'> | { id: string }

export function pickNextCardId(
  pool: PickableCard[],
  statsMap: Record<string, StatsRecord>,
  session: PracticeSession,
  mode: KanaPickMode | NumbersPickMode,
  hyperparams: Hyperparams,
  rng: () => number = Math.random,
  options?: { weightMultipliers?: Record<string, number> },
): string | null {
  if (!pool.length) {
    return null
  }

  const now = Date.now()
  const avoidN = recentAvoidCount(pool.length)
  const blocked = new Set(session.recentHistory.slice(-avoidN))
  let candidates = pool.filter((card) => !blocked.has(card.id))
  if (!candidates.length) {
    candidates = pool
  }

  // Success cooldown: keep comfortable cards out unless nothing else is left.
  const cooled = candidates.filter((card) => !isOnCooldown(session, card.id))
  if (cooled.length) {
    candidates = cooled
  }

  const queueGap = hyperparams.mistakeQueueGap ?? 2
  const queueChance = hyperparams.mistakeQueueChance ?? 0.62
  if (session.mistakeQueue.length && session.sinceQueuePick >= queueGap) {
    const queuedCard = session.mistakeQueue
      .map((id) => candidates.find((card) => card.id === id) ?? pool.find((card) => card.id === id))
      .find((card) => card && !blocked.has(card.id) && !isOnCooldown(session, card.id))
    if (queuedCard && rng() < queueChance) {
      return queuedCard.id
    }
  }

  // Strict coverage: finish first pass of the pool before repeating (unless reviewing a mistake above).
  const neverShown = candidates.filter((card) => getSessionShowCount(session, card.id) === 0)
  if (neverShown.length) {
    candidates = neverShown
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

  const freshBoost = hyperparams.sessionFreshBoost ?? 2.2
  const temperature = clamp(hyperparams.weightTemperature ?? 0.55, 0.25, 1.5)

  return (
    chooseWeightedCard(
      candidates.map((card) => {
        const stats = statsMap[card.id] ?? createStatsRecord()
        const base =
          mode === 'problem'
            ? getCardProblemScore(stats, hyperparams, now) + 0.2
            : getAdaptiveWeight(stats, hyperparams, now)
        const shows = getSessionShowCount(session, card.id)
        // After the first pass, heavily penalize cards already drilled this session.
        const sessionFactor =
          shows === 0 ? freshBoost : 1 / (1 + shows * 1.65) ** 1.25
        const multiplier = options?.weightMultipliers?.[card.id] ?? 1
        const linear = base * getConfusionMultiplier(card.id, statsMap, hyperparams, now) * sessionFactor * Math.max(0, multiplier)
        // Temperature < 1 sharpens the distribution toward the weakest cards.
        const weight = linear <= 0 || temperature >= 0.999 ? linear : linear ** (1 / temperature)
        return { card, weight }
      }),
      rng,
    )?.id ?? null
  )
}

function chooseRandomCard<T extends PickableCard>(cards: T[], rng: () => number): T {
  const index = Math.floor(rng() * cards.length)
  return cards[index]
}

function chooseWeightedCard<T extends PickableCard>(
  weightedCards: Array<{ card: T; weight: number }>,
  rng: () => number,
): T | null {
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

export function getDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function recordHistoryEvent(
  history: PracticeHistory,
  outcome: StatsOutcome,
  context: UpdateStatsContext,
): PracticeHistory {
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

export function recordConfusion(history: PracticeHistory, fromCardId: string, toCardId: string): PracticeHistory {
  const key = `${fromCardId}>${toCardId}`
  return {
    ...history,
    confusions: {
      ...history.confusions,
      [key]: (history.confusions[key] ?? 0) + 1,
    },
  }
}

export function getTopConfusions(history: PracticeHistory, limit = 6): ConfusionEntry[] {
  return Object.entries(history.confusions)
    .map(([key, count]) => {
      const [fromId, toId] = key.split('>')
      return { fromId, toId, count }
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
}

export function getStatsStatus(stats: StatsRecord, hyperparams: Hyperparams): string {
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

export function getGlobalStats(
  cards: PickableCard[],
  statsMap: Record<string, StatsRecord>,
  hyperparams: Hyperparams,
): GlobalStatsSummary {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export type { InputMode, StatsOutcome, UpdateStatsContext }
