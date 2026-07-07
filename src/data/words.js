import rawData from './words.data.js'
import { WORD_PACK_SIZE, WORD_THEME_CATEGORIES } from './word-groups.data.js'
import { enrichCustomWord, isCustomWordId } from './custom-words.js'
import { hiraganaToKatakana, kanaToRomajiVariants } from '../lib/romaji.js'
import { DEFAULT_HYPERPARAMS } from '../lib/trainer.js'

// Слова длиннее знаков каны: целевое время и очередь ошибок больше.
export const WORD_HYPERPARAMS = {
  ...DEFAULT_HYPERPARAMS,
  targetLatencyMs: 4500,
  queueSize: 5,
}

export const WORDS = rawData.words.map((word) => ({
  ...word,
  katakana: hiraganaToKatakana(word.kana),
}))

export const WORD_DATASET_LABEL = rawData.source?.includes('japanese-words.org')
  ? 'Japanese-words.org (Minna no Nihongo)'
  : 'JLPT N5'

export const WORD_IDS = WORDS.map((word) => word.id)

export { WORD_PACK_SIZE, WORD_THEME_CATEGORIES }

export const WORD_GROUPS = WORD_THEME_CATEGORIES.flatMap((category) =>
  category.groups.map((group) => ({
    ...group,
    categoryId: category.id,
    categoryLabel: category.label,
    shortLabel: group.label,
  })),
)

export const ALL_WORD_GROUP_IDS = WORD_GROUPS.map((group) => group.id)

export const DEFAULT_WORD_SELECTED_GROUPS = [...ALL_WORD_GROUP_IDS]

export const WORD_GROUP_PRESETS = [
  { id: 'all', label: 'Все', groups: ALL_WORD_GROUP_IDS },
  { id: 'dictionary', label: 'Словарь', dictionaryOnly: true },
  ...WORD_THEME_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    groups: category.groups.map((group) => group.id),
  })),
]

export function sanitizeWordGroups(selectedGroups) {
  const valid = new Set(ALL_WORD_GROUP_IDS)
  const sanitized = (selectedGroups ?? []).filter((groupId) => valid.has(groupId))
  return sanitized.length ? sanitized : DEFAULT_WORD_SELECTED_GROUPS
}

export function buildWordPool({
  studySource = 'groups',
  selectedGroups = DEFAULT_WORD_SELECTED_GROUPS,
  dictionary = [],
  customWords = [],
} = {}) {
  if (studySource === 'dictionary') {
    return dictionary
      .map((wordId) => resolveWord(wordId, customWords))
      .filter(Boolean)
  }

  const selectedIds = new Set()
  for (const group of WORD_GROUPS) {
    if (selectedGroups.includes(group.id)) {
      for (const wordId of group.wordIds) {
        selectedIds.add(wordId)
      }
    }
  }

  return WORDS.filter((word) => selectedIds.has(word.id))
}

const wordById = Object.fromEntries(WORDS.map((word) => [word.id, word]))
const customWordById = (customWords = []) =>
  Object.fromEntries(
    customWords
      .map((entry) => enrichCustomWord(entry))
      .filter(Boolean)
      .map((word) => [word.id, word]),
  )

export function resolveWord(wordId, customWords = []) {
  return wordById[wordId] ?? customWordById(customWords)[wordId] ?? null
}

export function getWordById(wordId, customWords = []) {
  return resolveWord(wordId, customWords)
}

export function getDictionaryWords(dictionary = [], customWords = []) {
  return dictionary.map((wordId) => resolveWord(wordId, customWords)).filter(Boolean)
}

const readingAnswersCache = new Map()

// Все допустимые написания чтения ромадзи (хэпбёрн + кунрэй).
export function getReadingAnswers(word) {
  if (!readingAnswersCache.has(word.id)) {
    const answers = new Set()
    if (word.kana && /[\u3040-\u309f\u30a0-\u30ff]/.test(word.kana)) {
      try {
        for (const variant of kanaToRomajiVariants(word.kana)) {
          answers.add(variant)
        }
      } catch {
        // Пользовательские слова могут содержать нестандартную кану.
      }
    }
    if (word.romaji) {
      answers.add(String(word.romaji).toLowerCase().replace(/\s+/g, ''))
    }
    readingAnswersCache.set(word.id, [...answers])
  }
  return readingAnswersCache.get(word.id)
}

export function normalizeRu(text) {
  return text
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,!?;:"'()[\]«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const translationAnswersCache = new Map()

// Принимаем каждое значение целиком, а также вариант без скобочных уточнений:
// «играть (на инструменте)» -> «играть на инструменте» и «играть».
export function getTranslationAnswers(word) {
  if (!translationAnswersCache.has(word.id)) {
    const answers = new Set()
    for (const meaning of word.meanings ?? []) {
      answers.add(normalizeRu(meaning))
      const withoutParens = meaning.replace(/\([^)]*\)/g, ' ')
      answers.add(normalizeRu(withoutParens))
    }
    answers.delete('')
    translationAnswersCache.set(word.id, [...answers])
  }
  return translationAnswersCache.get(word.id)
}

export function checkTranslation(word, input) {
  return getTranslationAnswers(word).includes(normalizeRu(input))
}
