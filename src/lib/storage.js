import {
  createDefaultAppState,
  CURRENT_VERSION,
  normalizeAppState,
} from '../../shared/app-state.js'

export { createDefaultAppState, normalizeAppState, CURRENT_VERSION }

const STORAGE_KEY = 'kana-trainer-state-v1'

function loadLocalState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createDefaultAppState()
    }
    return normalizeAppState(JSON.parse(raw)) ?? createDefaultAppState()
  } catch {
    return createDefaultAppState()
  }
}

function saveLocalState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function clearLocalState() {
  window.localStorage.removeItem(STORAGE_KEY)
}

export async function bootstrapAppState() {
  return loadLocalState()
}

export function saveAppState(state) {
  saveLocalState(state)
}

export async function resetStoredState() {
  clearLocalState()
}

export function loadAppState(factory = createDefaultAppState) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return factory()
    }
    return normalizeAppState(JSON.parse(raw)) ?? factory()
  } catch {
    return factory()
  }
}
