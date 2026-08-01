import type { KanjiWord, VocabCard, VocabLevelFilter, VocabPreferences } from '../../shared/lib/types'
import { normalizeQuizGlossKey, pickQuizMeaning } from '../../shared/lib/jmdict-gloss'
import { getJlptWords } from '../../data/words/bank'
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

export function buildVocabPool(
  preferences: VocabPreferences,
  myWords: string[],
  customWords: Record<string, KanjiWord> = {},
  {
    applyNewWordLimit = true,
    hiddenWordIds = [],
    learnedWordIds = [],
  }: {
    /** When false, ignore `newWordLimit` (e.g. choice distractors). */
    applyNewWordLimit?: boolean
    hiddenWordIds?: string[]
    learnedWordIds?: string[]
  } = {},
): VocabCard[] {
  let words: KanjiWord[] = []
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
  } else {
    words = applyLocalWordEdits(
      mergeWordsByWriting(getJlptWords(preferences.level as VocabLevelFilter)),
      customWords,
      hiddenWordIds,
    )
  }

  if (preferences.source !== 'level' && preferences.wordJlptLevels?.length) {
    words = filterWordsByJlpt(words, preferences.wordJlptLevels)
  }

  words = [...words].sort(compareVocabStudyOrder)

  const cards: VocabCard[] = []
  const seen = new Set<string>()
  for (const word of words) {
    const card = wordToVocabCard(word)
    if (!card || seen.has(card.id)) continue
    seen.add(card.id)
    cards.push(card)
  }

  const newWordLimit = preferences.newWordLimit ?? -1
  if (
    applyNewWordLimit &&
    preferences.source !== 'mine' &&
    !(preferences.source === 'group' && preferences.trainFullGroup) &&
    newWordLimit >= 0
  ) {
    return limitVocabCards(cards, newWordLimit)
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
  const distractors: string[] = []

  for (const item of pool) {
    if (item.id === card.id || !item.meaning) continue
    const key = normalizeQuizGlossKey(item.meaning)
    if (!key || seen.has(key)) continue
    seen.add(key)
    distractors.push(item.meaning)
  }

  const picked: string[] = []
  const bag = [...distractors]

  while (picked.length < count - 1 && bag.length) {
    const index = Math.floor(rng() * bag.length)
    picked.push(bag.splice(index, 1)[0])
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
