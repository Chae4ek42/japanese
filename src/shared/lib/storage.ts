import {
  createDefaultAppState,
  CURRENT_VERSION,
  normalizeAppState,
} from '../state/app-state'
import type { AppState } from './types'

export { createDefaultAppState, normalizeAppState, CURRENT_VERSION }

export const STORAGE_KEY = 'jp-app-state-v1'
const LEGACY_STORAGE_KEYS = ['kana-trainer-state-v1']

/** Parse raw JSON into AppState (used by persistence helpers + tests). */
export function parseStoredState(
  raw: string | null | undefined,
  factory: () => AppState = createDefaultAppState,
): AppState {
  if (!raw) return factory()
  try {
    return normalizeAppState(JSON.parse(raw)) ?? factory()
  } catch {
    return factory()
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

function readStoredState(): string | null {
  const storage = getLocalStorage()
  if (!storage) return null
  try {
    return storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredState(raw: string) {
  const storage = getLocalStorage()
  if (!storage) {
    throw new Error('localStorage is unavailable')
  }
  storage.setItem(STORAGE_KEY, raw)
}

function readLegacyLocalStorage(): string | null {
  const storage = getLocalStorage()
  if (!storage) return null
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = storage.getItem(key)
      if (raw) return raw
    }
    return null
  } catch {
    return null
  }
}

function clearLegacyLocalStorage() {
  const storage = getLocalStorage()
  if (!storage) return
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      storage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

export async function bootstrapAppState(): Promise<AppState> {
  try {
    const storedRaw = readStoredState()
    if (storedRaw) {
      return parseStoredState(storedRaw)
    }

    const legacyRaw = readLegacyLocalStorage()
    if (legacyRaw) {
      const migrated = parseStoredState(legacyRaw)
      writeStoredState(JSON.stringify(migrated))
      clearLegacyLocalStorage()
      return migrated
    }
  } catch (error) {
    console.warn('[storage] localStorage unavailable, using defaults', error)
  }

  return createDefaultAppState()
}

export async function saveAppState(state: AppState): Promise<void> {
  writeStoredState(JSON.stringify(state))
}

export async function resetStoredState(): Promise<void> {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }
  storage.removeItem(STORAGE_KEY)
  clearLegacyLocalStorage()
}

/**
 * Sync helper for unit tests / tooling. Prefer bootstrapAppState in the app.
 * When `raw` is passed, parses it; otherwise returns defaults.
 */
export function loadAppState(
  factory: () => AppState = createDefaultAppState,
  raw?: string | null,
): AppState {
  if (arguments.length >= 2) {
    return parseStoredState(raw, factory)
  }
  return factory()
}
