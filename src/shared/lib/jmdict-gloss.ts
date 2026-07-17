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
