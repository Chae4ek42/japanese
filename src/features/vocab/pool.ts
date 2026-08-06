import type {
  KanjiWord,
  TrainerOutcome,
  VocabCard,
  VocabLevelFilter,
  VocabPreferences,
} from '../../shared/lib/types'
import { normalizeQuizGlossKey, pickQuizMeaning } from '../../shared/lib/jmdict-gloss'
import { vocabSimilarity } from '../../shared/lib/review/similarity'
import {
  getJlptWords,
  getPopularWordsForKanji,
  getPracticeWords,
  getWordById,
  POPULAR_WORDS_PER_KANJI,
} from '../../data/words/bank'
import { applyLocalWordEdits, compareVocabStudyOrder, resolveMyWords } from './customWords'
import { getWordsForGroup } from './groups'
import { mergeWordsByWriting, wordReadings, wordVariantIds } from './mergeHomographs'

export function isVocabWordLearned(
  word: KanjiWord | { id?: string; variantIds?: string[]; readings?: { id?: string }[] },
  learnedIds: Set<string> | Iterable<string>,
): boolean {
  const learned = learnedIds instanceof Set ? learnedIds : new Set(learnedIds)
  return wordVariantIds(word as KanjiWord).some((id) => learned.has(id))
}

export function normalizeRomajiAnswer(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s_\-’'"'"']/g, '')
    .trim()
}

/** Soft normalize for the input field — keeps `/`, `,` and spaces as reading delimiters. */
export function normalizeRomajiDraft(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_\-’'"'"']/g, '')
}

/**
 * Romaji drill: any one required reading is enough.
 * Extra tokens (via `/` or spaces) are allowed if they are also valid readings.
 */
