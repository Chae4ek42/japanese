import { ALL_CARD_IDS } from '../../data/kana'
import { STARTER_GRAMMAR_IDS } from '../../data/grammar'
import type { AppState } from '../lib/types'
import {
  DEFAULT_HYPERPARAMS,
  createEmptyHistory,
  createStatsRecord,
} from '../lib/trainer'
import { sanitizeHistory, sanitizeKanaPreferences, sanitizeKanaStats } from './slices/kana'
import { sanitizeNumbersPreferences, sanitizeNumbersStats } from './slices/numbers'
import { sanitizeKanjiState } from './slices/kanji'
import { DEFAULT_VOCAB_PREFERENCES, sanitizeVocabState } from './slices/vocab'
import { DEFAULT_CONTEXT_PREFERENCES, sanitizeContextState } from './slices/context'

export const CURRENT_VERSION = 20 as const
export const KNOWN_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, CURRENT_VERSION]

export { DEFAULT_VOCAB_PREFERENCES, DEFAULT_CONTEXT_PREFERENCES }

export function createDefaultAppState(): AppState {
  return {
    version: CURRENT_VERSION,
    kana: {
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
    },
    numbers: {
      preferences: {
        mode: 'plain',
        rangeId: '99',
        pickMode: 'adaptive',
      },
      stats: {},
    },
    kanji: {
      learned: [],
      preferences: {
        complexityFilter: true,
        hiddenWordsByKanji: {},
        wordJlptLevels: [],
      },
    },
    vocab: {
      myWords: [],
      customWords: {},
      hiddenWordIds: [],
      learnedWordIds: [],
      preferences: { ...DEFAULT_VOCAB_PREFERENCES },
      stats: {},
    },
    context: {
      knownWordIds: [],
      knownGrammarIds: [...STARTER_GRAMMAR_IDS],
      preferences: { ...DEFAULT_CONTEXT_PREFERENCES },
      generatedCache: {},
      session: null,
      trainingLog: [],
    },
  }
}

export function normalizeAppState(parsed: unknown): AppState | null {
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const source = parsed as Record<string, unknown>
  if (!KNOWN_VERSIONS.includes(source.version as number)) {
    return null
  }

  const fallback = createDefaultAppState()
  const fromVersion = typeof source.version === 'number' ? source.version : 0
  const legacyKana = source.kana && typeof source.kana === 'object' ? (source.kana as Record<string, unknown>) : null
  const kanaPreferences = sanitizeKanaPreferences(
    legacyKana?.preferences ?? source.preferences,
    fallback.kana.preferences,
  )

  const vocab = sanitizeVocabState(source.vocab, fallback.vocab)
  // v20: 0 used to mean “no limit”; now 0 = zero new words and -1 = no limit.
  if (fromVersion < 20 && vocab.preferences.newWordLimit === 0) {
    vocab.preferences = { ...vocab.preferences, newWordLimit: -1 }
  }

  return {
    version: CURRENT_VERSION,
    kana: {
      preferences: kanaPreferences,
      stats: sanitizeKanaStats(legacyKana?.stats ?? source.stats, fallback.kana.stats),
      history: sanitizeHistory(legacyKana?.history ?? source.history, fallback.kana.history),
    },
    numbers: {
      preferences: sanitizeNumbersPreferences(
        source.numbers && typeof source.numbers === 'object'
          ? (source.numbers as Record<string, unknown>).preferences
          : undefined,
        fallback.numbers.preferences,
      ),
      stats: sanitizeNumbersStats(
        source.numbers && typeof source.numbers === 'object'
          ? (source.numbers as Record<string, unknown>).stats
          : undefined,
      ),
    },
    kanji: sanitizeKanjiState(source.kanji, fallback.kanji),
    vocab,
    context: sanitizeContextState(source.context, fallback.context),
  }
}
