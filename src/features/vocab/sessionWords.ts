import type { StatsRecord, VocabCard } from '../../shared/lib/types'
import { countsFromRecentAnswers, createStatsRecord } from '../../shared/lib/trainer'

export type SessionWordSort = 'accuracy-asc' | 'accuracy-desc' | 'novelty'

/** Accuracy for session sidebar: last 15 correct/wrong (hints excluded). */
export function wordDisplayAccuracy(stats: StatsRecord): {
  percent: number | null
  clears: number
  errors: number
} {
  const recent = stats.recentAnswers
  if (recent?.length) {
    const { clears, errors } = countsFromRecentAnswers(recent)
    const total = clears + errors
    return {
      percent: total ? Math.round((clears / total) * 100) : null,
      clears,
      errors,
    }
  }
  const clears = stats.clears
  const errors = stats.errors
  const total = clears + errors
  return {
    percent: total ? Math.round((clears / total) * 100) : null,
    clears,
    errors,
  }
}

export function sortSessionCards(
  cards: VocabCard[],
  stats: Record<string, StatsRecord>,
  sort: SessionWordSort,
  poolAddedAt: Record<string, number> = {},
): VocabCard[] {
  const ranked = cards.map((card, index) => {
    const cardStats = stats[card.id] ?? createStatsRecord()
    const { percent } = wordDisplayAccuracy(cardStats)
    const accuracy = percent ?? -1
    // Newest additions to the training session first.
    const novelty = poolAddedAt[card.id] ?? 0
    return { card, index, accuracy, novelty }
  })

  ranked.sort((a, b) => {
    if (sort === 'accuracy-asc') {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
    } else if (sort === 'accuracy-desc') {
      if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy
    } else if (a.novelty !== b.novelty) {
      return b.novelty - a.novelty
    }
    return sort === 'novelty' ? b.index - a.index : a.index - b.index
  })

  return ranked.map((entry) => entry.card)
}