export function evaluateRomajiReadings(
  required: string[],
  input: string,
  mode: 'instant' | 'submit' = 'instant',
): TrainerOutcome {
  const requiredUnique = [...new Set(required.map((item) => normalizeRomajiAnswer(item)).filter(Boolean))]
  if (!requiredUnique.length) return 'empty'

  const trimmed = String(input ?? '').trim()
  if (!trimmed) return 'empty'

  let rawParts = trimmed
    .split(/\s*[\/／,，]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (rawParts.length === 1 && requiredUnique.length > 1) {
    const bySpace = trimmed.split(/\s+/).filter(Boolean)
    if (bySpace.length > 1) rawParts = bySpace
  }

  const complete: string[] = []
  let pendingPrefix = false

  for (let i = 0; i < rawParts.length; i += 1) {
    const part = normalizeRomajiAnswer(rawParts[i]!)
    if (!part) continue
    const isLast = i === rawParts.length - 1
    if (requiredUnique.includes(part)) {
      complete.push(part)
      continue
    }
    if (
      mode === 'instant' &&
      isLast &&
      requiredUnique.some((answer) => answer.startsWith(part) && !complete.includes(answer))
    ) {
      pendingPrefix = true
      continue
    }
    return 'wrong'
  }

  const uniqueComplete = new Set(complete)
  if ([...uniqueComplete].some((part) => !requiredUnique.includes(part))) return 'wrong'

  // One complete reading is enough; more valid readings are fine.
  if (uniqueComplete.size >= 1 && !pendingPrefix) return 'correct'

  if (
    mode === 'instant' &&
    pendingPrefix &&
    [...uniqueComplete].every((part) => requiredUnique.includes(part))
  ) {
    return 'pending'
  }

  return 'wrong'
}

export function wordToVocabCard(word: KanjiWord): VocabCard | null {
  if (!word.id) return null
  const readings = wordReadings(word)
  const answers = [
    ...new Set(readings.map((reading) => normalizeRomajiAnswer(reading.romaji)).filter(Boolean)),
  ]
  if (!answers.length) return null
  const meanings = [
    ...new Set(readings.flatMap((reading) => reading.meanings).map((item) => item.trim()).filter(Boolean)),
  ]
  const meaning = pickQuizMeaning(meanings.length ? meanings : word.meanings)
  if (!meaning) return null
  const variantIds = wordVariantIds(word)
  return {
    id: word.id,
    writing: word.writing,
    kana: readings.map((reading) => reading.kana).filter(Boolean).join(' / ') || word.kana,
    romaji: readings.map((reading) => reading.romaji).filter(Boolean).join(' / ') || word.romaji,
    answers,
    meaning,
    meanings,
    jlpt: word.jlpt,
    readings,
    variantIds: variantIds.length ? variantIds : [word.id],
  }
}

/** Limit the pool to at most `limit` cards. `limit < 0` => no change. */
export function limitVocabCards(cards: VocabCard[], limit: number): VocabCard[] {
  if (limit < 0) return cards
  return cards.slice(0, limit)
}

/** Apply «Слов за раз» when the source supports it (mine/problem/full-set skip). */
export function applyVocabNewWordLimit(
  cards: VocabCard[],
  preferences: Pick<VocabPreferences, 'source' | 'newWordLimit' | 'trainFullGroup'>,
): VocabCard[] {
  const newWordLimit = preferences.newWordLimit ?? -1
  const skipLimit =
    preferences.source === 'mine' ||
    preferences.source === 'problem' ||
    ((preferences.source === 'group' ||
      preferences.source === 'kanji' ||
      preferences.source === 'list') &&
      preferences.trainFullGroup)
  if (skipLimit || newWordLimit < 0) return cards
  return limitVocabCards(cards, newWordLimit)
}

function filterWordsByJlpt(words: KanjiWord[], levels: number[]): KanjiWord[] {
  if (!levels.length) return words
  const allow = new Set(levels)
  const filtered: KanjiWord[] = []
  for (const word of words) {
    const readings = wordReadings(word).filter(
      (reading) => typeof reading.jlpt === 'number' && allow.has(reading.jlpt),
    )
    if (!readings.length) continue
    const meanings = [...new Set(readings.flatMap((reading) => reading.meanings))]
    const variantIds = [
      ...new Set(readings.map((reading) => reading.id).filter((id): id is string => Boolean(id))),
    ]
    const first = readings[0]!
    filtered.push({
      ...word,
      id: word.id ?? first.id,
      kana: readings.map((reading) => reading.kana).filter(Boolean).join(' / ') || word.kana,
      romaji: readings.map((reading) => reading.romaji).filter(Boolean).join(' / ') || word.romaji,
      meanings: meanings.length ? meanings : word.meanings,
      readings,
      variantIds: variantIds.length ? variantIds : wordVariantIds(word),
      jlpt: readings.reduce((best, reading) => Math.max(best, reading.jlpt ?? 0), 0) || undefined,
    })
  }
  return filtered
}

export function resolveTrainingListWords(
  trainingWordIds: string[],
  customWords: Record<string, KanjiWord>,
  hiddenWordIds: string[],
): KanjiWord[] {
  const hidden = new Set(hiddenWordIds)
  const raw: KanjiWord[] = []
  for (const id of trainingWordIds) {
    if (hidden.has(id)) continue
    const custom = customWords[id]
    if (custom) {
      raw.push(custom.id ? custom : { ...custom, id })
      continue
    }
    const bank = getWordById(id)
    if (bank) raw.push(bank)
  }
  return applyLocalWordEdits(mergeWordsByWriting(raw), customWords, hiddenWordIds)
}

/** Popular words for selected kanji, in selectedKanji order (then study order within each). */
export function buildKanjiSourceWords(
  selectedKanji: string[],
  customWords: Record<string, KanjiWord> = {},
  hiddenWordIds: string[] = [],
  perKanjiLimit = POPULAR_WORDS_PER_KANJI,
): KanjiWord[] {
  const out: KanjiWord[] = []
  const seenWritings = new Set<string>()
  for (const character of selectedKanji) {
    if (!character) continue
    const merged = applyLocalWordEdits(
      mergeWordsByWriting(getPopularWordsForKanji(character, perKanjiLimit)),
      customWords,
      hiddenWordIds,
    ).sort(compareVocabStudyOrder)
    for (const word of merged) {
      if (seenWritings.has(word.writing)) continue
      seenWritings.add(word.writing)
      out.push(word)
    }
  }
  return out
}

export function buildVocabPool(
  preferences: VocabPreferences,
  myWords: string[],
  customWords: Record<string, KanjiWord> = {},
  {
    applyNewWordLimit = true,
    hiddenWordIds = [],
    learnedWordIds = [],
    trainingWordIds = [],
    problemWordIds = [],
  }: {
    /** When false, ignore `newWordLimit` (e.g. choice distractors). */
    applyNewWordLimit?: boolean
    hiddenWordIds?: string[]
    learnedWordIds?: string[]
    trainingWordIds?: string[]
    problemWordIds?: string[]
  } = {},
): VocabCard[] {
  let words: KanjiWord[] = []
  let preserveOrder = false

  if (preferences.source === 'mine') {
    words = resolveMyWords(myWords, customWords, hiddenWordIds)
    if (preferences.mineIncludeLearned === false) {
      const learned = new Set(learnedWordIds)
      words = words.filter((word) => !isVocabWordLearned(word, learned))
    }
  } else if (preferences.source === 'group') {
    words = applyLocalWordEdits(
      mergeWordsByWriting(getWordsForGroup(preferences.groupId)),
      customWords,
      hiddenWordIds,
    )
    if (!preferences.trainFullGroup) {
      const mine = new Set(myWords)
      words = words.filter((word) => !wordVariantIds(word).some((id) => mine.has(id)))
    }
  } else if (preferences.source === 'kanji') {
    words = buildKanjiSourceWords(preferences.selectedKanji ?? [], customWords, hiddenWordIds)
    if (!preferences.trainFullGroup) {
      const mine = new Set(myWords)
      words = words.filter((word) => !wordVariantIds(word).some((id) => mine.has(id)))
    }
    preserveOrder = true
  } else if (preferences.source === 'list') {
    // «Набор» includes words already in «Мои слова» — membership is independent.
    words = resolveTrainingListWords(trainingWordIds, customWords, hiddenWordIds)
    preserveOrder = true
  } else if (preferences.source === 'problem') {
    words = resolveTrainingListWords(problemWordIds, customWords, hiddenWordIds)
    preserveOrder = true
  } else {
    words = applyLocalWordEdits(
      mergeWordsByWriting(getJlptWords(preferences.level as VocabLevelFilter)),
      customWords,
      hiddenWordIds,
    )
  }

  // Curated lists keep every chosen word — JLPT filter would hide untagged custom entries.
  if (
    preferences.source !== 'level' &&
    preferences.source !== 'list' &&
    preferences.source !== 'problem' &&
    preferences.wordJlptLevels?.length
  ) {
    words = filterWordsByJlpt(words, preferences.wordJlptLevels)
  }

  if (!preserveOrder) {
    words = [...words].sort(compareVocabStudyOrder)
  }

  const cards: VocabCard[] = []
  const seen = new Set<string>()
  for (const word of words) {
    const card = wordToVocabCard(word)
    if (!card || seen.has(card.id)) continue
    seen.add(card.id)
    cards.push(card)
  }

  if (applyNewWordLimit) {
    return applyVocabNewWordLimit(cards, preferences)
  }
  return cards
}

/** Apply group-like mine exclusion + newWordLimit to an external/temporary card pool. */
export function filterTemporaryVocabPool(
  cards: VocabCard[],
  {
    myWords,
    trainFullGroup,
    newWordLimit = -1,
    applyNewWordLimit = true,
    wordJlptLevels = [],
  }: {
    myWords: string[]
    trainFullGroup: boolean
    newWordLimit?: number
    applyNewWordLimit?: boolean
    wordJlptLevels?: number[]
  },
): VocabCard[] {
  let next = cards
  if (wordJlptLevels.length) {
    const allow = new Set(wordJlptLevels)
    next = next.filter((card) => {
      if (typeof card.jlpt === 'number' && allow.has(card.jlpt)) return true
      return Boolean(
        card.readings?.some(
          (reading) => typeof reading.jlpt === 'number' && allow.has(reading.jlpt),
        ),
      )
    })
  }
  if (!trainFullGroup) {
    const mine = new Set(myWords)
    next = next.filter((card) => {
      const ids = card.variantIds?.length ? card.variantIds : [card.id]
      return !ids.some((id) => mine.has(id))
    })
  }
  if (applyNewWordLimit && !trainFullGroup && newWordLimit >= 0) {
    return limitVocabCards(next, newWordLimit)
  }
  return next
}

/** Broad JLPT pool for choice/mixed distractors when training a small temporary set. */
export function buildWideVocabDistractorPool(
  customWords: Record<string, KanjiWord> = {},
  hiddenWordIds: string[] = [],
): VocabCard[] {
  const levels: VocabLevelFilter[] = [5, 4, 3, 2, 1]
  const cards: VocabCard[] = []
  const seen = new Set<string>()
  for (const level of levels) {
    const words = applyLocalWordEdits(
      mergeWordsByWriting(getJlptWords(level)),
      customWords,
      hiddenWordIds,
    )
    for (const word of words) {
      const card = wordToVocabCard(word)
      if (!card || seen.has(card.id)) continue
      seen.add(card.id)
      cards.push(card)
    }
    if (cards.length >= 120) break
  }
  return cards
}

/** Kanji-scoped practice pool: merge homographs, then map to VocabCards. */
export function buildKanjiPracticeVocabPool(
  character: string,
  {
    excludedIds = [],
    wordJlptLevels = [],
    limit = POPULAR_WORDS_PER_KANJI,
    customWords = {},
  }: {
    excludedIds?: string[]
    wordJlptLevels?: number[]
    limit?: number
    customWords?: Record<string, KanjiWord>
  } = {},
): VocabCard[] {
  const raw = getPracticeWords(character, {
    excludedIds,
    wordJlptLevels,
    limit,
  })
  const words = applyLocalWordEdits(mergeWordsByWriting(raw), customWords, [])
  const cards: VocabCard[] = []
  const seen = new Set<string>()
  for (const word of words) {
    const card = wordToVocabCard(word)
    if (!card || seen.has(card.id)) continue
    seen.add(card.id)
    cards.push(card)
  }
  return cards
}

/** Next card from the ordered source pool that is not yet in the session. */
export function pickNextSourceCard(
  sourcePool: VocabCard[],
  sessionPoolIds: string[],
): VocabCard | null {
  const inSession = new Set(sessionPoolIds)
  return sourcePool.find((card) => !inSession.has(card.id)) ?? null
}

export function pickUniformVocabCardId(
  pool: Array<{ id: string }>,
  { excludeIds = [], rng = Math.random }: { excludeIds?: string[]; rng?: () => number } = {},
): string | null {
  if (!pool.length) return null

  const excluded = new Set(excludeIds)
  const candidates = excluded.size ? pool.filter((card) => !excluded.has(card.id)) : pool
  const pickable = candidates.length ? candidates : pool
  return pickable[Math.floor(rng() * pickable.length)]?.id ?? null
}

/**
 * Even mode: pick among cards with the fewest session shows.
 * Soft-weights by 1/(1+shows) only as a tie-break helper for tests/UI; the
 * real picker uses {@link pickEvenVocabCardId}.
 */
export function buildEvenModeWeightMultipliers(
  cardIds: string[],
  {
    weightMultipliers = {},
    showCounts = {},
  }: {
    weightMultipliers?: Record<string, number>
    showCounts?: Record<string, number>
  } = {},
): Record<string, number> {
  const out: Record<string, number> = { ...weightMultipliers }
  for (const id of cardIds) {
    const base = out[id] ?? 1
    if (base <= 0) continue
    const shown = showCounts[id] ?? 0
    out[id] = base / (1 + shown)
  }
  return out
}

/**
 * True even coverage: always prefer the least-shown cards in the session.
 * Never-shown cards are exhausted before any card gets a second pass, etc.
 */
export function pickEvenVocabCardId(
  pool: Array<{ id: string }>,
  {
    excludeIds = [],
    weightMultipliers = {},
    showCounts = {},
    rng = Math.random,
  }: {
    excludeIds?: string[]
    weightMultipliers?: Record<string, number>
    showCounts?: Record<string, number>
    rng?: () => number
  } = {},
): string | null {
  if (!pool.length) return null

  const excluded = new Set(excludeIds)
  const active = pool.filter((card) => {
    if (excluded.has(card.id)) return false
    return (weightMultipliers[card.id] ?? 1) > 0
  })
  const pickable = active.length ? active : pool.filter((card) => (weightMultipliers[card.id] ?? 1) > 0)
  const candidates = pickable.length ? pickable : pool
  if (!candidates.length) return null

  let minShows = Infinity
  for (const card of candidates) {
    const shown = showCounts[card.id] ?? 0
    if (shown < minShows) minShows = shown
  }

  const leastShown = candidates.filter((card) => (showCounts[card.id] ?? 0) === minShows)
  return leastShown[Math.floor(rng() * leastShown.length)]?.id ?? null
}

export function pickWeightedVocabCardId(
  pool: Array<{ id: string }>,
  {
    excludeIds = [],
    weightMultipliers = {},
    rng = Math.random,
  }: {
    excludeIds?: string[]
    weightMultipliers?: Record<string, number>
    rng?: () => number
  } = {},
): string | null {
  if (!pool.length) return null

  const excluded = new Set(excludeIds)
  const candidates = excluded.size ? pool.filter((card) => !excluded.has(card.id)) : pool
  const pickable = candidates.length ? candidates : pool
  const weighted = pickable.map((card) => ({
    card,
    weight: Math.max(0, weightMultipliers[card.id] ?? 1),
  }))
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) {
    return pickable[Math.floor(rng() * pickable.length)]?.id ?? null
  }

  let cursor = rng() * total
  for (const entry of weighted) {
    cursor -= entry.weight
    if (cursor <= 0) {
      return entry.card.id
    }
  }
  return weighted.at(-1)?.card.id ?? null
}

