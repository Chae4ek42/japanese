import type { AppState, StatsRecord, VerbsFocus } from '../../lib/types'

const VALID_PICK_MODES = new Set(['adaptive', 'even'])
const VALID_FOCUS = new Set<VerbsFocus>(['all', 'te', 'ta', 'nai', 'masu', 'potential'])

export const DEFAULT_VERBS_PREFERENCES: AppState['verbs']['preferences'] = {
  pickMode: 'adaptive',
  focus: 'all',
}

export function sanitizeVerbsPreferences(
  raw: unknown,
  fallback: AppState['verbs']['preferences'] = DEFAULT_VERBS_PREFERENCES,
) {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const focus = source.focus as VerbsFocus
  return {
    pickMode: VALID_PICK_MODES.has(String(source.pickMode))
      ? (source.pickMode as typeof fallback.pickMode)
      : fallback.pickMode,
    focus: VALID_FOCUS.has(focus) ? focus : fallback.focus,
  }
}

export function sanitizeVerbsStats(raw: unknown): Record<string, StatsRecord> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  return { ...(raw as Record<string, StatsRecord>) }
}
