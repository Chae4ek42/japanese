import type { KanjiWord } from '../../shared/lib/types'
import type { IpadicFeatures } from '../../shared/lib/kuromoji-tokenizer'
import { toHiragana, kanaToRomaji, isKanjiChar } from '../../shared/lib/kana'
import {
  getWordsByKana,
  getWordsByWriting,
  wordPopularityScore,
} from '../../data/words/bank'
import { describeMorphForm, posLabelRu } from './form-label'

const AUX_VERBS = new Set([
  'いる',
  'ある',
  'おく',
  'しまう',
  'くる',
  'いく',
  'くれる',
  'もらう',
  'みる',
  'ほしい',
  'やる',
  'いただく',
  'くださる',
  'なさる',
])

const VOICE_SUFFIXES = new Set(['れる', 'られる', 'せる', 'させる'])

/** Standalone polite/copula です・だ — keep separate (楽しいです → 楽しい + です). */
function isStandaloneCopula(token: IpadicFeatures): boolean {
  if (token.basic_form !== 'です' && token.basic_form !== 'だ') return false
  return token.conjugated_form === '基本形'
}

export type ReaderTokenKind = 'content' | 'particle' | 'aux' | 'punct' | 'other'

export interface ReaderToken {
  id: string
  surface: string
  lemma: string
  reading: string
  romaji: string
  pos: string
  posLabel: string
  kind: ReaderTokenKind
  /** Dictionary hits for the lemma (best first). */
  words: KanjiWord[]
  hasKanji: boolean
  /** e.g. «вежливое прошедшее (ました)» */
  formLabel: string
}

function pickBestWord(candidates: KanjiWord[]): KanjiWord[] {
  if (candidates.length <= 1) return candidates
  return [...candidates].sort((left, right) => {
    const score = wordPopularityScore(right) - wordPopularityScore(left)
    if (score) return score
    return left.writing.localeCompare(right.writing, 'ja')
  })
}

function lookupLemma(lemma: string, readingKatakana?: string): KanjiWord[] {
  const writingHits = getWordsByWriting(lemma)
  const readingHiragana = toHiragana(readingKatakana || '')

  if (writingHits.length) {
    if (readingHiragana) {
      const byReading = writingHits.filter(
        (word) => toHiragana(word.kana) === readingHiragana,
      )
      if (byReading.length) return pickBestWord(byReading)
    }
    return pickBestWord(writingHits)
  }

  if (readingHiragana) {
    const kanaHits = getWordsByKana(readingHiragana)
    if (kanaHits.length) return pickBestWord(kanaHits)
  }

  const lemmaKana = toHiragana(lemma)
  if (lemmaKana && lemmaKana !== lemma) {
    const kanaHits = getWordsByKana(lemmaKana)
    if (kanaHits.length) return pickBestWord(kanaHits)
  }
  return []
}

function tokenKind(token: IpadicFeatures): ReaderTokenKind {
  if (token.pos === '記号') return 'punct'
  if (token.pos === '助詞') return 'particle'
  if (token.pos === '助動詞') return 'aux'
  if (
    token.pos === '名詞' ||
    token.pos === '動詞' ||
    token.pos === '形容詞' ||
    token.pos === '形容動詞' ||
    token.pos === '副詞' ||
    token.pos === '連体詞'
  ) {
    return 'content'
  }
  return 'other'
}

function isContentStart(token: IpadicFeatures): boolean {
  return tokenKind(token) === 'content'
}

function canExtendInflection(
  start: IpadicFeatures,
  next: IpadicFeatures,
  after: IpadicFeatures | undefined,
  chain: IpadicFeatures[],
): boolean {
  if (next.pos === '助動詞') {
    // Keep plain です/だ clickable separately after adj/verb stems.
    if (isStandaloneCopula(next)) return false
    return true
  }

  if (
    next.pos === '動詞' &&
    next.pos_detail_1 === '接尾' &&
    VOICE_SUFFIXES.has(next.basic_form)
  ) {
    return true
  }

  const last = chain[chain.length - 1] ?? start
  if (
    next.pos === '助詞' &&
    (next.surface_form === 'て' || next.surface_form === 'で') &&
    after?.pos === '動詞' &&
    AUX_VERBS.has(after.basic_form)
  ) {
    return true
  }

  if (
    (last.pos === '助詞' && (last.surface_form === 'て' || last.surface_form === 'で')) ||
    (last.pos === '動詞' &&
      (String(last.conjugated_form ?? '').includes('連用') || last.surface_form.endsWith('っ')))
  ) {
    if (next.pos === '動詞' && AUX_VERBS.has(next.basic_form)) return true
  }

  return false
}

/** Merge verb/adj stems with auxiliaries (食べました, 降っていた). */
export function mergeMorphTokens(raw: IpadicFeatures[]): IpadicFeatures[][] {
  const groups: IpadicFeatures[][] = []
  let i = 0
  while (i < raw.length) {
    const start = raw[i]!
    if (!isContentStart(start) || (start.pos !== '動詞' && start.pos !== '形容詞')) {
      groups.push([start])
      i += 1
      continue
    }

    const chain = [start]
    let j = i + 1
    while (j < raw.length) {
      const next = raw[j]!
      const after = raw[j + 1]
      if (!canExtendInflection(start, next, after, chain)) break
      chain.push(next)
      j += 1
    }
    groups.push(chain)
    i = j
  }
  return groups
}

function groupToReaderToken(group: IpadicFeatures[], index: number): ReaderToken {
  const head = group[0]!
  const surface = group.map((token) => token.surface_form).join('')
  const lemma = head.basic_form && head.basic_form !== '*' ? head.basic_form : surface
  const readingKatakana = group
    .map((token) => token.reading || '')
    .filter((value) => value && value !== '*')
    .join('')
  const reading = toHiragana(readingKatakana)
  const kind = group.length > 1 ? 'content' : tokenKind(head)
  const words =
    kind === 'content' || kind === 'particle' || kind === 'aux'
      ? lookupLemma(lemma, readingKatakana || head.reading)
      : []

  return {
    id: `t-${index}-${head.word_position}`,
    surface,
    lemma,
    reading,
    romaji: kanaToRomaji(reading),
    pos: head.pos,
    posLabel: posLabelRu(head.pos),
    kind,
    words,
    hasKanji: Array.from(surface).some(isKanjiChar),
    formLabel: describeMorphForm(group),
  }
}

export function analyzeMorphGroups(raw: IpadicFeatures[]): ReaderToken[] {
  return mergeMorphTokens(raw).map((group, index) => groupToReaderToken(group, index))
}

export function contentReaderTokens(tokens: ReaderToken[]): ReaderToken[] {
  return tokens.filter((token) => token.kind === 'content' && token.words.length > 0)
}

const SENTENCE_END = /^[。．！？!?…]+$/

export interface ReaderSentence {
  id: string
  text: string
  tokens: ReaderToken[]
}

/** Split token stream into sentences on 。！？ etc. */
export function groupTokensIntoSentences(tokens: ReaderToken[]): ReaderSentence[] {
  const sentences: ReaderSentence[] = []
  let bucket: ReaderToken[] = []

  function flush() {
    if (!bucket.length) return
    const text = bucket.map((token) => token.surface).join('')
    sentences.push({
      id: `s-${sentences.length}-${bucket[0]!.id}`,
      text,
      tokens: bucket,
    })
    bucket = []
  }

  for (const token of tokens) {
    bucket.push(token)
    if (token.kind === 'punct' && SENTENCE_END.test(token.surface)) {
      flush()
    }
  }
  flush()
  return sentences
}
