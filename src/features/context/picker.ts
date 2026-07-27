import type { ContextSentence, KanjiWord } from '../../shared/lib/types'
import { getSentencesForWord, listAllContextSentences } from './data/bank'

export interface PickSentenceOptions {
  knownWordIds: Iterable<string>
  knownGrammarIds: Iterable<string>
  allowOneNewGrammar?: boolean
  preferThemes?: string[]
  /** Prefer shorter sentences. */
  maxChars?: number
  generatedCache?: Record<string, ContextSentence | ContextSentence[]>
  /** Max unknown content words inside one sentence (default 1). */
  maxNewPerSentence?: number
}

export interface PickSentenceResult {
  sentence: ContextSentence | null
  unknownWordIds: string[]
  unknownGrammarIds: string[]
  reason: 'ok' | 'none'
}

function setOf(values: Iterable<string>): Set<string> {
  return new Set(values)
}

export function unknownWordIdsInSentence(
  sentence: ContextSentence,
  knownWords: Set<string>,
): string[] {
  return sentence.wordIds.filter((id) => !knownWords.has(id))
}

export function scoreBatchSentence(
  sentence: ContextSentence,
  activeBatch: Set<string>,
  knownWords: Set<string>,
  knownGrammar: Set<string>,
  {
    allowOneNewGrammar = true,
    preferThemes = [],
    maxNewPerSentence = 1,
    requireWordId,
  }: PickSentenceOptions & { requireWordId?: string },
): number | null {
  if (activeBatch.size === 0) return null
  if (requireWordId && !sentence.wordIds.includes(requireWordId)) return null

  const unknowns = unknownWordIdsInSentence(sentence, knownWords)
  if (unknowns.length < 1 || unknowns.length > maxNewPerSentence) return null
  if (unknowns.some((id) => !activeBatch.has(id))) return null

  const unknownGrammar = sentence.grammarIds.filter((id) => !knownGrammar.has(id))
  if (unknownGrammar.length > (allowOneNewGrammar ? 1 : 0)) return null

  let score = 100
  score -= [...sentence.text].length
  score -= unknownGrammar.length * 8
  // Prefer sentences that introduce more of the active batch (up to max).
  score += unknowns.length * 10
  if (requireWordId && unknowns.includes(requireWordId)) score += 14
  if (preferThemes.length && sentence.themeHints?.length) {
    const overlap = sentence.themeHints.filter((theme) => preferThemes.includes(theme)).length
    score += overlap * 12
  }
  if (sentence.source === 'seed') score += 6
  return score
}

/** Back-compat: strict i+1 for a single target word. */
export function scoreSentence(
  sentence: ContextSentence,
  targetWordId: string,
  knownWords: Set<string>,
  knownGrammar: Set<string>,
  options: PickSentenceOptions,
): number | null {
  return scoreBatchSentence(sentence, new Set([targetWordId]), knownWords, knownGrammar, {
    ...options,
    maxNewPerSentence: options.maxNewPerSentence ?? 1,
    requireWordId: targetWordId,
  })
}

function candidatePool(
  activeBatchIds: string[],
  generatedCache?: Record<string, ContextSentence | ContextSentence[]>,
): ContextSentence[] {
  const seen = new Set<string>()
  const out: ContextSentence[] = []
  for (const wordId of activeBatchIds) {
    for (const sentence of getSentencesForWord(wordId)) {
      if (seen.has(sentence.id)) continue
      seen.add(sentence.id)
      out.push(sentence)
    }
    const cached = generatedCache?.[wordId]
    const list = Array.isArray(cached) ? cached : cached ? [cached] : []
    for (const sentence of list) {
      if (seen.has(sentence.id)) continue
      seen.add(sentence.id)
      out.push(sentence)
    }
  }
  return out
}

