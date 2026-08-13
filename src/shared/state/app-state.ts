import { ALL_CARD_IDS } from '../../data/kana'
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
import { sanitizeCardTrainerLiveSession } from './slices/live-session'
import { createDefaultAnalyticsState, sanitizeAnalyticsState } from './slices/analytics'
import {
  DEFAULT_PARTICLES_PREFERENCES,
  sanitizeParticlesPreferences,
  sanitizeParticlesStats,
} from './slices/particles'
import { DEFAULT_READER_STATE, sanitizeReaderState } from './slices/reader'

import { MAIN_TRAINING_SET_ID, createMainTrainingSet } from '../lib/trainingSets'

export const CURRENT_VERSION = 30 as const
export const KNOWN_VERSIONS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, CURRENT_VERSION,
]

export { DEFAULT_VOCAB_PREFERENCES }

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
      liveSession: null,
    },
    numbers: {
      preferences: {
        mode: 'plain',
        rangeId: '99',
        pickMode: 'adaptive',
      },
      stats: {},
    },
    particles: {
      preferences: { ...DEFAULT_PARTICLES_PREFERENCES },
      stats: {},
    },
    kanji: {
      learned: [],
      preferences: {
        hiddenWordsByKanji: {},
        wordJlptLevels: [],
      },
    },
    vocab: {
      myWords: [],
      customWords: {},
      myWordAddedAt: {},
      hiddenWordIds: [],
      learnedWordIds: [],
      trainingSets: [createMainTrainingSet()],
      activeTrainingSetId: MAIN_TRAINING_SET_ID,
      problemWordIds: [],
      preferences: { ...DEFAULT_VOCAB_PREFERENCES },
      stats: {},
      memory: {},
      latencyModel: {
        mu: { romaji: Math.log(1800), choice: Math.log(3200), mixed: Math.log(2800) },
        beta: { romaji: 0.08, choice: 0.04, mixed: 0.05 },
        samples: 0,
        zSamples: [],
      },
      reviewDay: { dayKey: '', newIntroduced: 0 },
      liveSession: null,
    },
    analytics: createDefaultAnalyticsState(),
    reader: { ...DEFAULT_READER_STATE, texts: [] },
  }
}

export function normalizeAppState(parsed: unknown): AppState | null {
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const source = { ...(parsed as Record<string, unknown>) }
  if (!KNOWN_VERSIONS.includes(source.version as number)) {
    // Backups sometimes omit version; accept shapes that look like app state.
    const looksLikeState =
      (source.vocab && typeof source.vocab === 'object') ||
      (source.kana && typeof source.kana === 'object') ||
      (source.preferences && typeof source.preferences === 'object') ||
      (source.stats && typeof source.stats === 'object')
    if (!looksLikeState) return null
    source.version = typeof source.version === 'number' ? source.version : 10
    if (!KNOWN_VERSIONS.includes(source.version as number)) {
      source.version = 10
    }
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
      liveSession: sanitizeCardTrainerLiveSession(
        legacyKana?.liveSession,
        fallback.kana.liveSession,
      ),
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
    particles: {
      preferences: sanitizeParticlesPreferences(
        source.particles && typeof source.particles === 'object'
          ? (source.particles as Record<string, unknown>).preferences
          : undefined,
        fallback.particles.preferences,
      ),
      stats: sanitizeParticlesStats(
        source.particles && typeof source.particles === 'object'
          ? (source.particles as Record<string, unknown>).stats
          : undefined,
      ),
    },
    kanji: sanitizeKanjiState(source.kanji, fallback.kanji),
    vocab,
    analytics: sanitizeAnalyticsState(source.analytics, fallback.analytics),
    reader: sanitizeReaderState(source.reader, fallback.reader),
  }
}
