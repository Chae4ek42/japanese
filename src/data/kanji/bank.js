import kanjiList from './kanji-list.json' with { type: 'json' }
import words from './words.json' with { type: 'json' }
import wordsByKanji from './words-by-kanji.json' with { type: 'json' }
import meta from './meta.json' with { type: 'json' }

export const KANJI_BANK_META = meta
export const KANJI_LIST = kanjiList
export const KANJI_WORDS = words

const kanjiById = Object.fromEntries(KANJI_LIST.map((item) => [item.character, item]))
const levelByKanji = Object.fromEntries(KANJI_LIST.map((item) => [item.character, item.level]))

export function getKanjiByLevel(level) {
  return KANJI_LIST.filter((item) => item.level === level)
}

export function getKanjiInfo(character) {
  return kanjiById[character] ?? null
}

export function getWordsForKanji(character) {
  const indexes = wordsByKanji[character] ?? []
  return indexes.map((index) => KANJI_WORDS[index]).filter(Boolean)
}

/** Уже отсортированы при сборке: JLPT → common → короче написание. */
export function getTopWordsForKanji(character, limit = 5) {
  return getWordsForKanji(character).slice(0, Math.max(0, limit))
}

/**
 * Фильтр сложности: соседние кандзи только выученные или не сложнее целевого JLPT.
 * Кандзи вне N5–N3 считаются слишком сложными.
 */
export function isWordAllowedByComplexity(word, targetKanji, learnedSet) {
  const targetLevel = levelByKanji[targetKanji]
  if (!targetLevel) {
    return false
  }

  for (const ch of word.kanji ?? []) {
    if (ch === targetKanji) {
      continue
    }
    if (learnedSet.has(ch)) {
      continue
    }
    const level = levelByKanji[ch]
    if (!level || level < targetLevel) {
      return false
    }
  }
  return true
}

export function getPracticeWords(character, { learned = [], complexityFilter = true, limit = 12 } = {}) {
  const learnedSet = new Set(learned)
  const pool = getWordsForKanji(character)
  const filtered = complexityFilter
    ? pool.filter((word) => isWordAllowedByComplexity(word, character, learnedSet))
    : pool

  return filtered.slice(0, limit)
}

export function pickRandomUnlearnedKanji(learned = [], levels = [5, 4, 3], rng = Math.random) {
  const learnedSet = new Set(learned)
  const pool = KANJI_LIST.filter((item) => levels.includes(item.level) && !learnedSet.has(item.character))
  if (!pool.length) {
    return null
  }
  return pool[Math.floor(rng() * pool.length)]
}
