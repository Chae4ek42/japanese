import type { KanjiWord, KanjiWordReading } from '../../shared/lib/types'
import { getWordById, getWordsByWriting } from '../../data/words/bank'
import { mergeWordsByWriting, wordReadings } from './mergeHomographs'

const HAN_RE = /\p{Script=Han}/u

export function isCustomWordId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('custom:'))
}

export function createCustomWordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom:${crypto.randomUUID()}`
  }
  return `custom:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function extractKanjiChars(writing: string): string[] {
  return [...new Set([...writing].filter((ch) => HAN_RE.test(ch)))]
}

export function parseMeaningsInput(value: string): string[] {
  return String(value ?? '')
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function meaningsToInput(meanings: string[]): string {
  return meanings.filter(Boolean).join(', ')
}

export interface ReadingDraft {
  /** Stable UI key; not persisted. */
  key: string
  id?: string
  kana: string
  romaji: string
  /** Meanings as comma/semicolon-separated text. */
  meanings: string
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

export function createReadingDraft(seed?: Partial<KanjiWordReading>): ReadingDraft {
  const key =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    key,
    id: seed?.id,
    kana: seed?.kana ?? '',
    romaji: seed?.romaji ?? '',
    meanings: meaningsToInput(seed?.meanings ?? []),
  }
}

/** Build editor drafts from a card/word (one block per reading). */
export function cardToReadingDrafts(word: {
  id?: string
  kana?: string
  romaji?: string
  meanings?: string[]
  readings?: KanjiWordReading[]
}): ReadingDraft[] {
  const readings = wordReadings({
    writing: '',
    kana: word.kana ?? '',
    romaji: word.romaji ?? '',
    meanings: word.meanings ?? [],
    kanji: [],
    id: word.id,
    readings: word.readings,
  })
  return readings.map((reading) => createReadingDraft(reading))
}

/**
 * Build a KanjiWord from writing + one or more reading drafts.
 * Top-level kana/romaji/meanings mirror the readings (joined) for older code paths.
 */
export function buildWordFromReadings(input: {
  writing: string
  readings: ReadingDraft[]
  id?: string
  jlpt?: number
  variantIds?: string[]
  kanji?: string[]
}): KanjiWord | null {
  const writing = input.writing.trim()
  if (!writing) return null

  const readings: KanjiWordReading[] = []
  for (const draft of input.readings) {
    const kana = draft.kana.trim()
    const romaji = draft.romaji.trim()
    const meanings = parseMeaningsInput(draft.meanings)
    if (!kana || !romaji || !meanings.length) continue
    readings.push({
      id: draft.id?.trim() || undefined,
      kana,
      romaji,
      meanings,
    })
  }
  if (!readings.length) return null

  const id = input.id?.trim() ? input.id.trim() : createCustomWordId()
  const meanings = uniqueStrings(readings.flatMap((reading) => reading.meanings))
  const variantIds = uniqueStrings([
    ...(input.variantIds ?? []),
    ...readings.map((reading) => reading.id).filter((value): value is string => Boolean(value)),
    id,
  ])

  return {
    id,
    writing,
    kana: readings.map((reading) => reading.kana).join(' / '),
    romaji: readings.map((reading) => reading.romaji).join(' / '),
    meanings,
    kanji: input.kanji?.length ? [...input.kanji] : extractKanjiChars(writing),
    jlpt: input.jlpt,
    readings,
    variantIds: variantIds.length ? variantIds : undefined,
  }
}

export function buildCustomWord(input: {
  writing: string
  kana: string
  romaji: string
  meanings: string
  id?: string
}): KanjiWord | null {
  return buildWordFromReadings({
    writing: input.writing,
    id: input.id,
    readings: [
      createReadingDraft({
        kana: input.kana,
        romaji: input.romaji,
        meanings: parseMeaningsInput(input.meanings),
      }),
    ],
  })
}

/** N5 → N1, then writing/kana lexicographic — stable study order for groups. */
export function compareVocabStudyOrder(
  left: { jlpt?: number; writing: string; kana?: string; id?: string },
  right: { jlpt?: number; writing: string; kana?: string; id?: string },
): number {
  const rank = (jlpt?: number) => (typeof jlpt === 'number' && jlpt >= 1 && jlpt <= 5 ? jlpt : 0)
  const leftRank = rank(left.jlpt)
  const rightRank = rank(right.jlpt)
  if (leftRank !== rightRank) {
    if (leftRank === 0) return 1
    if (rightRank === 0) return -1
    return rightRank - leftRank
  }
  const byWriting = left.writing.localeCompare(right.writing, 'ja')
  if (byWriting) return byWriting
  const byKana = (left.kana ?? '').localeCompare(right.kana ?? '', 'ja')
  if (byKana) return byKana
  return String(left.id ?? '').localeCompare(String(right.id ?? ''))
}

export function applyLocalWordEdits(
  words: KanjiWord[],
  customWords: Record<string, KanjiWord> = {},
  hiddenWordIds: string[] = [],
): KanjiWord[] {
  const hidden = new Set(hiddenWordIds)
  const result: KanjiWord[] = []
  for (const word of words) {
    const ids = word.id ? [word.id, ...(word.variantIds ?? [])] : [...(word.variantIds ?? [])]
    if (ids.some((id) => hidden.has(id))) continue
    const override =
      (word.id && customWords[word.id]) ||
      ids.map((id) => customWords[id]).find(Boolean)
    if (!override) {
      result.push(word)
      continue
    }
    const readings = wordReadings(override).map((reading) => ({
      ...reading,
      meanings: [...reading.meanings],
    }))
    const meanings = uniqueStrings(readings.flatMap((reading) => reading.meanings))
    result.push({
      ...word,
      id: word.id ?? override.id,
      writing: override.writing,
      kana: readings.map((reading) => reading.kana).filter(Boolean).join(' / ') || override.kana,
      romaji: readings.map((reading) => reading.romaji).filter(Boolean).join(' / ') || override.romaji,
      meanings: meanings.length ? meanings : [...override.meanings],
      kanji: override.kanji?.length ? override.kanji : word.kanji,
      readings,
      variantIds: uniqueStrings([
        ...(word.variantIds ?? []),
        ...(override.variantIds ?? []),
        ...readings.map((reading) => reading.id).filter((value): value is string => Boolean(value)),
        word.id,
        override.id,
      ].filter((value): value is string => Boolean(value))),
    })
  }
  return result
}

export function resolveMyWords(
  ids: string[],
  customWords: Record<string, KanjiWord> = {},
  hiddenWordIds: string[] = [],
): KanjiWord[] {
  const hidden = new Set(hiddenWordIds)
  const collected: KanjiWord[] = []
  const seenIds = new Set<string>()

  for (const id of ids) {
    if (!id || seenIds.has(id) || hidden.has(id)) continue
    const custom = customWords[id]
    if (custom) {
      seenIds.add(id)
      collected.push(custom.id ? custom : { ...custom, id })
      continue
    }
    const word = getWordById(id)
    if (!word) continue
    const homographs = getWordsByWriting(word.writing)
    for (const item of homographs.length ? homographs : [word]) {
      if (!item.id || seenIds.has(item.id) || hidden.has(item.id)) continue
      seenIds.add(item.id)
      collected.push(item)
    }
  }

  return applyLocalWordEdits(mergeWordsByWriting(collected), customWords, hiddenWordIds)
}
