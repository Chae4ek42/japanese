import { getWordById } from '../../data/words/bank'
import type { AppState, StatsRecord } from '../../shared/lib/types'
import { rankProblemWords, type ProblemWordScore } from '../vocab/problemWords'

export interface MistakeEntry extends ProblemWordScore {
  id: string
  title: string
  kana: string
  meaning: string
  stats: StatsRecord
  lastDifficultyAt: number
}

/** Only words with enough recent recall evidence; older lifetime errors do not qualify. */
export function collectMistakes(state: AppState): MistakeEntry[] {
  const hidden = new Set(state.vocab.hiddenWordIds)
  return rankProblemWords(Object.keys(state.vocab.stats), state.vocab.stats).flatMap((entry) => {
    const word = state.vocab.customWords[entry.id] ?? getWordById(entry.id)
    if (!word || hidden.has(entry.id)) return []
    const stats = state.vocab.stats[entry.id]!
    return [{ ...entry, title: word.writing, kana: word.kana, meaning: word.meanings.join('; '), stats,
      lastDifficultyAt: Math.max(stats.lastErrorAt || 0, stats.lastHintAt || 0) }]
  })
}
