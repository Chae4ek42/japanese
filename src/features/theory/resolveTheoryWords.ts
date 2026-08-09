import { getWordsByKana, getWordsByWriting } from '../../data/words/bank'
import type { KanjiWord } from '../../shared/lib/types'
import { wordVariantIds } from '../vocab/mergeHomographs'
import { THEORY_UNITS, type TheoryExample, type TheoryUnit } from './units'

const JP_TOKEN = /[\u3040-\u30ff\u3400-\u9fffー]+/g
const KANA_ONLY = /^[\u3040-\u30ffー]+$/

function pickBest(candidates: KanjiWord[]): KanjiWord | null {
  if (!candidates.length) return null
  return (
    candidates.find((word) => word.common && !/[\u4e00-\u9fff]/u.test(word.writing)) ||
    candidates.find((word) => !/[\u4e00-\u9fff]/u.test(word.writing)) ||
    candidates.find((word) => word.common) ||
    candidates[0] ||
    null
  )
}

function filterByRomaji(candidates: KanjiWord[], romaji: string | undefined): KanjiWord[] {
  if (!romaji || candidates.length <= 1) return candidates
  const romajiKey = romaji.toLowerCase().replace(/[\s_\-/]/g, '')
  const byRomaji = candidates.filter((word) =>
    word.romaji
      .toLowerCase()
      .replace(/[\s_\-/]/g, '')
      .includes(romajiKey.slice(0, 8)),
  )
  return byRomaji.length ? byRomaji : candidates
}

function exampleCacheKey(example: Pick<TheoryExample, 'writing' | 'kana' | 'romaji'>): string {
  return `${example.writing.trim()}\0${example.kana?.trim() ?? ''}\0${example.romaji?.trim() ?? ''}`
}

const resolveCache = new Map<string, string[]>()

/** Resolve a theory example (or bare writing) to bank word ids. Map lookup only — no bank scan. */
export function resolveTheoryWordIds(
  example: Pick<TheoryExample, 'writing' | 'kana' | 'romaji'>,
): string[] {
  const key = exampleCacheKey(example)
  const cached = resolveCache.get(key)
  if (cached) return cached

  const writing = example.writing.trim()
  if (!writing) {
    resolveCache.set(key, [])
    return []
  }

  let candidates = getWordsByWriting(writing)
  if (example.kana) {
    const kanaKeys = example.kana
      .split(/\s*\/\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
    const byKana = candidates.filter((word) =>
      kanaKeys.some((kana) => word.kana === kana || word.kana.includes(kana)),
    )
    if (byKana.length) candidates = byKana
  }

  // Colloquial kana-as-writing (あたし) lives under kanji writing in JMDict.
  if (!candidates.length) {
    const kanaKeys = [
      ...(example.kana
        ? example.kana
            .split(/\s*\/\s*/)
            .map((part) => part.trim())
            .filter(Boolean)
        : []),
      ...(KANA_ONLY.test(writing) ? [writing] : []),
    ]
    for (const kana of kanaKeys) {
      const byKana = getWordsByKana(kana)
      if (byKana.length) {
        candidates = byKana
        break
      }
    }
  }

  candidates = filterByRomaji(candidates, example.romaji)

  const word = pickBest(candidates)
  const ids = word ? wordVariantIds(word) : []
  resolveCache.set(key, ids)
  return ids
}

/** Japanese tokens from table cells like «こちら / こっち». */
export function extractJapaneseTokens(text: string): string[] {
  const matches = String(text ?? '').match(JP_TOKEN) ?? []
  return [...new Set(matches.filter((token) => token.length >= 2))]
}

function cellLooksJapanese(cell: string): boolean {
  const text = String(cell ?? '').trim()
  if (!text) return false
  const jpChars = (text.match(/[\u3040-\u30ff\u3400-\u9fffー]/g) ?? []).length
  return jpChars > 0 && jpChars >= text.replace(/[\s/／·・]/g, '').length * 0.5
}

export function exampleKey(example: Pick<TheoryExample, 'writing' | 'romaji'>): string {
  return `${example.writing}::${example.romaji}`
}

export function sectionKey(unitId: string, heading: string): string {
  return `${unitId}::${heading}`
}

/** All unique bank ids referenced by examples + table cells in a unit. */
export function collectUnitWordIds(unit: TheoryUnit): string[] {
  const ids = new Set<string>()
  for (const section of unit.sections) {
    for (const example of section.examples ?? []) {
      for (const id of resolveTheoryWordIds(example)) ids.add(id)
    }
    for (const row of section.table?.rows ?? []) {
      for (const cell of row) {
        if (!cellLooksJapanese(cell)) continue
        for (const token of extractJapaneseTokens(cell)) {
          for (const id of resolveTheoryWordIds({ writing: token, romaji: '' })) ids.add(id)
        }
      }
    }
  }
  return [...ids]
}

export type TheoryLookupIndex = {
  unitWordIds: Map<string, string[]>
  exampleWordIds: Map<string, string[]>
  sectionWordIds: Map<string, string[]>
}

function buildTheoryLookupIndex(): TheoryLookupIndex {
  const unitWordIds = new Map<string, string[]>()
  const exampleWordIds = new Map<string, string[]>()
  const sectionWordIds = new Map<string, string[]>()

  for (const unit of THEORY_UNITS) {
    unitWordIds.set(unit.id, collectUnitWordIds(unit))
    for (const section of unit.sections) {
      const sectionIds = [
        ...new Set((section.examples ?? []).flatMap((example) => resolveTheoryWordIds(example))),
      ]
      sectionWordIds.set(sectionKey(unit.id, section.heading), sectionIds)
      for (const example of section.examples ?? []) {
        exampleWordIds.set(exampleKey(example), resolveTheoryWordIds(example))
      }
    }
  }

  return { unitWordIds, exampleWordIds, sectionWordIds }
}

/** Precomputed once — switching lessons must stay O(render), not re-resolve the bank. */
export const THEORY_LOOKUP = buildTheoryLookupIndex()
