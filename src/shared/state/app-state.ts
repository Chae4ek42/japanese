import { ALL_CARD_IDS, GROUP_IDS } from '../../data/kana'
import type {
  AppState,
  KanaPreferences,
  PracticeHistory,
  StatsRecord,
  VocabPreferences,
  VocabState,
} from '../lib/types'
import {
  DEFAULT_HYPERPARAMS,
  createEmptyHistory,
  createStatsRecord,
} from '../lib/trainer'

export const CURRENT_VERSION = 13 as const
export const KNOWN_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, CURRENT_VERSION]

const VALID_SCRIPT_MODES = new Set(['hiragana', 'katakana', 'both'])
const VALID_KANA_MODES = new Set(['adaptive', 'even', 'problem'])
const VALID_INPUT_MODES = new Set(['instant', 'submit'])
const VALID_NUMBER_MODES = new Set(['plain', 'age'])
const VALID_RANGE_IDS = new Set(['10', '99', '999'])
const VALID_PICK_MODES = new Set(['adaptive', 'even'])
const VALID_VOCAB_DRILLS = new Set(['romaji', 'choice'])
const VALID_VOCAB_SOURCES = new Set(['level', 'group', 'mine'])
const VALID_VOCAB_LEVELS = new Set([5, 4, 3])
const GROUP_ID_SET = new Set<string>(GROUP_IDS)

export const DEFAULT_VOCAB_PREFERENCES: VocabPreferences = {
  drillMode: 'romaji',
  source: 'level',
  level: 5,
  groupId: 'family',
  pickMode: 'adaptive',
  inputMode: 'instant',
}

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
      },
    },
    vocab: {
      myWords: [],
      preferences: { ...DEFAULT_VOCAB_PREFERENCES },
      stats: {},
    },
  }
}

function sanitizeSelectedGroups(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) {
    return [...fallback]
  }
  const filtered = raw.filter((groupId): groupId is string => typeof groupId === 'string' && GROUP_ID_SET.has(groupId))
  return filtered.length ? filtered : [...fallback]
}

function sanitizeKanaPreferences(raw: unknown, fallback: KanaPreferences): KanaPreferences {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const removedModes = ['mistakes', 'confusion']
  const rawMode = typeof source.mode === 'string' ? source.mode : fallback.mode
  const mode = removedModes.includes(rawMode)
    ? 'adaptive'
    : VALID_KANA_MODES.has(rawMode)
      ? (rawMode as KanaPreferences['mode'])
      : fallback.mode

  const rawScriptMode = typeof source.scriptMode === 'string' ? source.scriptMode : fallback.scriptMode
  const rawInputMode = typeof source.inputMode === 'string' ? source.inputMode : fallback.inputMode

  return {
    scriptMode: VALID_SCRIPT_MODES.has(rawScriptMode)
      ? (rawScriptMode as KanaPreferences['scriptMode'])
      : fallback.scriptMode,
    selectedGroups: sanitizeSelectedGroups(source.selectedGroups, fallback.selectedGroups),
    mode,
    inputMode: VALID_INPUT_MODES.has(rawInputMode)
      ? (rawInputMode as KanaPreferences['inputMode'])
      : fallback.inputMode,
    retryQueueEnabled:
      typeof source.retryQueueEnabled === 'boolean' ? source.retryQueueEnabled : fallback.retryQueueEnabled,
    hyperparams: {
      ...fallback.hyperparams,
      ...(source.hyperparams && typeof source.hyperparams === 'object'
        ? (source.hyperparams as Partial<KanaPreferences['hyperparams']>)
        : {}),
    },
  }
}

function sanitizeKanaStats(raw: unknown, fallbackStats: Record<string, StatsRecord>): Record<string, StatsRecord> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, Partial<StatsRecord>>) : {}
  return Object.fromEntries(
    ALL_CARD_IDS.map((cardId) => [
      cardId,
      {
        ...fallbackStats[cardId],
        ...source[cardId],
      },
    ]),
  )
}

