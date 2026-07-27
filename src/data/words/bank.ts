import type { KanjiBankMeta, KanjiComponent, KanjiInfo, KanjiWord } from '../../shared/lib/types'
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
const levelByKanji: Record<string, number> = Object.fromEntries(KANJI_LIST.map((item) => [item.character, item.level]))
const componentById = new Map<string, KanjiComponent>(KANJI_COMPONENTS.map((item) => [item.id, item]))
const wordsByKanjiMap = wordsByKanji as Record<string, number[]>
const wordById = new Map<string, KanjiWord>()
for (const word of KANJI_WORDS) {
  if (word.id) {
    wordById.set(word.id, word)
  }
}

const jlptWordsCache = new Map<number | 'other', KanjiWord[]>()
const joyoListCache = { value: null as KanjiInfo[] | null }

function sortWords(list: KanjiWord[]): KanjiWord[] {
  return [...list].sort((left, right) => {
    const jlptDelta = (right.jlpt ?? 0) - (left.jlpt ?? 0)
    if (jlptDelta) return jlptDelta
    if (Boolean(right.common) !== Boolean(left.common)) {
      return Number(Boolean(right.common)) - Number(Boolean(left.common))
    }
    if (left.writing.length !== right.writing.length) {
      return left.writing.length - right.writing.length
    }
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
  return indexes.map((index) => KANJI_WORDS[index]).filter(Boolean)
}

export function getWordById(id: string | null | undefined): KanjiWord | null {
  if (!id) return null
  return wordById.get(id) ?? null
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

export function getTopWordsForKanji(character: string, limit = 5): KanjiWord[] {
  return getWordsForKanji(character).slice(0, Math.max(0, limit))
}

export function isWordAllowedByComplexity(
  word: Pick<KanjiWord, 'kanji'>,
  targetKanji: string,
  learnedSet: Set<string>,
): boolean {
  const targetLevel = levelByKanji[targetKanji]
  if (targetLevel === undefined) {
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
    // Unknown neighbor or harder JLPT (lower number) → block when filtering.
    if (level === undefined) {
      return false
    }
    if (level === 0) {
      // Jōyō-only without JLPT: allow if target is also advanced/joyo (level ≤ 2 or 0).
      if (targetLevel !== 0 && targetLevel > 2) {
        return false
      }
      continue
    }
    if (level < targetLevel) {
      return false
    }
  }
  return true
}

export function getPracticeWords(
  character: string,
  {
    learned = [],
    complexityFilter = true,
    excludedIds = [],
    wordJlptLevels = [],
    limit = 12,
  }: {
    learned?: string[]
    complexityFilter?: boolean
    excludedIds?: string[]
    /** Empty = no JLPT filter. Otherwise keep words whose `jlpt` is in the list. */
    wordJlptLevels?: number[]
    limit?: number
  } = {},
): KanjiWord[] {
  const learnedSet = new Set(learned)
  const excluded = new Set(excludedIds)
  const jlptAllow = new Set(wordJlptLevels.filter((level) => level >= 1 && level <= 5))
  const pool = getWordsForKanji(character).filter((word) => !word.id || !excluded.has(word.id))
  let filtered = complexityFilter
    ? pool.filter((word) => isWordAllowedByComplexity(word, character, learnedSet))
    : pool
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
