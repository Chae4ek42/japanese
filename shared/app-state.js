import { ALL_CARD_IDS, GROUP_IDS } from '../src/data/kana.js'
import {
  DEFAULT_HYPERPARAMS,
  createEmptyHistory,
  createStatsRecord,
} from '../src/lib/trainer.js'

export const CURRENT_VERSION = 10
export const KNOWN_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, CURRENT_VERSION]

const VALID_SCRIPT_MODES = new Set(['hiragana', 'katakana', 'both'])
const VALID_KANA_MODES = new Set(['adaptive', 'even', 'problem'])
const VALID_INPUT_MODES = new Set(['instant', 'submit'])
const VALID_NUMBER_MODES = new Set(['plain', 'age'])
const VALID_RANGE_IDS = new Set(['10', '99', '999'])
const VALID_PICK_MODES = new Set(['adaptive', 'even'])
const GROUP_ID_SET = new Set(GROUP_IDS)

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
      },
    },
  }
}

function sanitizeSelectedGroups(raw, fallback) {
  if (!Array.isArray(raw)) {
    return [...fallback]
  }
  const filtered = raw.filter((groupId) => GROUP_ID_SET.has(groupId))
  return filtered.length ? filtered : [...fallback]
}

function sanitizeKanaPreferences(raw, fallback) {
  const removedModes = ['mistakes', 'confusion']
  const mode = removedModes.includes(raw?.mode)
    ? 'adaptive'
    : VALID_KANA_MODES.has(raw?.mode)
      ? raw.mode
      : fallback.mode

  return {
    scriptMode: VALID_SCRIPT_MODES.has(raw?.scriptMode) ? raw.scriptMode : fallback.scriptMode,
    selectedGroups: sanitizeSelectedGroups(raw?.selectedGroups, fallback.selectedGroups),
    mode,
    inputMode: VALID_INPUT_MODES.has(raw?.inputMode) ? raw.inputMode : fallback.inputMode,
    retryQueueEnabled: typeof raw?.retryQueueEnabled === 'boolean' ? raw.retryQueueEnabled : fallback.retryQueueEnabled,
    hyperparams: {
      ...fallback.hyperparams,
      ...(raw?.hyperparams ?? {}),
    },
  }
}

function sanitizeKanaStats(raw, fallbackStats) {
  return Object.fromEntries(
    ALL_CARD_IDS.map((cardId) => [
      cardId,
      {
        ...fallbackStats[cardId],
        ...raw?.[cardId],
      },
    ]),
  )
}

function sanitizeHistory(raw, fallback) {
  return {
    daily: raw?.daily && typeof raw.daily === 'object' ? { ...raw.daily } : { ...fallback.daily },
    confusions: raw?.confusions && typeof raw.confusions === 'object' ? { ...raw.confusions } : { ...fallback.confusions },
    recent: Array.isArray(raw?.recent) ? [...raw.recent] : [...fallback.recent],
  }
}

function sanitizeNumbersPreferences(raw, fallback) {
  return {
    mode: VALID_NUMBER_MODES.has(raw?.mode) ? raw.mode : fallback.mode,
    rangeId: VALID_RANGE_IDS.has(raw?.rangeId) ? raw.rangeId : fallback.rangeId,
    pickMode: VALID_PICK_MODES.has(raw?.pickMode) ? raw.pickMode : fallback.pickMode,
  }
}

function sanitizeNumbersStats(raw) {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  return { ...raw }
}

function sanitizeKanjiState(raw, fallback) {
  const learned = Array.isArray(raw?.learned)
    ? [...new Set(raw.learned.filter((item) => typeof item === 'string' && item.length === 1))]
    : [...fallback.learned]

  return {
    learned,
    preferences: {
      complexityFilter:
        typeof raw?.preferences?.complexityFilter === 'boolean'
          ? raw.preferences.complexityFilter
          : fallback.preferences.complexityFilter,
    },
  }
}

export function normalizeAppState(parsed) {
  if (!parsed || !KNOWN_VERSIONS.includes(parsed.version)) {
    return null
  }

  const fallback = createDefaultAppState()
  const kanaPreferences = sanitizeKanaPreferences(parsed.preferences, fallback.preferences)

  return {
    version: CURRENT_VERSION,
    preferences: kanaPreferences,
    stats: sanitizeKanaStats(parsed.stats, fallback.stats),
    history: sanitizeHistory(parsed.history, fallback.history),
    numbers: {
      preferences: sanitizeNumbersPreferences(parsed.numbers?.preferences, fallback.numbers.preferences),
      stats: sanitizeNumbersStats(parsed.numbers?.stats),
    },
    kanji: sanitizeKanjiState(parsed.kanji, fallback.kanji),
  }
}
