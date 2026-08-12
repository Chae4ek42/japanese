import type { KanjiWord } from './types'
import {
  getWordsByKana,
  getWordsByWriting,
  KANJI_WORDS,
  wordPopularityScore,
} from '../../data/words/bank'
import { CORE_PARTICLES } from '../../data/particles'

const PUNCT_RE = /[。、！？!?…・「」『』（）()\[\]【】\s]/
const MAX_SURFACE_LEN = (() => {
  let max = 1
  for (const word of KANJI_WORDS) {
    max = Math.max(max, Array.from(word.writing).length, Array.from(word.kana ?? '').length)
  }
  return Math.min(max, 12)
})()

export interface JpToken {
  surface: string
  /** Best dictionary hit, if any. */
  word: KanjiWord | null
  /** Skipped punctuation / whitespace. */
  isPunct: boolean
  /** Matched one of the drill particles (は/が/…). */
  isParticle: boolean
}

function pickBestWord(candidates: KanjiWord[]): KanjiWord {
  return [...candidates].sort((left, right) => {
    const score = wordPopularityScore(right) - wordPopularityScore(left)
    if (score) return score
    return left.writing.localeCompare(right.writing, 'ja')
  })[0]!
}

/** Polite / te-form endings → candidate dictionary writings. */
export function deinflectJapanese(surface: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  function add(value: string) {
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push(value)
  }

  const strips: Array<[RegExp, (stem: string) => string[]]> = [
    [
      /ましたか$/,
      (stem) => masuStemLemmas(stem),
    ],
    [
      /ました$/,
      (stem) => masuStemLemmas(stem),
    ],
    [
      /ませんでした$/,
      (stem) => masuStemLemmas(stem),
    ],
    [
      /ません$/,
      (stem) => masuStemLemmas(stem),
    ],
    [
      /ます$/,
      (stem) => masuStemLemmas(stem),
    ],
    [
      /ましょう$/,
      (stem) => masuStemLemmas(stem),
    ],
    [
      /てください$/,
      (stem) => teStemLemmas(stem),
    ],
    [
      /でください$/,
      (stem) => teStemLemmas(stem, true),
    ],
    [
      /ています$/,
      (stem) => teStemLemmas(stem),
    ],
    [
      /でいます$/,
      (stem) => teStemLemmas(stem, true),
    ],
    [
      /ていますか$/,
      (stem) => teStemLemmas(stem),
    ],
    [/ください$/, (stem) => (stem ? [stem] : ['ください'])],
  ]

  for (const [pattern, expand] of strips) {
    if (!pattern.test(surface)) continue
    const stem = surface.replace(pattern, '')
    for (const lemma of expand(stem)) add(lemma)
  }

  return out
}

function masuStemLemmas(stem: string): string[] {
  if (!stem) return []
  if (stem === 'し') return ['する']

  const lemmas = [`${stem}る`, `${stem}う`]
  const last = stem.at(-1)
  const head = stem.slice(0, -1)
  const godan: Record<string, string> = {
    き: 'く',
    ぎ: 'ぐ',
    し: 'す',
    ち: 'つ',
    に: 'ぬ',
    び: 'ぶ',
    み: 'む',
    り: 'る',
    い: 'う',
  }
  if (last && godan[last]) {
    lemmas.push(`${head}${godan[last]}`)
  }
  if (last === 'し' && head) {
    lemmas.push(`${head}する`)
  }
  return lemmas
}

function teStemLemmas(stem: string, voiced = false): string[] {
  if (!stem) return []
  const lemmas = [`${stem}る`]
  const last = stem.at(-1)
  const head = stem.slice(0, -1)
  if (!voiced) {
    if (stem.endsWith('っ')) {
      lemmas.push(`${stem.slice(0, -1)}う`, `${stem.slice(0, -1)}つ`, `${stem.slice(0, -1)}る`)
    } else if (last === 'い') {
      lemmas.push(`${head}く`)
    } else if (last === 'し') {
      lemmas.push(`${head}す`, `${head}する`)
    }
  } else {
    if (last === 'い') lemmas.push(`${head}ぐ`)
    if (last === 'ん') {
      lemmas.push(`${head}む`, `${head}ぶ`, `${head}ぬ`)
    }
  }
  return lemmas
}

function lookupSurface(surface: string, remainder = ''): KanjiWord | null {
  const byWriting = getWordsByWriting(surface)
  if (byWriting.length) return pickBestWord(byWriting)

  for (const lemma of deinflectJapanese(surface)) {
    const hits = getWordsByWriting(lemma)
    if (hits.length) return pickBestWord(hits)
    const kanaHits = getWordsByKana(lemma)
    if (kanaHits.length) return pickBestWord(kanaHits)
  }

  if (/^(ます|ました|ません|ましょう|て|で|た|だ|ない|ぬ)/.test(remainder)) {
    return null
  }

  const byKana = getWordsByKana(surface)
  if (byKana.length) return pickBestWord(byKana)
  return null
}

function isCoreParticleSurface(surface: string): boolean {
  return (CORE_PARTICLES as readonly string[]).includes(surface)
}

const FUNCTION_WRITINGS = new Set([
  'です',
  'だ',
  'である',
  'ます',
  'ください',
  '下さい',
  'いる',
  '居る',
  'ある',
  '有る',
])

/**
 * Greedy longest-match tokenize against the word bank (with light deinflection).
 */
export function tokenizeJapanese(text: string): JpToken[] {
  const chars = Array.from(String(text ?? ''))
  const tokens: JpToken[] = []
  let i = 0

  while (i < chars.length) {
    const ch = chars[i]!
    if (PUNCT_RE.test(ch)) {
      tokens.push({ surface: ch, word: null, isPunct: true, isParticle: false })
      i += 1
      continue
    }

    let matched: JpToken | null = null
    const max = Math.min(MAX_SURFACE_LEN, chars.length - i)
    for (let len = max; len >= 1; len -= 1) {
      const surface = chars.slice(i, i + len).join('')
      const remainder = chars.slice(i + len).join('')
      if (isCoreParticleSurface(surface)) {
        matched = {
          surface,
          word: lookupSurface(surface, remainder),
          isPunct: false,
          isParticle: true,
        }
        break
      }
      const word = lookupSurface(surface, remainder)
      if (word) {
        matched = { surface, word, isPunct: false, isParticle: false }
        break
      }
    }

    if (matched) {
      tokens.push(matched)
      i += Array.from(matched.surface).length
      continue
    }

    tokens.push({ surface: ch, word: null, isPunct: false, isParticle: false })
    i += 1
  }

  return tokens
}

/** Content words that matter for «Мои слова» / mine-only filtering. */
export function contentTokens(tokens: JpToken[]): JpToken[] {
  return tokens.filter((token) => {
    if (!token.word || token.isPunct || token.isParticle) return false
    if (FUNCTION_WRITINGS.has(token.word.writing) || FUNCTION_WRITINGS.has(token.surface)) {
      return false
    }
    return true
  })
}

export function tokenWordIds(token: JpToken): string[] {
  const word = token.word
  if (!word) return []
  if (word.variantIds?.length) return word.variantIds
  return word.id ? [word.id] : []
}

export function isTokenInMyWords(token: JpToken, myWordIds: Set<string>): boolean {
  return tokenWordIds(token).some((id) => myWordIds.has(id))
}

export function sentenceKnownByMine(text: string, myWordIds: Set<string>): boolean {
  const content = contentTokens(tokenizeJapanese(text))
  if (!content.length) return true
  return content.every((token) => isTokenInMyWords(token, myWordIds))
}
