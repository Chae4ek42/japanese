import type { StatsRecord } from './types'

/** A conservative practice signal, never inferred from saved words or manual marks. */
export function getWordLearningEvidence(stats?: StatsRecord) {
  const practice = stats?.wordPractice
  const attempts = practice?.attempts ?? 0
  const practiced = attempts > 0
  // Repeated recent successes support recall; this does not certify long-term retention.
  const confirmed = practiced && attempts >= 3 && practice!.streak >= 3 && practice!.strength >= 0.7
  return {
    status: confirmed ? 'confirmed' as const : practiced ? 'learning' as const : 'unpracticed' as const,
    attempts,
    estimatedStrength: practiced ? practice!.strength : null,
    confirmed,
  }
}

export function summarizeWordLearning(ids: Iterable<string>, stats: Record<string, StatsRecord>) {
  const uniqueIds = [...new Set(ids)]
  let practiced = 0
  let confirmed = 0
  let attempts = 0
  let strengthSum = 0
  for (const id of uniqueIds) {
    const evidence = getWordLearningEvidence(stats[id])
    attempts += evidence.attempts
    if (evidence.estimatedStrength != null) {
      practiced += 1
      strengthSum += evidence.estimatedStrength
    }
    if (evidence.confirmed) confirmed += 1
  }
  return {
    total: uniqueIds.length,
    practiced,
    confirmed,
    attempts,
    estimatedStrength: practiced ? strengthSum / practiced : null,
  }
}
