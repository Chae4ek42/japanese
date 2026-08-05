import {
  createDefaultAppState,
  CURRENT_VERSION,
  normalizeAppState,
} from '../state/app-state'
import type { AppState } from './types'

export { createDefaultAppState, normalizeAppState, CURRENT_VERSION }

export const STORAGE_KEY = 'jp-app-state-v1'
export const STATE_API_PATH = '/api/state'
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

function clearStoredState() {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
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

function stateAuthToken(): string | undefined {
  try {
    // Vite injects `import.meta.env`; plain Node unit tests may omit it.
    const env = (import.meta as ImportMeta & { env?: { VITE_STATE_AUTH?: string } }).env
    return env?.VITE_STATE_AUTH
  } catch {
    return undefined
  }
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = stateAuthToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

function looksLikeHtml(response: Response): boolean {
  const ct = response.headers.get('content-type') ?? ''
  return ct.includes('text/html')
}

type RemoteGetResult =
  | { kind: 'ok'; state: AppState }
  | { kind: 'empty' }
  | { kind: 'unavailable' }
  | { kind: 'error'; error: Error }

async function fetchRemoteState(): Promise<RemoteGetResult> {
  if (typeof fetch !== 'function') {
    return { kind: 'unavailable' }
  }
  try {
    const response = await fetch(STATE_API_PATH, {
      method: 'GET',
      headers: authHeaders({ Accept: 'application/json' }),
      cache: 'no-store',
    })
    if (response.status === 404) {
      return { kind: 'empty' }
    }
    if (looksLikeHtml(response)) {
      return { kind: 'unavailable' }
    }
    if (!response.ok) {
      return { kind: 'error', error: new Error(`GET ${STATE_API_PATH} failed: ${response.status}`) }
    }
    const ct = response.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) {
      return { kind: 'unavailable' }
    }
    const data: unknown = await response.json()
    const state = normalizeAppState(data)
    if (!state) {
      return { kind: 'empty' }
    }
    return { kind: 'ok', state }
  } catch {
    return { kind: 'unavailable' }
  }
}

async function putRemoteState(raw: string): Promise<'ok' | 'unavailable'> {
  if (typeof fetch !== 'function') {
    return 'unavailable'
  }
  try {
    const response = await fetch(STATE_API_PATH, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
      body: raw,
    })
    if (looksLikeHtml(response)) {
      return 'unavailable'
    }
    if (response.status === 204 || response.status === 200) {
      return 'ok'
    }
    if (response.status === 404 || response.status === 405) {
      return 'unavailable'
    }
    throw new Error(`PUT ${STATE_API_PATH} failed: ${response.status}`)
  } catch (error) {
    if (error instanceof TypeError) {
      // Network / CORS failures during local Vite — treat as no API.
      return 'unavailable'
    }
    throw error
  }
}

async function deleteRemoteState(): Promise<'ok' | 'unavailable'> {
  if (typeof fetch !== 'function') {
    return 'unavailable'
  }
  try {
    const response = await fetch(STATE_API_PATH, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (looksLikeHtml(response)) {
      return 'unavailable'
    }
    if (response.status === 204 || response.status === 200 || response.status === 404) {
      return 'ok'
    }
    if (response.status === 405) {
      return 'unavailable'
    }
    throw new Error(`DELETE ${STATE_API_PATH} failed: ${response.status}`)
  } catch (error) {
    if (error instanceof TypeError) {
      return 'unavailable'
    }
    throw error
  }
}

function bootstrapFromLocalStorage(): AppState {
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

  return createDefaultAppState()
}

/**
 * Load app state from the server. Falls back to localStorage only when the
 * `/api/state` endpoint is unavailable (local Vite / offline tests).
 */
export async function bootstrapAppState(): Promise<AppState> {
  const remote = await fetchRemoteState()
  if (remote.kind === 'ok') {
    clearStoredState()
    clearLegacyLocalStorage()
    return remote.state
  }
  if (remote.kind === 'empty') {
    // Fresh server store — do not silently pull old browser data.
    clearStoredState()
    clearLegacyLocalStorage()
    return createDefaultAppState()
  }
  if (remote.kind === 'error') {
    console.warn('[storage] remote state read failed, using local fallback', remote.error)
  }

  try {
    return bootstrapFromLocalStorage()
  } catch (error) {
    console.warn('[storage] localStorage unavailable, using defaults', error)
    return createDefaultAppState()
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  const raw = JSON.stringify(state)
  const remote = await putRemoteState(raw)
  if (remote === 'ok') {
    clearStoredState()
    clearLegacyLocalStorage()
    return
  }
  // Dev / tests without Worker API.
  writeStoredState(raw)
}

export async function resetStoredState(): Promise<void> {
  await deleteRemoteState()
  clearStoredState()
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
