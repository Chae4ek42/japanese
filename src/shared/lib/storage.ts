import {
  createDefaultAppState,
  CURRENT_VERSION,
  normalizeAppState,
} from '../state/app-state'
import type { AppState } from './types'

export { createDefaultAppState, normalizeAppState, CURRENT_VERSION }

const API_URL = '/api/app-state'

/** Parse raw JSON into AppState (used by API + tests). */
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

async function fetchSharedState(): Promise<AppState | null> {
  const response = await fetch(API_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (response.status === 204) return null
  if (!response.ok) {
    throw new Error(`Failed to load shared state: ${response.status}`)
  }
  const text = await response.text()
  if (!text.trim()) return null
  return parseStoredState(text)
}

async function putSharedState(state: AppState): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
  if (!response.ok) {
    throw new Error(`Failed to save shared state: ${response.status}`)
  }
}

/**
 * One-time migration: if shared store is empty but this browser still has
 * localStorage data, push it to the shared file so nothing is lost.
 */
function readLegacyLocalStorage(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const current = window.localStorage.getItem('jp-app-state-v1')
    if (current) return current
    return window.localStorage.getItem('kana-trainer-state-v1')
  } catch {
    return null
  }
}

function clearLegacyLocalStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.removeItem('jp-app-state-v1')
    window.localStorage.removeItem('kana-trainer-state-v1')
  } catch {
    // ignore
  }
}

export async function bootstrapAppState(): Promise<AppState> {
  try {
    const shared = await fetchSharedState()
    if (shared) {
      clearLegacyLocalStorage()
      return shared
    }

    const legacyRaw = readLegacyLocalStorage()
    if (legacyRaw) {
      const migrated = parseStoredState(legacyRaw)
      await putSharedState(migrated)
      clearLegacyLocalStorage()
      return migrated
    }
  } catch (error) {
    console.warn('[storage] shared state unavailable, using defaults', error)
  }

  return createDefaultAppState()
}

export async function saveAppState(state: AppState): Promise<void> {
  await putSharedState(state)
}

export async function resetStoredState(): Promise<void> {
  const response = await fetch(API_URL, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Failed to reset shared state: ${response.status}`)
  }
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