export function buildChoiceOptions(
  card: VocabCard,
  pool: VocabCard[],
  { count = 6, rng = Math.random }: { count?: number; rng?: () => number } = {},
): string[] {
  const correct = card.meaning
  const correctKey = normalizeQuizGlossKey(correct)
  const seen = new Set<string>(correctKey ? [correctKey] : [])

  // Prefer similar distractors (shared kanji / close kana / meaning overlap).
  const ranked = [...pool]
    .filter((item) => item.id !== card.id && item.meaning)
    .map((item) => ({
      item,
      score: vocabSimilarity(card, item),
    }))
    .sort((a, b) => b.score - a.score)

  const similar: string[] = []
  const rest: string[] = []
  for (const entry of ranked) {
    const key = normalizeQuizGlossKey(entry.item.meaning)
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (entry.score >= 0.18) similar.push(entry.item.meaning)
    else rest.push(entry.item.meaning)
  }

  const picked: string[] = []
  const similarBag = [...similar]
  const restBag = [...rest]
  const similarTarget = Math.min(count - 1, Math.max(2, Math.ceil((count - 1) * 0.6)))

  while (picked.length < similarTarget && similarBag.length) {
    // Soft-weighted: front of the list (more similar) more often.
    const index = Math.floor(rng() * rng() * similarBag.length)
    picked.push(similarBag.splice(index, 1)[0]!)
  }
  while (picked.length < count - 1 && restBag.length) {
    const index = Math.floor(rng() * restBag.length)
    picked.push(restBag.splice(index, 1)[0]!)
  }
  while (picked.length < count - 1 && similarBag.length) {
    picked.push(similarBag.shift()!)
  }

  while (picked.length < count - 1) {
    picked.push(`Вариант ${picked.length + 1}`)
  }

  const options = [correct, ...picked.slice(0, count - 1)]
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return options
}
