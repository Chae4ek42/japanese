import { getKanjiInfo } from '../../data/words/bank'
import type {
  ColoredReadingSegment,
  KanjiInfo,
  ReadingSegment,
  ReadingSegmentRole,
} from './types'
import {
  isKanaChar,
  isKanjiChar,
  kanaToRomaji,
  toHiragana,
  withRendakuVariants,
} from './kana'

export const READING_COLOR_COUNT = 6

interface AlignSegment extends ReadingSegment {
  source?: string
}

interface SolveResult {
  segments: AlignSegment[]
  score: number
}

function readingStems(info: KanjiInfo | null): string[] {
  if (!info) {
    return []
  }
  const stems = new Set<string>()
  for (const reading of [...(info.onyomi ?? []), ...(info.kunyomi ?? [])]) {
    const normalized = toHiragana(String(reading).replace(/^-/, '').replace(/-$/, ''))
    if (!normalized) {
      continue
    }
    const [stem, okuri] = normalized.split('.')
    if (stem) {
      stems.add(stem)
    }
    if (stem && okuri) {
      stems.add(`${stem}${okuri}`)
    }
    if (!normalized.includes('.')) {
      stems.add(normalized)
    }
  }
  return [...stems]
}

function candidateReadings(character: string): string[] {
  const stems = readingStems(getKanjiInfo(character))
  const expanded = new Set<string>()
  for (const stem of stems) {
    for (const variant of withRendakuVariants(stem)) {
      expanded.add(variant)
    }
  }
  return [...expanded].sort((a, b) => b.length - a.length)
}

function roleForChars(chars: string, focusKanji: string): ReadingSegmentRole {
  if (!focusKanji) {
    return chars.length > 1 ? 'shared' : 'other'
  }
  if (chars === focusKanji) {
    return 'focus'
  }
  if (chars.includes(focusKanji)) {
    return 'shared'
  }
  return 'other'
}

function pickBest(options: Array<SolveResult | null>): SolveResult | null {
  let best: SolveResult | null = null
  for (const option of options) {
    if (!option) {
      continue
    }
    if (!best || option.score > best.score) {
      best = option
    }
  }
  return best
}

export function alignReading(
  writing: string,
  kana: string,
  focusKanji: string,
): ReadingSegment[] | null {
  const chars = Array.from(String(writing ?? ''))
  const reading = toHiragana(String(kana ?? ''))
  if (!chars.length || !reading) {
    return null
  }

  const cache = new Map<string, SolveResult | null>()

  function solve(wi: number, ri: number): SolveResult | null {
    const key = `${wi}:${ri}`
    if (cache.has(key)) {
      return cache.get(key) ?? null
    }

    if (wi === chars.length && ri === reading.length) {
      const empty: SolveResult = { segments: [], score: 0 }
      cache.set(key, empty)
      return empty
    }
    if (wi >= chars.length || ri > reading.length) {
      cache.set(key, null)
      return null
    }

    const ch = chars[wi]
    const options: Array<SolveResult | null> = []

    if (isKanaChar(ch)) {
      const h = toHiragana(ch)
      if (reading[ri] === h) {
        const rest = solve(wi + 1, ri + 1)
        if (rest) {
          options.push({
            segments: [{ chars: ch, kana: h, role: 'okuri', source: 'okuri' }, ...rest.segments],
            score: 8 + rest.score,
          })
        }
      }
      const best = pickBest(options)
      cache.set(key, best)
      return best
    }

    if (!isKanjiChar(ch)) {
      cache.set(key, null)
      return null
    }

    const known = candidateReadings(ch)
    let knownHit = false

    for (const candidate of known) {
      if (!reading.startsWith(candidate, ri)) {
        continue
      }
      const rest = solve(wi + 1, ri + candidate.length)
      if (rest) {
        knownHit = true
        options.push({
          segments: [
            {
              chars: ch,
              kana: candidate,
              role: roleForChars(ch, focusKanji),
              source: 'known',
            },
            ...rest.segments,
          ],
          score: 10 + rest.score,
        })
      }
    }

    let end = wi + 1
    while (end < chars.length && isKanjiChar(chars[end])) {
      end += 1
    }
    const runLen = end - wi

    // Multi-kanji run: allow a shared slice for jukujikun / ateji / irregular compounds.
    // Score beats known+guess hybrids (≈12) but loses to clean per-kanji known matches (10 each).
    if (runLen > 1) {
      const groupChars = chars.slice(wi, end).join('')
      for (let take = 1; take <= reading.length - ri; take += 1) {
        const slice = reading.slice(ri, ri + take)
        const rest = solve(end, ri + take)
        if (rest) {
          options.push({
            segments: [
              {
                chars: groupChars,
                kana: slice,
                role: roleForChars(groupChars, focusKanji),
                source: 'group',
              },
              ...rest.segments,
            ],
            score: 14 + rest.score,
          })
        }
      }
    } else if (!knownHit) {
      // Isolated kanji with non-dictionary reading (before okurigana / end).
      for (let take = 1; take <= reading.length - ri; take += 1) {
        const slice = reading.slice(ri, ri + take)
        const rest = solve(wi + 1, ri + take)
        if (rest) {
          options.push({
            segments: [
              {
                chars: ch,
                kana: slice,
                role: roleForChars(ch, focusKanji),
                source: 'guess',
              },
              ...rest.segments,
            ],
            score: 2 + rest.score,
          })
        }
      }
    }

    const best = pickBest(options)
    cache.set(key, best)
    return best
  }

  const result = solve(0, 0)
  return result?.segments ?? null
}

