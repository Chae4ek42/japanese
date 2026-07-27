import { ALL_CARD_IDS, GROUP_IDS } from '../../../data/kana'
import type { KanaPreferences, PracticeHistory, StatsRecord } from '../../lib/types'

const VALID_SCRIPT_MODES = new Set(['hiragana', 'katakana', 'both'])
const VALID_KANA_MODES = new Set(['adaptive', 'even', 'problem'])
const VALID_INPUT_MODES = new Set(['instant', 'submit'])
const GROUP_ID_SET = new Set<string>(GROUP_IDS)

function sanitizeSelectedGroups(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) {
    return [...fallback]
  }
  const filtered = raw.filter((groupId): groupId is string => typeof groupId === 'string' && GROUP_ID_SET.has(groupId))
  return filtered.length ? filtered : [...fallback]
}

export function sanitizeKanaPreferences(raw: unknown, fallback: KanaPreferences): KanaPreferences {
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

export function sanitizeKanaStats(raw: unknown, fallbackStats: Record<string, StatsRecord>): Record<string, StatsRecord> {
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

export function sanitizeHistory(raw: unknown, fallback: PracticeHistory): PracticeHistory {
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
