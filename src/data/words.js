import rawData from './words.data.js'
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

export const WORD_IDS = WORDS.map((word) => word.id)

const wordById = Object.fromEntries(WORDS.map((word) => [word.id, word]))

export function getWordById(wordId) {
  return wordById[wordId] ?? null
}

const readingAnswersCache = new Map()

// Все допустимые написания чтения ромадзи (хэпбёрн + кунрэй).
export function getReadingAnswers(word) {
  if (!readingAnswersCache.has(word.id)) {
    readingAnswersCache.set(word.id, kanaToRomajiVariants(word.kana))
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
    for (const meaning of word.meanings) {
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
