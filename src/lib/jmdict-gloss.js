/**
 * Сноски к пометкам JMDict в русских глоссах.
 * Показываем только те, что реально встретились в тексте.
 */

const FOOTNOTE_RULES = [
  {
    id: 'usage',
    test: (text) => /\{[^}]*[～~][^}]*\}/.test(text),
    marker: '{～…}',
    text: 'типичная конструкция: ～ — это слово',
  },
  {
    id: 'optional',
    test: (text) => /\{[^}]*\[[^\]]+\][^}]*\}/.test(text),
    marker: '[…]',
    text: 'элемент в квадратных скобках необязателен',
  },
  {
    id: 'colon',
    test: (text) => /^\s*(?:\d+\))?\s*:/.test(text),
    marker: ':',
    text: 'уточнение или продолжение значения',
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
    text: 'сравните с указанной формой',
  },
  {
    id: 'arch',
    test: (text) => /\(уст\.\)/.test(text),
    marker: '(уст.)',
    text: 'устаревшее употребление',
  },
  {
    id: 'colloq',
    test: (text) => /\(прост\.\)|\(разг\.\)/.test(text),
    marker: '(прост./разг.)',
    text: 'просторечие или разговорный стиль',
  },
]

export function collectGlossFootnotes(meanings) {
  const texts = (Array.isArray(meanings) ? meanings : [meanings])
    .filter((item) => typeof item === 'string' && item.trim())

  if (!texts.length) {
    return []
  }

  const joined = texts.join('\n')
  return FOOTNOTE_RULES.filter((rule) => rule.test(joined)).map(({ marker, text }) => ({
    marker,
    text,
  }))
}
