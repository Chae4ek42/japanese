import {
  createDefaultAppState,
  CURRENT_VERSION,
  normalizeAppState,
} from '../state/app-state'
import type { AppState } from './types'

export { createDefaultAppState, normalizeAppState, CURRENT_VERSION }

const STORAGE_KEY = 'jp-app-state-v1'
const LEGACY_STORAGE_KEY = 'kana-trainer-state-v1'

function readRawState(): string | null {
  const current = window.localStorage.getItem(STORAGE_KEY)
  if (current) {
    return current
  }
  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy) {
    window.localStorage.setItem(STORAGE_KEY, legacy)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return legacy
  }
  return null
}

function loadLocalState(): AppState {
  try {
    const raw = readRawState()
    if (!raw) {
      return createDefaultAppState()
    }
    return normalizeAppState(JSON.parse(raw)) ?? createDefaultAppState()
  } catch {
    return createDefaultAppState()
  }
}

function saveLocalState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function clearLocalState() {
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export async function bootstrapAppState(): Promise<AppState> {
  return loadLocalState()
}

export function saveAppState(state: AppState) {
  saveLocalState(state)
}

export async function resetStoredState() {
  clearLocalState()
}

export function loadAppState(factory: () => AppState = createDefaultAppState): AppState {
  try {
    const raw = readRawState()
    if (!raw) {
      return factory()
    }
    return normalizeAppState(JSON.parse(raw)) ?? factory()
  } catch {
    return factory()
  }
}
