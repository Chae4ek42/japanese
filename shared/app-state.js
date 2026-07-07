import { ALL_CARD_IDS } from '../src/data/kana.js'
import {
  enrichCustomWord,
  sanitizeCustomWords,
  sanitizeDictionary,
} from '../src/data/custom-words.js'
import { DEFAULT_WORD_SELECTED_GROUPS, WORD_IDS, sanitizeWordGroups } from '../src/data/words.js'
import { DEFAULT_HYPERPARAMS, createEmptyHistory, createStatsRecord } from '../src/lib/trainer.js'

export const CURRENT_VERSION = 4
export const KNOWN_VERSIONS = [1, 2, 3, CURRENT_VERSION]
const BUILTIN_WORD_ID_SET = new Set(WORD_IDS)

function migrateWordsPreferences(rawPreferences, fallbackPreferences) {
  const studySource =
    rawPreferences?.studySource === 'dictionary' || rawPreferences?.onlyFavorites
      ? 'dictionary'
      : 'groups'

  return {
    ...fallbackPreferences,
    ...rawPreferences,
    studySource,
    selectedWordGroups: sanitizeWordGroups(rawPreferences?.selectedWordGroups),
  }
}

function buildWordStats(parsedStats, wordIds) {
  const fallbackStats = Object.fromEntries(wordIds.map((wordId) => [wordId, createStatsRecord()]))
  return Object.fromEntries(
    wordIds.map((wordId) => [
      wordId,
      {
        ...fallbackStats[wordId],
        ...parsedStats?.[wordId],
      },
    ]),
  )
}

export function createDefaultAppState() {
  return {
    version: CURRENT_VERSION,
    preferences: {
      scriptMode: 'hiragana',
      selectedGroups: ['vowels', 'k', 's', 't', 'n'],
      mode: 'adaptive',
      inputMode: 'instant',
      retryQueueEnabled: true,
      hyperparams: { ...DEFAULT_HYPERPARAMS },
    },
    stats: Object.fromEntries(ALL_CARD_IDS.map((cardId) => [cardId, createStatsRecord()])),
    history: createEmptyHistory(),
    words: {
      preferences: {
        answerMode: 'reading',
        inputMode: 'instant',
        displayKana: 'hiragana',
        mode: 'adaptive',
        studySource: 'groups',
        selectedWordGroups: [...DEFAULT_WORD_SELECTED_GROUPS],
      },
      dictionary: [],
      customWords: [],
      stats: Object.fromEntries(WORD_IDS.map((wordId) => [wordId, createStatsRecord()])),
    },
  }
}

export function normalizeAppState(parsed) {
  if (!parsed || !KNOWN_VERSIONS.includes(parsed.version)) {
    return null
  }

  const fallback = createDefaultAppState()
  const removedModes = ['mistakes', 'confusion']
  const migratedMode = removedModes.includes(parsed.preferences?.mode)
    ? 'adaptive'
    : parsed.preferences?.mode

  const legacyFavorites = Array.isArray(parsed.words?.favorites) ? parsed.words.favorites : []
  const rawDictionary = Array.isArray(parsed.words?.dictionary) ? parsed.words.dictionary : legacyFavorites
  const rawCustomWords = Array.isArray(parsed.words?.customWords) ? parsed.words.customWords : []
  const customWords = sanitizeCustomWords(rawCustomWords, rawDictionary)
  const dictionary = sanitizeDictionary(rawDictionary, customWords, BUILTIN_WORD_ID_SET)
  const allWordIds = [
    ...WORD_IDS,
    ...dictionary.filter((wordId) => !BUILTIN_WORD_ID_SET.has(wordId)),
  ]

  return {
    ...fallback,
    ...parsed,
    version: CURRENT_VERSION,
    preferences: {
      ...fallback.preferences,
      ...parsed.preferences,
      ...(migratedMode ? { mode: migratedMode } : {}),
      hyperparams: {
        ...fallback.preferences.hyperparams,
        ...parsed.preferences?.hyperparams,
      },
    },
    stats: Object.fromEntries(
      ALL_CARD_IDS.map((cardId) => [
        cardId,
        {
          ...fallback.stats[cardId],
          ...parsed.stats?.[cardId],
        },
      ]),
    ),
    history: {
      ...fallback.history,
      ...parsed.history,
    },
    words: {
      preferences: migrateWordsPreferences(parsed.words?.preferences, fallback.words.preferences),
      dictionary,
      customWords,
      stats: buildWordStats(parsed.words?.stats, allWordIds),
    },
  }
}

export function ensureWordStats(stats, wordId) {
  return stats[wordId] ?? createStatsRecord()
}

export function enrichStoredCustomWords(customWords) {
  return customWords.map((entry) => enrichCustomWord(entry)).filter(Boolean)
}
