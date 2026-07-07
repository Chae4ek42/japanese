import { ALL_CARD_IDS } from '../data/kana.js'
import { WORD_IDS } from '../data/words.js'
import { DEFAULT_HYPERPARAMS, createEmptyHistory, createStatsRecord } from './trainer.js'

const STORAGE_KEY = 'kana-trainer-state-v1'
const CURRENT_VERSION = 3
const KNOWN_VERSIONS = [1, 2, CURRENT_VERSION]

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
        onlyFavorites: false,
      },
      favorites: [],
      stats: Object.fromEntries(WORD_IDS.map((wordId) => [wordId, createStatsRecord()])),
    },
  }
}

export function loadAppState(factory) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return factory()
    }

    const parsed = JSON.parse(raw)
    if (!parsed || !KNOWN_VERSIONS.includes(parsed.version)) {
      return factory()
    }

    const fallback = factory()
    const removedModes = ['mistakes', 'confusion']
    const migratedMode = removedModes.includes(parsed.preferences?.mode)
      ? 'adaptive'
      : parsed.preferences?.mode

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
        preferences: {
          ...fallback.words.preferences,
          ...parsed.words?.preferences,
        },
        favorites: Array.isArray(parsed.words?.favorites)
          ? parsed.words.favorites.filter((id) => id in fallback.words.stats)
          : [],
        stats: Object.fromEntries(
          WORD_IDS.map((wordId) => [
            wordId,
            {
              ...fallback.words.stats[wordId],
              ...parsed.words?.stats?.[wordId],
            },
          ]),
        ),
      },
    }
  } catch {
    return factory()
  }
}

export function saveAppState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetStoredState() {
  window.localStorage.removeItem(STORAGE_KEY)
}
