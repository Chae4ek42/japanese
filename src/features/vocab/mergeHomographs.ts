import type { KanjiWord, KanjiWordReading } from '../../shared/lib/types'

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

export function wordReadings(word: KanjiWord): KanjiWordReading[] {
  if (word.readings?.length) {
    return word.readings.map((reading) => ({
      ...reading,
      meanings: [...(reading.meanings ?? [])],
    }))
  }
  return [
    {
      id: word.id,
      kana: word.kana,
      romaji: word.romaji,
      meanings: [...(word.meanings ?? [])],
      jlpt: word.jlpt,
      common: word.common,
    },
  ]
}

export function wordVariantIds(word: KanjiWord): string[] {
  if (word.variantIds?.length) return [...word.variantIds]
  const fromReadings = wordReadings(word)
    .map((reading) => reading.id)
    .filter((id): id is string => Boolean(id))
  if (fromReadings.length) return uniqueStrings(fromReadings)
  return word.id ? [word.id] : []
}

function readingKey(reading: KanjiWordReading): string {
  return `${reading.kana.trim()}||${reading.romaji.trim().toLowerCase()}`
}

function compareWordPriority(left: KanjiWord, right: KanjiWord): number {
  if (Boolean(left.common) !== Boolean(right.common)) {
    return Number(Boolean(right.common)) - Number(Boolean(left.common))
  }
  const jlptLeft = left.jlpt ?? 0
  const jlptRight = right.jlpt ?? 0
  if (jlptLeft !== jlptRight) return jlptRight - jlptLeft
  return String(left.id ?? '').localeCompare(String(right.id ?? ''))
}

function mergeReadingGroup(words: KanjiWord[]): KanjiWord {
  const sorted = [...words].sort(compareWordPriority)
  const primary = sorted[0]!
  const readingsByKey = new Map<string, KanjiWordReading>()

  for (const word of sorted) {
    for (const reading of wordReadings(word)) {
      const key = readingKey(reading)
      const existing = readingsByKey.get(key)
      if (existing) {
        existing.meanings = uniqueStrings([...existing.meanings, ...reading.meanings])
        if (!existing.id && reading.id) existing.id = reading.id
        if (reading.common) existing.common = true
        if (
          typeof reading.jlpt === 'number' &&
          (typeof existing.jlpt !== 'number' || reading.jlpt > existing.jlpt)
        ) {
          existing.jlpt = reading.jlpt
        }
        continue
      }
      readingsByKey.set(key, {
        id: reading.id,
        kana: reading.kana,
        romaji: reading.romaji,
        meanings: uniqueStrings(reading.meanings),
        jlpt: reading.jlpt,
        common: reading.common,
      })
    }
  }

  const readings = [...readingsByKey.values()]
  const variantIds = uniqueStrings(sorted.flatMap((word) => wordVariantIds(word)))
  const meanings = uniqueStrings(readings.flatMap((reading) => reading.meanings))
  const jlpt = readings.reduce<number | undefined>((best, reading) => {
    if (typeof reading.jlpt !== 'number') return best
    if (typeof best !== 'number') return reading.jlpt
    return Math.max(best, reading.jlpt)
  }, primary.jlpt)

  const first = readings[0]!
  return {
    ...primary,
    id: primary.id ?? first.id,
    kana: readings.map((reading) => reading.kana).filter(Boolean).join(' / ') || primary.kana,
    romaji: readings.map((reading) => reading.romaji).filter(Boolean).join(' / ') || primary.romaji,
    meanings: meanings.length ? meanings : primary.meanings,
    readings,
    variantIds,
    jlpt,
    common: sorted.some((word) => word.common) || undefined,
    kanji: primary.kanji?.length
      ? primary.kanji
      : [...new Set(sorted.flatMap((word) => word.kanji ?? []))],
  }
}

/**
 * Collapse dictionary entries that share the same writing into one word
 * with multiple reading/meaning variants (e.g. 私 → watashi / watakushi).
 */
export function mergeWordsByWriting(words: KanjiWord[]): KanjiWord[] {
  const groups = new Map<string, KanjiWord[]>()
  for (const word of words) {
    const key = word.writing
    const list = groups.get(key)
    if (list) list.push(word)
    else groups.set(key, [word])
  }

  const result: KanjiWord[] = []
  const seen = new Set<string>()
  for (const word of words) {
    if (seen.has(word.writing)) continue
    seen.add(word.writing)
    const group = groups.get(word.writing) ?? [word]
    result.push(group.length === 1 ? mergeReadingGroup(group) : mergeReadingGroup(group))
  }
  return result
}

export function isWordSaved(word: KanjiWord, savedIds: Set<string> | Iterable<string>): boolean {
  const saved = savedIds instanceof Set ? savedIds : new Set(savedIds)
  return wordVariantIds(word).some((id) => saved.has(id))
}