export function mergeReadingSegments(segments: ReadingSegment[] | null | undefined): ReadingSegment[] {
  if (!segments?.length) {
    return []
  }
  const merged: ReadingSegment[] = []
  for (const segment of segments) {
    const role: ReadingSegmentRole = segment.role === 'okuri' ? 'other' : segment.role
    const prev = merged[merged.length - 1]
    if (prev && prev.role === role) {
      prev.kana += segment.kana
      prev.chars += segment.chars
    } else {
      merged.push({
        chars: segment.chars,
        kana: segment.kana,
        role,
        source: segment.source,
        romaji: '',
      })
    }
  }
  for (const item of merged) {
    item.romaji = kanaToRomaji(item.kana)
  }
  return merged
}

export function getHighlightedReading(
  writing: string,
  kana: string,
  focusKanji: string,
): ReadingSegment[] | null {
  const aligned = alignReading(writing, kana, focusKanji)
  if (!aligned) {
    return null
  }
  return mergeReadingSegments(aligned)
}

/**
 * Align writing↔kana without merging consecutive kanji, and assign palette slots.
 * Shared/group segments (jukujikun, ateji) keep one color for the whole group.
 */
export function getColoredReading(
  writing: string,
  kana: string,
  focusKanji = '',
): ColoredReadingSegment[] | null {
  const aligned = alignReading(writing, kana, focusKanji)
  if (!aligned?.length) {
    return null
  }

  const result: ColoredReadingSegment[] = []
  let nextColor = 0

  for (const segment of aligned) {
    const isOkuri = segment.role === 'okuri' || segment.source === 'okuri'
    if (isOkuri) {
      const prev = result[result.length - 1]
      if (prev && prev.colorIndex < 0) {
        prev.chars += segment.chars
        prev.kana += segment.kana
        prev.romaji = kanaToRomaji(prev.kana)
        continue
      }
      result.push({
        chars: segment.chars,
        kana: segment.kana,
        romaji: kanaToRomaji(segment.kana),
        colorIndex: -1,
        role: 'okuri',
        source: 'okuri',
      })
      continue
    }

    result.push({
      chars: segment.chars,
      kana: segment.kana,
      romaji: kanaToRomaji(segment.kana),
      colorIndex: nextColor++ % READING_COLOR_COUNT,
      role: segment.role,
      source: segment.source,
    })
  }

  return result
}

/** Map each writing character to a palette slot (for kanji chips). */
export function mapWritingColorIndexes(
  writing: string,
  segments: ColoredReadingSegment[] | null | undefined,
): number[] {
  const chars = Array.from(String(writing ?? ''))
  if (!chars.length) {
    return []
  }
  if (!segments?.length) {
    return chars.map((ch) => (isKanjiChar(ch) ? 0 : -1))
  }

  const indexes: number[] = []
  let offset = 0
  for (const segment of segments) {
    const part = Array.from(segment.chars)
    for (let i = 0; i < part.length; i += 1) {
      indexes[offset + i] = segment.colorIndex
    }
    offset += part.length
  }
  while (indexes.length < chars.length) {
    indexes.push(isKanjiChar(chars[indexes.length]) ? 0 : -1)
  }
  return indexes.slice(0, chars.length)
}

export function readingSegClassName(
  colorIndex: number,
  role?: ReadingSegmentRole,
  focusKanji?: string,
  chars?: string,
): string {
  const classes = ['reading-seg']
  if (colorIndex >= 0) {
    classes.push(`is-c${colorIndex % READING_COLOR_COUNT}`)
  } else {
    classes.push('is-okuri')
  }
  if (role === 'shared' || (chars && focusKanji && chars.length > 1 && chars.includes(focusKanji))) {
    classes.push('is-shared-reading')
  }
  if (focusKanji && chars && (chars === focusKanji || (chars.length === 1 && chars === focusKanji))) {
    classes.push('is-focus')
  }
  return classes.join(' ')
}
