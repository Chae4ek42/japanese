import type { AppState, StatsRecord } from '../../lib/types'

const VALID_NUMBER_MODES = new Set(['plain', 'age'])
const VALID_RANGE_IDS = new Set(['10', '99', '999'])
const VALID_PICK_MODES = new Set(['adaptive', 'even'])

export function sanitizeNumbersPreferences(raw: unknown, fallback: AppState['numbers']['preferences']) {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, string>) : {}
  return {
    mode: VALID_NUMBER_MODES.has(source.mode) ? (source.mode as typeof fallback.mode) : fallback.mode,
    rangeId: VALID_RANGE_IDS.has(source.rangeId) ? (source.rangeId as typeof fallback.rangeId) : fallback.rangeId,
    pickMode: VALID_PICK_MODES.has(source.pickMode)
      ? (source.pickMode as typeof fallback.pickMode)
      : fallback.pickMode,
  }
}

export function sanitizeNumbersStats(raw: unknown): Record<string, StatsRecord> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  return { ...(raw as Record<string, StatsRecord>) }
}
