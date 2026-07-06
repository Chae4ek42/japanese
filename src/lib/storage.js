import { ALL_CARD_IDS } from '../data/kana'
import { DEFAULT_HYPERPARAMS, createStatsRecord } from './trainer'

const STORAGE_KEY = 'kana-trainer-state-v1'

export function createDefaultAppState() {
  return {
    version: 1,
    preferences: {
      scriptMode: 'hiragana',
      selectedGroups: ['vowels', 'k', 's', 't', 'n'],
      mode: 'adaptive',
      retryQueueEnabled: true,
      hyperparams: { ...DEFAULT_HYPERPARAMS },
    },
    stats: Object.fromEntries(ALL_CARD_IDS.map((cardId) => [cardId, createStatsRecord()])),
  }
}

export function loadAppState(factory) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return factory()
    }

    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== 1) {
      return factory()
    }

    const fallback = factory()
    return {
      ...fallback,
      ...parsed,
      preferences: {
        ...fallback.preferences,
        ...parsed.preferences,
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
