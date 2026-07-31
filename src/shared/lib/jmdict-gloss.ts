import type { GlossFootnote } from './types'

const FOOTNOTE_RULES: Array<{
  id: string
  test: (text: string) => boolean
  marker: string
  text: string
}> = [
  {
    id: 'usage',
    test: (text) => /\{[^}]*[～~][^}]*\}/.test(text),
    marker: '{～…}',
    text: 'типичная конструкция; ～ — это слово',
  },
  {
    id: 'optional',
    test: (text) => /\{[^}]*\[[^\]]+\][^}]*\}/.test(text),
    marker: '[…]',
    text: 'элемент в скобках необязателен',
  },
  {
    id: 'colon',
    test: (text) => /^\s*(?:\d+\))?\s*:/.test(text),
    marker: ':',
    text: 'уточнение значения',
  },
  {
    id: 'tilde-alone',
    test: (text) => /[～~]/.test(text) && !/\{[^}]*[～~][^}]*\}/.test(text),
    marker: '～',
    text: 'место этого слова',
  },
  {
    id: 'cf',
    test: (text) => /\(ср\.\)/.test(text),
    marker: '(ср.)',
    text: 'сравните с формой рядом',
  },
  {
    id: 'arch',
    test: (text) => /\(уст\.\)/.test(text),
    marker: '(уст.)',
    text: 'устаревшее',
  },
  {
    id: 'colloq',
    test: (text) => /\(прост\.\)|\(разг\.\)/.test(text),
    marker: '(прост./разг.)',
    text: 'разговорный стиль',
  },
]

export function collectGlossFootnotes(meanings: string | string[] | null | undefined): GlossFootnote[] {
  const texts = (Array.isArray(meanings) ? meanings : [meanings])
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))

  if (!texts.length) {
    return []
  }

  const joined = texts.join('\n')
  return FOOTNOTE_RULES.filter((rule) => rule.test(joined)).map(({ marker, text }) => ({
    marker,
    text,
  }))
}

const JP_CHAR = /[\u3040-\u30ff\u3400-\u9fff]/
const CYR_CHAR = /[а-яё]/i
/** Short dictionary labels like (прост.), (уст.), (см.) — not long usage notes. */
const LEADING_DICT_LABEL = /^\s*\([а-яёa-z.]{1,16}\)\s*/i
const MAX_QUIZ_GLOSS_LEN = 52

/**
 * Cleans a JMDict-RU gloss for multiple-choice labels.
 * Returns null when the gloss is unusable as a quiz option (cross-ref, Japanese-only,
 * usage example / construction rather than a lexical meaning, empty).
 */
export function cleanQuizGloss(raw: string): string | null {
  const original = String(raw ?? '').trim()
  if (!original) return null

  // Pure cross-references: "(см.) こちら", "(см.) みえる 4"
  if (/^\(см\.\)/i.test(original)) return null
  // Bare construction / example slots with no lexical gloss
  if (/^\s*\{[^}]+\}\s*$/.test(original)) return null
  // Example-like lines that are mostly Japanese after a label
  if (/^(пример|употребл|напр\.?)/i.test(original)) return null

  let text = original

  // Construction braces like {～へ}, {あのよう(～な)} — strip early so labels after them clean up
  text = text.replace(/\{[^}]*\}/g, ' ')

  // Sense numbers, ":", short labels — repeat after brace removal
  for (let i = 0; i < 6; i += 1) {
    const next = text
      .replace(/^\d+[).．、]\s*/, '')
      .replace(/^:\s*/, '')
      .replace(LEADING_DICT_LABEL, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (next === text) break
    text = next
  }

  if (!text) return null
  if (!CYR_CHAR.test(text)) return null

  // Leftover usage placeholders are not meanings
  if (/[～~]/.test(text)) return null

  const jpCount = (text.match(new RegExp(JP_CHAR.source, 'g')) || []).length
  const cyrCount = (text.match(new RegExp(CYR_CHAR.source, 'gi')) || []).length
  if (jpCount > 0 && jpCount >= cyrCount) return null

  // Sentence / example leftovers (punctuation + length)
  if (/[.!?。！？]/.test(text) && text.length > 18) return null

  // Prefer the headword when a long usage note makes the option obvious / noisy
  if (text.length > MAX_QUIZ_GLOSS_LEN) {
    const head = text.match(/^([^()]{1,28}?)\s*\(/)
    if (head?.[1]?.trim()) {
      text = head[1].trim()
    } else {
      const beforeSemi = text.split(/[;；]/)[0]?.trim()
      text =
        beforeSemi && beforeSemi.length <= MAX_QUIZ_GLOSS_LEN
          ? beforeSemi
          : `${text.slice(0, MAX_QUIZ_GLOSS_LEN - 1).replace(/\s+\S*$/, '').trim()}…`
    }
  }

  // Heavy "кто-л./что-л." frames without a short lexical head → skip for quiz
  if (/кто-л|что-л|кого-л|чему-л|кем-л|чем-л/i.test(text) && text.length > 36) {
    const head = text.split(/[,;，；]/)[0]?.trim()
    if (head && head.length <= 24 && CYR_CHAR.test(head) && !/кто-л|что-л/i.test(head)) {
      text = head
    } else {
      return null
    }
  }

  text = text.replace(/\s+/g, ' ').trim()
  if (!text || text.length < 1) return null
  return text
}

/** First gloss that survives cleaning, or null if none are quiz-worthy. */
export function pickQuizMeaning(meanings: string[] | null | undefined): string | null {
  if (!meanings?.length) return null
  for (const meaning of meanings) {
    const cleaned = cleanQuizGloss(meaning)
    if (cleaned) return cleaned
  }
  return null
}

/** Normalize for comparing choice options (dedupe near-duplicates). */
export function normalizeQuizGlossKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
}
