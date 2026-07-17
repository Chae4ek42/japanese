import type { KanjiBankMeta, KanjiInfo, KanjiWord } from '../../../shared/lib/types'
import kanjiList from './kanji-list.json' with { type: 'json' }
import words from './words.json' with { type: 'json' }
import wordsByKanji from './words-by-kanji.json' with { type: 'json' }
import meta from './meta.json' with { type: 'json' }

export const KANJI_BANK_META = meta as KanjiBankMeta
export const KANJI_LIST = kanjiList as KanjiInfo[]
export const KANJI_WORDS = words as KanjiWord[]

const kanjiById: Record<string, KanjiInfo> = Object.fromEntries(KANJI_LIST.map((item) => [item.character, item]))
const levelByKanji: Record<string, number> = Object.fromEntries(KANJI_LIST.map((item) => [item.character, item.level]))
const wordsByKanjiMap = wordsByKanji as Record<string, number[]>
const wordById = new Map<string, KanjiWord>()
for (const word of KANJI_WORDS) {
  if (word.id) {
    wordById.set(word.id, word)
  }
}

const jlptWordsCache = new Map<number | 'other', KanjiWord[]>()

function sortWords(list: KanjiWord[]): KanjiWord[] {
  return [...list].sort((left, right) => {
    const jlptDelta = (right.jlpt ?? 0) - (left.jlpt ?? 0)
    if (jlptDelta) return jlptDelta
    if (left.writing.length !== right.writing.length) {
      return left.writing.length - right.writing.length
    }
    return left.writing.localeCompare(right.writing, 'ja')
  })
}

export function getKanjiByLevel(level: number): KanjiInfo[] {
  return KANJI_LIST.filter((item) => item.level === level)
}

export function getKanjiInfo(character: string): KanjiInfo | null {
  return kanjiById[character] ?? null
}

export function getWordsForKanji(character: string): KanjiWord[] {
  const indexes = wordsByKanjiMap[character] ?? []
  return indexes.map((index) => KANJI_WORDS[index]).filter(Boolean)
}

export function getWordById(id: string | null | undefined): KanjiWord | null {
  if (!id) return null
  return wordById.get(id) ?? null
}

export function getWordsByIds(ids: string[]): KanjiWord[] {
  return ids.map((id) => wordById.get(id)).filter((word): word is KanjiWord => Boolean(word))
}

export function getJlptWords(level: 5 | 4 | 3 | 'other'): KanjiWord[] {
  const cached = jlptWordsCache.get(level)
  if (cached) return cached

  const list =
    level === 'other'
      ? KANJI_WORDS.filter((word) => !word.jlpt)
      : KANJI_WORDS.filter((word) => word.jlpt === level)

  const sorted = sortWords(list)
  jlptWordsCache.set(level, sorted)
  return sorted
}

export function searchWords(query: string, { limit = 80 }: { limit?: number } = {}): KanjiWord[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const results: KanjiWord[] = []
  for (const word of KANJI_WORDS) {
    const haystack = [
      word.writing,
      word.kana,
      word.romaji,
      ...(word.meanings ?? []),
    ]
      .join(' ')
      .toLowerCase()
    if (haystack.includes(normalized)) {
      results.push(word)
      if (results.length >= limit) break
    }
  }
  return results
}

export function getTopWordsForKanji(character: string, limit = 5): KanjiWord[] {
  return getWordsForKanji(character).slice(0, Math.max(0, limit))
}

export function isWordAllowedByComplexity(word: Pick<KanjiWord, 'kanji'>, targetKanji: string, learnedSet: Set<string>): boolean {
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

export function getPracticeWords(
  character: string,
  { learned = [], complexityFilter = true, limit = 12 }: { learned?: string[]; complexityFilter?: boolean; limit?: number } = {},
): KanjiWord[] {
  const learnedSet = new Set(learned)
  const pool = getWordsForKanji(character)
  const filtered = complexityFilter
    ? pool.filter((word) => isWordAllowedByComplexity(word, character, learnedSet))
    : pool

  return filtered.slice(0, limit)
}

export function pickRandomUnlearnedKanji(
  learned: string[] = [],
  levels: number[] = [5, 4, 3],
  rng: () => number = Math.random,
): KanjiInfo | null {
  const learnedSet = new Set(learned)
  const pool = KANJI_LIST.filter((item) => levels.includes(item.level) && !learnedSet.has(item.character))
  if (!pool.length) {
    return null
  }
  return pool[Math.floor(rng() * pool.length)]
}