function sanitizeHistory(raw: unknown, fallback: PracticeHistory): PracticeHistory {
  const source = raw && typeof raw === 'object' ? (raw as Partial<PracticeHistory>) : {}
  return {
    daily: source.daily && typeof source.daily === 'object' ? { ...source.daily } : { ...fallback.daily },
    confusions:
      source.confusions && typeof source.confusions === 'object'
        ? { ...source.confusions }
        : { ...fallback.confusions },
    recent: Array.isArray(source.recent) ? [...source.recent] : [...fallback.recent],
  }
}

function sanitizeNumbersPreferences(raw: unknown, fallback: AppState['numbers']['preferences']) {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, string>) : {}
  return {
    mode: VALID_NUMBER_MODES.has(source.mode) ? (source.mode as typeof fallback.mode) : fallback.mode,
    rangeId: VALID_RANGE_IDS.has(source.rangeId) ? (source.rangeId as typeof fallback.rangeId) : fallback.rangeId,
    pickMode: VALID_PICK_MODES.has(source.pickMode)
      ? (source.pickMode as typeof fallback.pickMode)
      : fallback.pickMode,
  }
}

function sanitizeNumbersStats(raw: unknown): Record<string, StatsRecord> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  return { ...(raw as Record<string, StatsRecord>) }
}

function sanitizeKanjiState(raw: unknown, fallback: AppState['kanji']): AppState['kanji'] {
  const source = raw && typeof raw === 'object' ? (raw as Partial<AppState['kanji']>) : {}
  const learned = Array.isArray(source.learned)
    ? [...new Set(source.learned.filter((item): item is string => typeof item === 'string' && item.length === 1))]
    : [...fallback.learned]

  return {
    learned,
    preferences: {
      complexityFilter:
        typeof source.preferences?.complexityFilter === 'boolean'
          ? source.preferences.complexityFilter
          : fallback.preferences.complexityFilter,
    },
  }
}

function sanitizeVocabPreferences(raw: unknown, fallback: VocabPreferences): VocabPreferences {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const levelRaw = typeof source.level === 'number' ? source.level : fallback.level
  const groupId =
    typeof source.groupId === 'string' && source.groupId.length > 0 ? source.groupId : fallback.groupId

  return {
    drillMode: VALID_VOCAB_DRILLS.has(String(source.drillMode))
      ? (source.drillMode as VocabPreferences['drillMode'])
      : fallback.drillMode,
    source: VALID_VOCAB_SOURCES.has(String(source.source))
      ? (source.source as VocabPreferences['source'])
      : fallback.source,
    level: VALID_VOCAB_LEVELS.has(levelRaw) ? (levelRaw as VocabPreferences['level']) : fallback.level,
    groupId,
    pickMode: VALID_PICK_MODES.has(String(source.pickMode))
      ? (source.pickMode as VocabPreferences['pickMode'])
      : fallback.pickMode,
    inputMode: VALID_INPUT_MODES.has(String(source.inputMode))
      ? (source.inputMode as VocabPreferences['inputMode'])
      : fallback.inputMode,
  }
}

function sanitizeVocabState(raw: unknown, fallback: VocabState): VocabState {
  const source = raw && typeof raw === 'object' ? (raw as Partial<VocabState>) : {}
  const myWords = Array.isArray(source.myWords)
    ? [...new Set(source.myWords.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    : [...fallback.myWords]

  const stats =
    source.stats && typeof source.stats === 'object' ? { ...(source.stats as Record<string, StatsRecord>) } : {}

  return {
    myWords,
    preferences: sanitizeVocabPreferences(source.preferences, fallback.preferences),
    stats,
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
  const legacyKana = source.kana && typeof source.kana === 'object' ? (source.kana as Record<string, unknown>) : null
  const kanaPreferences = sanitizeKanaPreferences(
    legacyKana?.preferences ?? source.preferences,
    fallback.kana.preferences,
  )

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
    vocab: sanitizeVocabState(source.vocab, fallback.vocab),
  }
}
