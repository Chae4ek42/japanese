import type { KanjiWord, VocabCard, VocabLevelFilter, VocabPreferences } from '../../shared/lib/types'
import { getJlptWords, getWordsByIds } from '../kanji/data/bank'
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
  const meaning = word.meanings[0]?.trim() || '—'
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

export function buildVocabPool(preferences: VocabPreferences, myWords: string[]): VocabCard[] {
  let words: KanjiWord[] = []
  if (preferences.source === 'mine') {
    words = getWordsByIds(myWords)
  } else if (preferences.source === 'group') {
    words = getWordsForGroup(preferences.groupId)
  } else {
    words = getJlptWords(preferences.level as VocabLevelFilter)
  }

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

export function buildChoiceOptions(
  card: VocabCard,
  pool: VocabCard[],
  { count = 6, rng = Math.random }: { count?: number; rng?: () => number } = {},
): string[] {
  const correct = card.meaning
  const distractors = pool
    .filter((item) => item.id !== card.id && item.meaning && item.meaning !== correct)
    .map((item) => item.meaning)

  const uniqueDistractors = [...new Set(distractors)]
  const picked: string[] = []
  const bag = [...uniqueDistractors]

  while (picked.length < count - 1 && bag.length) {
    const index = Math.floor(rng() * bag.length)
    picked.push(bag.splice(index, 1)[0])
  }

  // fallback fillers if pool is tiny
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
