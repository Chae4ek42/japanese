import type {
  MemoryState,
  PracticeSession,
  StatsRecord,
  VocabCard,
  VocabPickMode,
  VocabPreferences,
} from '../../shared/lib/types'
import { DEFAULT_HYPERPARAMS, createStatsRecord, pickNextCardId } from '../../shared/lib/trainer'
import { pickEvenVocabCardId } from './pool'
import { pickReviewCard } from './reviewSession'

export function zeroWeightExcludeIds(
  weights: Record<string, number>,
  extraIds: string[] = [],
): string[] {
  const ids = new Set(extraIds)
  for (const [id, weight] of Object.entries(weights)) {
    if (weight <= 0) ids.add(id)
  }
  return [...ids]
}

export function pickNextVocabCardId(
  pool: VocabCard[],
  currentCardId: string | null,
  session: PracticeSession,
  ctx: {
    weights: Record<string, number>
    pickMode: VocabPickMode
    preferences: VocabPreferences
    usesReviewV2: boolean
    memory: Record<string, MemoryState>
    stats: Record<string, StatsRecord>
    applySession: (session: PracticeSession) => void
  },
): string | null {
  const { weights, pickMode, preferences, usesReviewV2, memory, stats, applySession } = ctx
  const activePool = pool.filter((card) => (weights[card.id] ?? 1) > 0)
  const pickPool = activePool.length ? activePool : pool
  const excludeIds = zeroWeightExcludeIds(weights, currentCardId ? [currentCardId] : [])

  if (pickMode === 'even') {
    return pickEvenVocabCardId(pickPool, {
      excludeIds,
      weightMultipliers: weights,
      showCounts: session.showCounts ?? {},
      boostShows: preferences.evenBoostShows,
      boostFactor: preferences.evenBoostFactor,
      decayPower: preferences.evenDecayPower,
    })
  }

  if (usesReviewV2 && session.review) {
    const picked = pickReviewCard(session, pickPool, memory, stats, preferences)
    applySession(picked.session)
    if (picked.done) return null
    return picked.cardId
  }

  const statsMap = { ...stats }
  for (const card of pickPool) {
    statsMap[card.id] = statsMap[card.id] ?? createStatsRecord()
  }

  return pickNextCardId(
    pickPool,
    statsMap,
    session,
    pickMode,
    DEFAULT_HYPERPARAMS,
    Math.random,
    { weightMultipliers: weights },
  )
}
