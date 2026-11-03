import { createAdaptiveWindow, gradeAdaptiveWord, pickAdaptiveWord, wordPracticeStats } from '../src/features/vocab/adaptiveWindow.ts'
import { applyOptimisticStat } from '../src/features/vocab/vocabGrade.ts'
import type { StatsOutcome, StatsRecord } from '../src/shared/lib/types.ts'

// Reproducible stress scenarios with seeded card selection and mixed answer patterns.
const now = Date.parse('2026-11-02T12:00:00Z')
for (const size of [100, 1000]) {
  const pool = Array.from({ length: size }, (_, i) => `w${i}`)
  for (const windowSize of size === 100 ? [3, 5, 12, 20] : [5]) {
    for (const seed of size === 100 ? [42, 91, 7331] : [42]) {
      for (const scenario of ['correct', 'wrong', 'mixed']) {
        let state = createAdaptiveWindow(pool, {}, now, { windowSize, seed })
        const stats: Record<string, StatsRecord> = {}
        const seen = new Set<string>()
        let coveredAt = 0
        let maxActive = 0
        let immediateRepeats = 0
        let last: string | null = null
        const cap = size * 12 + 1000
        for (let turn = 0; turn < cap; turn++) {
          const picked = pickAdaptiveWord(state, pool)
          if (!picked.cardId) throw new Error('Unexpected empty pick')
          const id = picked.cardId
          state = picked.state
          if (id === last) immediateRepeats++
          last = id
          maxActive = Math.max(maxActive, state.active.length)
          seen.add(id)
          if (seen.size === size && !coveredAt) coveredAt = turn + 1
          const attempt = (stats[id]?.wordPractice?.attempts ?? 0) + 1
          const outcome: StatsOutcome = scenario === 'mixed'
            ? Number(id.slice(1)) % 7 === 0 || attempt % 6 === 0 ? 'wrong' : 'correct'
            : scenario === 'wrong' ? 'wrong' : 'correct'
          stats[id] = applyOptimisticStat(stats[id], outcome, now + turn * 4000)
          state = gradeAdaptiveWord(state, id, outcome, wordPracticeStats(stats[id]))
          if (coveredAt && turn >= coveredAt + 200) break
        }
        if (!coveredAt || immediateRepeats || maxActive > windowSize) throw new Error('Scheduler invariant failed')
        console.log(JSON.stringify({ size, windowSize, seed, scenario, coveredAt, maxActive, immediateRepeats }))
      }
    }
  }
}
