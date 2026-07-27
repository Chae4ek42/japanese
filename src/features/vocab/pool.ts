import type {
  KanjiWord,
  StatsRecord,
  VocabCard,
  VocabLevelFilter,
  VocabPreferences,
} from '../../shared/lib/types'
import { normalizeQuizGlossKey, pickQuizMeaning } from '../../shared/lib/jmdict-gloss'
import { getJlptWords } from '../../data/words/bank'
import { resolveMyWords } from './customWords'
import { getWordsForGroup } from './groups'

export function normalizeRomajiAnswer(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s_\-’']/g, '')
    .trim()
}

export function wordToVocabCard(word: KanjiWord): VocabCard | null {
  if (!word.id) return null
  const romaji = normalizeRomajiAnswer(word.romaji)
  if (!romaji) return null
  const meaning = pickQuizMeaning(word.meanings)
  if (!meaning) return null
  return {
    id: word.id,
    writing: word.writing,
    kana: word.kana,
    romaji: word.romaji,
    answers: [romaji],
    meaning,
    meanings: word.meanings,
    jlpt: word.jlpt,
  }
}

function isNewCard(cardId: string, stats: Record<string, StatsRecord>): boolean {
  return (stats[cardId]?.exposures ?? 0) === 0
}

/** Keep all seen cards; add up to `limit` unseen. `limit <= 0` → no change. */
export function limitNewVocabCards(
  cards: VocabCard[],
  stats: Record<string, StatsRecord>,
  limit: number,
): VocabCard[] {
  if (!limit || limit <= 0) return cards
  const seen: VocabCard[] = []
  const unseen: VocabCard[] = []
  for (const card of cards) {
    if (isNewCard(card.id, stats)) unseen.push(card)
    else seen.push(card)
  }
  return [...seen, ...unseen.slice(0, limit)]
}

export function buildVocabPool(
  preferences: VocabPreferences,
  myWords: string[],
  customWords: Record<string, KanjiWord> = {},
  {
    stats = {},
    applyNewWordLimit = true,
  }: {
    stats?: Record<string, StatsRecord>
    /** When false, ignore `newWordLimit` (e.g. choice distractors). */
    applyNewWordLimit?: boolean
  } = {},
): VocabCard[] {
  let words: KanjiWord[] = []
  if (preferences.source === 'mine') {
    words = resolveMyWords(myWords, customWords)
  } else if (preferences.source === 'group') {
    words = getWordsForGroup(preferences.groupId)
  } else {
    words = getJlptWords(preferences.level as VocabLevelFilter)
  }

  if (preferences.source !== 'level' && preferences.wordJlptLevels?.length) {
    const allow = new Set(preferences.wordJlptLevels)
    words = words.filter((word) => typeof word.jlpt === 'number' && allow.has(word.jlpt as 1 | 2 | 3 | 4 | 5))
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
    return limitNewVocabCards(cards, stats, preferences.newWordLimit ?? 0)
  }
  return cards
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
