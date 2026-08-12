import type { AppState, ParticlesFocus, StatsRecord } from '../../lib/types'

const VALID_PICK_MODES = new Set(['adaptive', 'even'])
const VALID_FOCUS = new Set<ParticlesFocus>(['all', 'frame', 'connect'])

export const DEFAULT_PARTICLES_PREFERENCES: AppState['particles']['preferences'] = {
  pickMode: 'adaptive',
  focus: 'all',
  mineOnly: false,
}

export function sanitizeParticlesPreferences(
  raw: unknown,
  fallback: AppState['particles']['preferences'] = DEFAULT_PARTICLES_PREFERENCES,
) {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    pickMode: VALID_PICK_MODES.has(String(source.pickMode))
      ? (source.pickMode as typeof fallback.pickMode)
      : fallback.pickMode,
    focus: VALID_FOCUS.has(source.focus as ParticlesFocus)
      ? (source.focus as ParticlesFocus)
      : fallback.focus,
    mineOnly: typeof source.mineOnly === 'boolean' ? source.mineOnly : fallback.mineOnly,
  }
}

export function sanitizeParticlesStats(raw: unknown): Record<string, StatsRecord> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  return { ...(raw as Record<string, StatsRecord>) }
}
