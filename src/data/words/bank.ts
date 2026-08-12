import type { KanjiBankMeta, KanjiComponent, KanjiInfo, KanjiWord } from '../../shared/lib/types'
import { isColloquialWord } from '../../shared/lib/colloquial'
import kanjiList from './kanji-list.json' with { type: 'json' }
import words from './words.json' with { type: 'json' }
import wordsByKanji from './words-by-kanji.json' with { type: 'json' }
import components from './components.json' with { type: 'json' }
import meta from './meta.json' with { type: 'json' }

export const KANJI_BANK_META = meta as KanjiBankMeta
export const KANJI_LIST = kanjiList as KanjiInfo[]
export const KANJI_WORDS = words as KanjiWord[]
export const KANJI_COMPONENTS = components as KanjiComponent[]

const kanjiById: Record<string, KanjiInfo> = Object.fromEntries(KANJI_LIST.map((item) => [item.character, item]))
const componentById = new Map<string, KanjiComponent>(KANJI_COMPONENTS.map((item) => [item.id, item]))
const wordsByKanjiMap = wordsByKanji as Record<string, number[]>
const wordById = new Map<string, KanjiWord>()
const wordsByWriting = new Map<string, KanjiWord[]>()
const wordsByKana = new Map<string, KanjiWord[]>()
for (const word of KANJI_WORDS) {
  if (word.id) {
    wordById.set(word.id, word)
  }
  const writingList = wordsByWriting.get(word.writing)
  if (writingList) writingList.push(word)
  else wordsByWriting.set(word.writing, [word])

  const kanaKey = word.kana?.trim()
  if (kanaKey) {
    const kanaList = wordsByKana.get(kanaKey)
    if (kanaList) kanaList.push(word)
    else wordsByKana.set(kanaKey, [word])
  }
}

const jlptWordsCache = new Map<number | 'other', KanjiWord[]>()
const joyoListCache = { value: null as KanjiInfo[] | null }

/** Cap for “popular” examples per kanji in training / UI lists. */
export const POPULAR_WORDS_PER_KANJI = 12

/**
 * Relative popularity for study order.
 * Today: JMDict `common` (priority forms) + JLPT ease + short writing.
 * Later: can fold in corpus `freqRank` without changing call sites.
 */
export function wordPopularityScore(
  word: Pick<KanjiWord, 'jlpt' | 'common' | 'writing'>,
  character?: string,
): number {
  let score = 0
  if (word.common) score += 100_000
  if (typeof word.jlpt === 'number' && word.jlpt >= 1 && word.jlpt <= 5) {
    score += word.jlpt * 10_000
  }
  if (character && word.writing === character) score += 5_000
  score -= Math.min(word.writing.length, 24) * 100
  return score
}

function sortWords(list: KanjiWord[], character?: string): KanjiWord[] {
  return [...list].sort((left, right) => {
    const scoreDelta = wordPopularityScore(right, character) - wordPopularityScore(left, character)
    if (scoreDelta) return scoreDelta
    return left.writing.localeCompare(right.writing, 'ja')
  })
}

export function getKanjiByLevel(level: number): KanjiInfo[] {
  return KANJI_LIST.filter((item) => item.level === level)
}

export function getJoyoKanji(): KanjiInfo[] {
  if (joyoListCache.value) return joyoListCache.value
  joyoListCache.value = KANJI_LIST.filter((item) => item.joyo)
  return joyoListCache.value
}

export function getKanjiInfo(character: string): KanjiInfo | null {
  return kanjiById[character] ?? null
}

export function getKanjiComponents(character: string): NonNullable<KanjiInfo['components']> {
  return getKanjiInfo(character)?.components ?? []
}

export function getComponent(id: string | null | undefined): KanjiComponent | null {
  if (!id) return null
  return componentById.get(id) ?? null
}

export function getKanjiUsingComponent(id: string, limit = 24): KanjiInfo[] {
  const component = getComponent(id)
  if (!component) return []
  const out: KanjiInfo[] = []
  for (const character of component.usedIn) {
    const info = getKanjiInfo(character)
    if (info) {
      out.push(info)
      if (out.length >= limit) break
    }
  }
  return out
}

