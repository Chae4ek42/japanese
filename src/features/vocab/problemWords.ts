import type { StatsRecord } from '../../shared/lib/types'

export const MIN_PROBLEM_ANSWERS = 5
export const PROBLEM_SCORE_THRESHOLD = 0.30
const HALF_LIFE = 3

export interface ProblemWordScore {
  eligible: boolean
  score: number
  recentErrorRate: number
  recentCount: number
  recentErrors: number
}

/** A recent recall signal, not a lifetime error counter or a prediction of mastery. */
export function scoreProblemWord(stats: StatsRecord | undefined): ProblemWordScore | null {
  const answers = stats?.recentAnswers?.slice(-15) ?? []
  if (answers.length < MIN_PROBLEM_ANSWERS) return null
  let errors = 0
  let total = 0
  for (let index = 0; index < answers.length; index++) {
    const weight = 2 ** (-(answers.length - index - 1) / HALF_LIFE)
    total += weight
    if (answers[index] === 'wrong') errors += weight
  }
  // Beta(1, 3) prior shrinks short, noisy windows toward a 25% failure rate.
  const score = (errors + 1) / (total + 4)
  return {
    eligible: score >= PROBLEM_SCORE_THRESHOLD,
    score,
    recentErrorRate: errors / total,
    recentCount: answers.length,
    recentErrors: answers.filter((answer) => answer === 'wrong').length,
  }
}

export function rankProblemWords(
  ids: string[], stats: Record<string, StatsRecord>, options: { limit?: number } = {},
): Array<ProblemWordScore & { id: string }> {
  const ranked = [...new Set(ids)].flatMap((id) => {
    const score = scoreProblemWord(stats[id])
    return score?.eligible ? [{ id, ...score }] : []
  }).sort((a, b) => b.score - a.score || b.recentCount - a.recentCount || a.id.localeCompare(b.id))
  return options.limit && options.limit > 0 ? ranked.slice(0, Math.floor(options.limit)) : ranked
}

export function rankedProblemWordIds(
  ids: string[], stats: Record<string, StatsRecord>, options: { limit?: number } = {},
): string[] {
  return rankProblemWords(ids, stats, options).map((entry) => entry.id)
}
