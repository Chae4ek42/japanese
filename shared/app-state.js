export const CURRENT_VERSION = 8
export const KNOWN_VERSIONS = [1, 2, 3, 4, 5, 6, 7, CURRENT_VERSION]

const VALID_MODES = new Set(['plain', 'age'])
const VALID_RANGE_IDS = new Set(['10', '99', '999'])
const VALID_PICK_MODES = new Set(['adaptive', 'even'])

export function createDefaultAppState() {
  return {
    version: CURRENT_VERSION,
    numbers: {
      preferences: {
        mode: 'plain',
        rangeId: '99',
        pickMode: 'adaptive',
      },
      stats: {},
    },
  }
}

function sanitizeNumbersPreferences(raw, fallback) {
  return {
    mode: VALID_MODES.has(raw?.mode) ? raw.mode : fallback.mode,
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

export function normalizeAppState(parsed) {
  if (!parsed || !KNOWN_VERSIONS.includes(parsed.version)) {
    return null
  }

  const fallback = createDefaultAppState()
  return {
    version: CURRENT_VERSION,
    numbers: {
      preferences: sanitizeNumbersPreferences(parsed.numbers?.preferences, fallback.numbers.preferences),
      stats: sanitizeNumbersStats(parsed.numbers?.stats),
    },
  }
}
