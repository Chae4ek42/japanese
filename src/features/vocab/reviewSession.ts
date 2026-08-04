import type {
  LatencyModel,
  MemoryState,
  PracticeSession,
  ReviewGrade,
  StatsRecord,
  VocabCard,
  VocabPreferences,
} from '../../shared/lib/types'
import {
  applyGradeToSequencer,
  attractConfusedPair,
  buildSessionPlan,
  cardHintsFromVocab,
  clampReviewKnobs,
  createReviewSessionState,
  deriveGrade,
  drillModeToAspect,
  answerLengthForCard,
  mostSimilarIds,
  pickNextCard,
  sessionSeed,
  setReviewWeight,
  dropFromReview,
} from '../../shared/lib/review'
import { memoryKey, migrateFromMastery, urgency } from '../../shared/lib/review/memory'

export function resolveCardMemory(
  memory: Record<string, MemoryState>,
  stats: Record<string, StatsRecord>,
  cardId: string,
  aspect: 0 | 1,
  now: number,
): MemoryState {
  const key = memoryKey(cardId, aspect)
  if (memory[key]) return memory[key]!
  if (stats[cardId]) return migrateFromMastery(stats[cardId]!, now)
  return {
    s: 0,
    d: 0.3,
    lastAt: 0,
    lastPresentedAt: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    uncertain: false,
    modelVersion: 1,
    createdAt: now,
  }
}

export function startReviewPracticeSession(input: {
  scope: VocabCard[]
  preferences: VocabPreferences
  memory: Record<string, MemoryState>
  stats: Record<string, StatsRecord>
  newUsedToday: number
  weightMultipliers?: Record<string, number>
  avgLatencyMs?: number
  now?: number
}): { session: PracticeSession; planEmpty: boolean; dueCount: number; newCount: number } {
  const now = input.now ?? Date.now()
  const knobs = clampReviewKnobs({
    targetRetention: input.preferences.targetRetention,
    newPerDay: input.preferences.newPerDay ?? Math.max(0, input.preferences.newWordLimit),
    sessionMinutes: input.preferences.sessionMinutes,
  })
  const aspect = drillModeToAspect(input.preferences.drillMode)
  const even = input.preferences.pickMode === 'even'
  const plan = buildSessionPlan({
    scope: input.scope.map((card) => ({ id: card.id, hints: cardHintsFromVocab(card) })),
    memory: input.memory,
    stats: input.stats,
    aspect,
    knobs,
    now,
    newUsedToday: input.newUsedToday,
    weightMultipliers: input.weightMultipliers,
    avgLatencyMs: input.avgLatencyMs,
    even,
  })

  const review = createReviewSessionState(plan.planIds, {
    mode: even ? 'even' : 'adaptive',
    seed: sessionSeed(now),
    weightMultipliers: input.weightMultipliers ?? {},
  })
  review.targetAnswers = plan.targetAnswers

  const session: PracticeSession = {
    poolIds: plan.planIds.length ? plan.planIds : input.scope.map((card) => card.id),
    recentHistory: [],
    lastCardId: null,
    mistakeQueue: [],
    sinceQueuePick: 0,
    mode: even ? 'even' : 'adaptive',
    showCounts: {},
    cooldowns: {},
    review,
  }

  return {
    session,
    planEmpty: plan.empty && !session.poolIds.length,
    dueCount: plan.dueCount + plan.learningCount,
    newCount: plan.newCount,
  }
}

export function urgencyMapForPool(
  pool: VocabCard[],
  memory: Record<string, MemoryState>,
  stats: Record<string, StatsRecord>,
  preferences: VocabPreferences,
  now: number,
): Record<string, number> {
  const aspect = drillModeToAspect(preferences.drillMode)
  const target = preferences.targetRetention ?? 0.9
  const out: Record<string, number> = {}
  for (const card of pool) {
    const mem = resolveCardMemory(memory, stats, card.id, aspect, now)
    out[card.id] = urgency(mem, now, target, 1)
  }
  return out
}

export function pickReviewCard(
  session: PracticeSession,
  pool: VocabCard[],
  memory: Record<string, MemoryState>,
  stats: Record<string, StatsRecord>,
  preferences: VocabPreferences,
  now = Date.now(),
): { cardId: string | null; session: PracticeSession; done: boolean } {
  const review = session.review
  if (!review) return { cardId: null, session, done: true }

  const urgencyById = urgencyMapForPool(pool, memory, stats, preferences, now)
  const pick = pickNextCard(review, urgencyById)
  const nextSession = { ...session, review: pick.state, lastCardId: session.lastCardId }

  if (pick.kind === 'done') {
    return { cardId: null, session: { ...nextSession, review: { ...pick.state, done: true } }, done: true }
  }
  if (pick.kind === 'waiting') {
    return { cardId: null, session: nextSession, done: false }
  }
  return {
    cardId: pick.cardId,
    session: { ...nextSession, lastCardId: pick.cardId },
    done: false,
  }
}

export function gradeAndAdvanceReview(input: {
  session: PracticeSession
  cardId: string
  grade: ReviewGrade
  pool: VocabCard[]
}): PracticeSession {
  if (!input.session.review) return input.session
  let review = applyGradeToSequencer(input.session.review, input.cardId, input.grade)

  const card = input.pool.find((item) => item.id === input.cardId)
  if (card && input.grade === 1) {
    for (const otherId of mostSimilarIds(card, input.pool, 2)) {
      review = attractConfusedPair(review, input.cardId, otherId, 1)
    }
  }

  return {
    ...input.session,
    review,
    recentHistory: [...input.session.recentHistory, input.cardId].slice(-32),
    lastCardId: input.cardId,
  }
}

export function deriveRoundGrade(input: {
  wrong: boolean
  hintUsed: boolean
  dontKnow: boolean
  typoForgiven: boolean
  mistakesOnCard: number
  latencyMs: number
  answers: string[]
  drillMode: VocabPreferences['drillMode']
  latencyModel: LatencyModel
  hadRecentLapse?: boolean
}): ReviewGrade {
  return deriveGrade({
    wrong: input.wrong,
    hintUsed: input.hintUsed,
    dontKnow: input.dontKnow,
    typoForgiven: input.typoForgiven,
    mistakesOnCard: input.mistakesOnCard,
    latencyMs: input.latencyMs,
    answerLength: answerLengthForCard(input.answers, input.drillMode),
    mode: input.drillMode,
    latencyModel: input.latencyModel,
    hadRecentLapse: input.hadRecentLapse,
  })
}

export function patchReviewWeights(
  session: PracticeSession,
  cardId: string,
  multiplier: number,
): PracticeSession {
  if (!session.review) return session
  return {
    ...session,
    review: setReviewWeight(session.review, cardId, multiplier),
  }
}

export function removeCardFromReviewSession(session: PracticeSession, cardId: string): PracticeSession {
  const poolIds = session.poolIds.filter((id) => id !== cardId)
  const review = session.review ? dropFromReview(session.review, cardId) : undefined
  return {
    ...session,
    poolIds,
    mistakeQueue: session.mistakeQueue.filter((id) => id !== cardId),
    recentHistory: session.recentHistory.filter((id) => id !== cardId),
    lastCardId: session.lastCardId === cardId ? null : session.lastCardId,
    review,
  }
}

export { drillModeToAspect, answerLengthForCard, cardHintsFromVocab }
