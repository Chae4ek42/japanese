import type { VocabCard } from '../types'
import { levenshtein } from './grade'

function kanjiChars(writing: string): Set<string> {
  const out = new Set<string>()
  for (const ch of writing) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x4e00 && code <= 0x9fff) out.add(ch)
  }
  return out
}

function meaningTokens(card: VocabCard): Set<string> {
  const text = [card.meaning, ...(card.meanings ?? [])].join(' ').toLowerCase()
  return new Set(
    text
      .split(/[^a-zа-яё0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const item of a) if (b.has(item)) inter += 1
  return inter / (a.size + b.size - inter)
}

/** Similarity in 0…1 for contrastive distractors / pairing. */
export function vocabSimilarity(a: VocabCard, b: VocabCard): number {
  if (a.id === b.id) return 1
  const kanjiA = kanjiChars(a.writing)
  const kanjiB = kanjiChars(b.writing)
  let sharedKanji = 0
  for (const ch of kanjiA) if (kanjiB.has(ch)) sharedKanji += 1
  const kanjiScore =
    kanjiA.size && kanjiB.size ? sharedKanji / Math.max(kanjiA.size, kanjiB.size) : 0

  const kanaA = (a.kana || '').replace(/\s+/g, '')
  const kanaB = (b.kana || '').replace(/\s+/g, '')
  const maxLen = Math.max(kanaA.length, kanaB.length, 1)
  const kanaScore = 1 - Math.min(1, levenshtein(kanaA, kanaB) / maxLen)

  const meaningScore = jaccard(meaningTokens(a), meaningTokens(b))

  return clamp01(0.45 * kanjiScore + 0.35 * kanaScore + 0.2 * meaningScore)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Rank pool by similarity to target; excludes the target itself. */
export function rankSimilarVocab(
  target: VocabCard,
  pool: VocabCard[],
  limit = 12,
): Array<{ card: VocabCard; score: number }> {
  return pool
    .filter((card) => card.id !== target.id)
    .map((card) => ({ card, score: vocabSimilarity(target, card) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function mostSimilarIds(target: VocabCard, pool: VocabCard[], limit = 3): string[] {
  return rankSimilarVocab(target, pool, limit)
    .filter((entry) => entry.score >= 0.22)
    .map((entry) => entry.card.id)
}