export function getWordsForKanji(character: string): KanjiWord[] {
  const indexes = wordsByKanjiMap[character] ?? []
  const list = indexes.map((index) => KANJI_WORDS[index]).filter(Boolean)
  return sortWords(list, character)
}

export function getWordById(id: string | null | undefined): KanjiWord | null {
  if (!id) return null
  return wordById.get(id) ?? null
}

export function getWordsByWriting(writing: string | null | undefined): KanjiWord[] {
  if (!writing) return []
  return wordsByWriting.get(writing) ?? []
}

/** Exact kana reading lookup (JMDict often stores colloquial forms as kana of a kanji writing). */
export function getWordsByKana(kana: string | null | undefined): KanjiWord[] {
  if (!kana) return []
  return wordsByKana.get(kana.trim()) ?? []
}

export function getWordsByIds(ids: string[]): KanjiWord[] {
  return ids.map((id) => wordById.get(id)).filter((word): word is KanjiWord => Boolean(word))
}

export function getJlptWords(level: 5 | 4 | 3 | 2 | 1 | 'other'): KanjiWord[] {
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

let colloquialWordsCache: KanjiWord[] | null = null

/** Words with at least one (разг.)/(прост.) sense. */
export function getColloquialWords(): KanjiWord[] {
  if (colloquialWordsCache) return colloquialWordsCache
  colloquialWordsCache = sortWords(KANJI_WORDS.filter((word) => isColloquialWord(word)))
  return colloquialWordsCache
}

export function searchWords(query: string, { limit = 80 }: { limit?: number } = {}): KanjiWord[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const results: KanjiWord[] = []
  for (const word of KANJI_WORDS) {
    const haystack = [word.writing, word.kana, word.romaji, ...(word.meanings ?? [])].join(' ').toLowerCase()
    if (haystack.includes(normalized)) {
      results.push(word)
      if (results.length >= limit) break
    }
  }
  return results
}

export function getTopWordsForKanji(
  character: string,
  limit = POPULAR_WORDS_PER_KANJI,
): KanjiWord[] {
  return getPopularWordsForKanji(character, limit)
}

/**
 * Most useful study words for a kanji: JMDict-common + JLPT first, then shorter /
 * single-character writings. Falls back to untagged words when tagged coverage is thin.
 */
export function getPopularWordsForKanji(
  character: string,
  limit = POPULAR_WORDS_PER_KANJI,
): KanjiWord[] {
  const cap = Math.max(0, limit)
  if (!cap) return []
  const sorted = getWordsForKanji(character)
  const preferred = sorted.filter(
    (word) =>
      Boolean(word.common) ||
      (typeof word.jlpt === 'number' && word.jlpt >= 1 && word.jlpt <= 5),
  )
  const pool = preferred.length >= Math.min(4, cap) ? preferred : sorted
  return pool.slice(0, cap)
}

export function getPracticeWords(
  character: string,
  {
    excludedIds = [],
    wordJlptLevels = [],
    limit = POPULAR_WORDS_PER_KANJI,
  }: {
    excludedIds?: string[]
    /** Empty = no JLPT filter. Otherwise keep words whose `jlpt` is in the list. */
    wordJlptLevels?: number[]
    limit?: number
  } = {},
): KanjiWord[] {
  const excluded = new Set(excludedIds)
  const jlptAllow = new Set(wordJlptLevels.filter((level) => level >= 1 && level <= 5))
  // Prefer the popular shortlist unless the caller asks for a wide pool.
  const source =
    limit > POPULAR_WORDS_PER_KANJI
      ? getWordsForKanji(character)
      : getPopularWordsForKanji(character, POPULAR_WORDS_PER_KANJI)
  let filtered = source.filter((word) => !word.id || !excluded.has(word.id))
  if (jlptAllow.size) {
    filtered = filtered.filter((word) => typeof word.jlpt === 'number' && jlptAllow.has(word.jlpt))
  }

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

export function formatCompositionFormula(character: string): string {
  const parts = getKanjiComponents(character)
  if (!parts.length) return character
  return `${parts.map((part) => part.glyph).join(' + ')} → ${character}`
}