export function pickSentenceForBatch(
  activeBatchIds: string[],
  options: PickSentenceOptions,
  {
    requireWordId,
    excludeSentenceIds = [],
  }: { requireWordId?: string; excludeSentenceIds?: string[] } = {},
): PickSentenceResult {
  const knownWords = setOf(options.knownWordIds)
  const knownGrammar = setOf(options.knownGrammarIds)
  const activeBatch = setOf(activeBatchIds)
  const excluded = new Set(excludeSentenceIds)
  const maxNew = options.maxNewPerSentence ?? 1

  let best: ContextSentence | null = null
  let bestScore = -Infinity
  let bestUnknowns: string[] = []
  let bestUnknownGrammar: string[] = []

  for (const sentence of candidatePool(activeBatchIds, options.generatedCache)) {
    if (excluded.has(sentence.id)) continue
    const score = scoreBatchSentence(sentence, activeBatch, knownWords, knownGrammar, {
      ...options,
      maxNewPerSentence: maxNew,
      requireWordId,
    })
    if (score == null) continue
    if (score > bestScore) {
      best = sentence
      bestScore = score
      bestUnknowns = unknownWordIdsInSentence(sentence, knownWords)
      bestUnknownGrammar = sentence.grammarIds.filter((id) => !knownGrammar.has(id))
    }
  }

  if (!best) {
    return { sentence: null, unknownWordIds: [], unknownGrammarIds: [], reason: 'none' }
  }
  return {
    sentence: best,
    unknownWordIds: bestUnknowns,
    unknownGrammarIds: bestUnknownGrammar,
    reason: 'ok',
  }
}

export function pickIPlusOneSentence(
  targetWordId: string,
  options: PickSentenceOptions,
): PickSentenceResult {
  return pickSentenceForBatch([targetWordId], { ...options, maxNewPerSentence: options.maxNewPerSentence ?? 1 }, {
    requireWordId: targetWordId,
  })
}

/** Whether a word can appear in at least one valid sentence given the current batch. */
export function wordHasUsableSentence(
  wordId: string,
  activeBatchIds: string[],
  options: PickSentenceOptions,
): boolean {
  const batch = activeBatchIds.includes(wordId) ? activeBatchIds : [...activeBatchIds, wordId]
  return pickSentenceForBatch(batch, options, { requireWordId: wordId }).reason === 'ok'
}

/**
 * Build an active learning batch of up to `batchSize` unknown words.
 * Prefers words with a usable alone/i+N sentence, then fills remaining slots.
 */
export function pickActiveBatch(
  groupWords: KanjiWord[],
  options: PickSentenceOptions & { batchSize: number },
): KanjiWord[] {
  const knownWords = setOf(options.knownWordIds)
  const unknown = groupWords.filter((word) => word.id && !knownWords.has(word.id))
  if (!unknown.length) return []

  const batchSize = Math.max(1, Math.min(5, options.batchSize))
  const ranked = [...unknown].sort((a, b) => {
    const aOk = pickIPlusOneSentence(a.id!, options).sentence ? 0 : 1
    const bOk = pickIPlusOneSentence(b.id!, options).sentence ? 0 : 1
    return aOk - bOk
  })

  const batch: KanjiWord[] = []
  for (const word of ranked) {
    if (batch.length >= batchSize) break
    if (batch.length === 0) {
      batch.push(word)
      continue
    }
    const trialIds = [...batch.map((item) => item.id!), word.id!]
    const withBatch = pickSentenceForBatch(trialIds, options, { requireWordId: word.id }).reason === 'ok'
    const alone = Boolean(pickIPlusOneSentence(word.id!, options).sentence)
    if (withBatch || alone) batch.push(word)
  }

  for (const word of ranked) {
    if (batch.length >= batchSize) break
    if (batch.some((item) => item.id === word.id)) continue
    batch.push(word)
  }
  return batch
}

/** Next unknown word from a group, preferring words that already have an i+1 sentence. */
export function pickNextTargetWord(
  groupWords: KanjiWord[],
  options: PickSentenceOptions,
): KanjiWord | null {
  const batch = pickActiveBatch(groupWords, { ...options, batchSize: 1 })
  return batch[0] ?? null
}

export function groupCoverage(
  groupWords: KanjiWord[],
  knownWordIds: Iterable<string>,
): {
  known: number
  total: number
  ratio: number
} {
  const known = setOf(knownWordIds)
  const total = groupWords.filter((word) => word.id).length
  const knownCount = groupWords.filter((word) => word.id && known.has(word.id)).length
  return {
    known: knownCount,
    total,
    ratio: total ? knownCount / total : 0,
  }
}

/** Sentences in the corpus that touch any of the given word ids (debug / coverage). */
export function countCorpusHits(wordIds: string[]): number {
  if (!wordIds.length) return 0
  const set = new Set(wordIds)
  return listAllContextSentences().filter((sentence) => sentence.wordIds.some((id) => set.has(id))).length
}
