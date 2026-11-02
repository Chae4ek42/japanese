import type {
  MemoryCardState,
  PracticeSession,
  ReviewGrade,
  StatsOutcome,
  StatsRecord,
  VocabCard,
} from '../../shared/lib/types'
import { createStatsRecord, projectRecentAnswers } from '../../shared/lib/trainer'
import { afterSuccessfulCard, enqueueMistake } from '../../shared/lib/trainerCore'
import { gradeAndAdvanceReview, removeCardFromReviewSession } from './reviewSession'
import { dropAdaptiveWord, gradeAdaptiveWord, updateWordPractice, wordPracticeStats } from './adaptiveWindow'

/** Sidebar / planner stats after one round, without mutating mastery fields. */
export function applyOptimisticStat(
  existing: StatsRecord | undefined,
  outcome: StatsOutcome,
  now = Date.now(),
): StatsRecord {
  const base = existing ?? createStatsRecord()
  const recentAnswers = projectRecentAnswers(base.recentAnswers, outcome)
  const clears = base.clears + (outcome === 'correct' ? 1 : 0)
  const errors = base.errors + (outcome === 'wrong' ? 1 : 0)
  const hints = base.hints + (outcome === 'hint' ? 1 : 0)
  const total = clears + errors + hints
  return {
    ...base,
    clears,
    errors,
    hints,
    recentAnswers,
    eventAccuracy: total ? Math.round((clears / total) * 100) : 0,
    wordPractice: updateWordPractice(existing, outcome, now),
  }
}

export function problemWordIdsForCard(card: VocabCard): string[] {
  return card.variantIds?.length ? card.variantIds : [card.id]
}

export function nextSessionAfterVocabGrade(input: {
  session: PracticeSession
  cardId: string
  grade: ReviewGrade
  wrong: boolean
  hintUsed: boolean
  statsOutcome: StatsOutcome
  clean: boolean
  usesReviewV2: boolean
  pool: VocabCard[]
  memoryState?: MemoryCardState
  nextStats?: StatsRecord
}): PracticeSession {
  const { session, cardId, grade, wrong, hintUsed, statsOutcome, clean, usesReviewV2, pool } = input
  if (session.adaptive) {
    return { ...session, adaptive: gradeAdaptiveWord(session.adaptive, cardId, statsOutcome, wordPracticeStats(input.nextStats)) }
  }
  if (usesReviewV2 && session.review) {
    return gradeAndAdvanceReview({
      session,
      cardId,
      grade,
      pool,
      memoryState: input.memoryState,
    })
  }
  if (grade >= 3 || (!wrong && grade === 2 && !hintUsed)) {
    const poolSize = pool.length || session.poolIds.length || 1
    return afterSuccessfulCard(session, cardId, {
      kind: statsOutcome === 'correct' ? 'correct' : 'hint',
      poolSize,
      clean,
    })
  }
  if (wrong || grade === 1) {
    return enqueueMistake(session, cardId)
  }
  return session
}

export function dropCardFromPracticeSession(
  session: PracticeSession,
  cardId: string,
  opts: { usesReviewV2: boolean; fallbackPoolIds: string[] },
): PracticeSession {
  if (session.adaptive) {
    return { ...session, poolIds: session.poolIds.filter((id) => id !== cardId), adaptive: dropAdaptiveWord(session.adaptive, cardId) }
  }
  if (opts.usesReviewV2) return removeCardFromReviewSession(session, cardId)
  const poolIds = (session.poolIds.length ? session.poolIds : opts.fallbackPoolIds).filter(
    (id) => id !== cardId,
  )
  return {
    ...session,
    poolIds,
    mistakeQueue: session.mistakeQueue.filter((id) => id !== cardId),
    recentHistory: session.recentHistory.filter((id) => id !== cardId),
    lastCardId: session.lastCardId === cardId ? null : session.lastCardId,
  }
}
