import type { VocabCard, VocabPromptKind } from '../../shared/lib/types'
import { normalizeQuizGlossKey } from '../../shared/lib/jmdict-gloss'

export interface VocabMixedPrompt {
  kind: VocabPromptKind
  /** Short badge / instruction. */
  badge: string
  note: string
  /** What the learner sees as the question stem. */
  stemMode: 'writing' | 'text'
  stemText: string
  correctAnswer: string
  options: string[]
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const list = [...items]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function pickDistractors(
  correct: string,
  candidates: string[],
  {
    count,
    keyFn,
    rng,
  }: {
    count: number
    keyFn: (value: string) => string
    rng: () => number
  },
): string[] {
  const correctKey = keyFn(correct)
  const seen = new Set<string>(correctKey ? [correctKey] : [])
  const bag = shuffle(
    candidates.filter((item) => {
      const key = keyFn(item)
      if (!item || !key || seen.has(key)) return false
      seen.add(key)
      return true
    }),
    rng,
  )
  return bag.slice(0, Math.max(0, count - 1))
}

function buildOptions(correct: string, distractors: string[], rng: () => number): string[] {
  return shuffle([correct, ...distractors], rng)
}

function availableKinds(card: VocabCard, pool: VocabCard[]): VocabPromptKind[] {
  const kinds: VocabPromptKind[] = []
  const meaningOk = Boolean(card.meaning?.trim())
  const readingOk = Boolean(card.kana?.trim() || card.romaji?.trim())
  const writingOk = Boolean(card.writing?.trim())

  const otherMeanings = pool.filter((item) => item.id !== card.id && item.meaning?.trim()).length
  const otherReadings = pool.filter(
    (item) => item.id !== card.id && (item.kana?.trim() || item.romaji?.trim()),
  ).length
  const otherWritings = pool.filter((item) => item.id !== card.id && item.writing?.trim()).length

  if (meaningOk && writingOk && otherMeanings >= 1) kinds.push('meaning')
  if (readingOk && writingOk && otherReadings >= 1) kinds.push('reading')
  if (writingOk && meaningOk && otherWritings >= 1) kinds.push('writing')
  return kinds
}

/**
 * Build a renshuu-style mixed MCQ prompt (meaning / reading / writing).
 * Falls back through kinds until enough distractors exist.
 */
export function buildMixedPrompt(
  card: VocabCard,
  pool: VocabCard[],
  { count = 6, rng = Math.random }: { count?: number; rng?: () => number } = {},
): VocabMixedPrompt | null {
  const kinds = shuffle(availableKinds(card, pool), rng)
  if (!kinds.length) return null

  for (const kind of kinds) {
    if (kind === 'meaning') {
      const correct = card.meaning
      const distractors = pickDistractors(
        correct,
        pool.filter((item) => item.id !== card.id).map((item) => item.meaning),
        { count, keyFn: normalizeQuizGlossKey, rng },
      )
      if (!distractors.length) continue
      return {
        kind,
        badge: 'Значение',
        note: 'Выберите верный перевод',
        stemMode: 'writing',
        stemText: card.writing,
        correctAnswer: correct,
        options: buildOptions(correct, distractors, rng),
      }
    }

    if (kind === 'reading') {
      const correct = (card.kana || card.romaji).trim()
      const distractors = pickDistractors(
        correct,
        pool
          .filter((item) => item.id !== card.id)
          .map((item) => (item.kana || item.romaji).trim())
          .filter(Boolean),
        {
          count,
          keyFn: (value) => value.replace(/\s+/g, ''),
          rng,
        },
      )
      if (!distractors.length) continue
      return {
        kind,
        badge: 'Чтение',
        note: 'Выберите верное чтение',
        stemMode: 'writing',
        stemText: card.writing,
        correctAnswer: correct,
        options: buildOptions(correct, distractors, rng),
      }
    }

    // writing: show meaning (preferred) or kana, pick the kanji/writing
    const stem = card.meaning?.trim() || card.kana?.trim() || card.romaji
    const correct = card.writing
    const distractors = pickDistractors(
      correct,
      pool
        .filter((item) => item.id !== card.id)
        .map((item) => item.writing)
        .filter(Boolean),
      {
        count,
        keyFn: (value) => value,
        rng,
      },
    )
    if (!distractors.length) continue
    return {
      kind: 'writing',
      badge: 'Написание',
      note: card.meaning?.trim() ? 'Выберите написание по значению' : 'Выберите написание по чтению',
      stemMode: 'text',
      stemText: stem,
      correctAnswer: correct,
      options: buildOptions(correct, distractors, rng),
    }
  }

  return null
}

/** Classic "pick the meaning" prompt reused by choice mode. */
export function buildMeaningPrompt(
  card: VocabCard,
  pool: VocabCard[],
  { count = 6, rng = Math.random }: { count?: number; rng?: () => number } = {},
): VocabMixedPrompt | null {
  if (!card.meaning?.trim()) return null
  const distractors = pickDistractors(
    card.meaning,
    pool.filter((item) => item.id !== card.id).map((item) => item.meaning),
    { count, keyFn: normalizeQuizGlossKey, rng },
  )
  if (!distractors.length) return null
  return {
    kind: 'meaning',
    badge: 'Перевод',
    note: 'Выберите верный перевод',
    stemMode: 'writing',
    stemText: card.writing,
    correctAnswer: card.meaning,
    options: buildOptions(card.meaning, distractors, rng),
  }
}
