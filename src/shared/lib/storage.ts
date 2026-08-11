import {
  createDefaultAppState,
  CURRENT_VERSION,
  normalizeAppState,
} from '../state/app-state'
import type { AppState } from './types'
import type { AccountRecord } from './accounts'
import {
  fetchAccountState,
  listAccounts,
  putAccountState,
} from './accounts-api'
import { clearClientSession, loadClientSession } from './session'

export { createDefaultAppState, normalizeAppState, CURRENT_VERSION }
export type { AccountRecord }
export { defaultAccountName, sanitizeAccountName, accountHasPassword } from './accounts'

export const STATE_API_PATH = '/api/accounts'

/** Min gap between server state writes for the same account. */
export const SAVE_MIN_INTERVAL_MS = 30_000

const lastPushedJson = new Map<string, string>()
const lastPushAt = new Map<string, number>()

function draftKey(accountId: string): string {
  return `jp-state-draft-v1:${accountId}`
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function writeLocalDraft(accountId: string, rawJson: string): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.setItem(draftKey(accountId), rawJson)
  } catch {
    // quota
  }
}

export function readLocalDraft(accountId: string): string | null {
  const storage = getLocalStorage()
  if (!storage) return null
  try {
    return storage.getItem(draftKey(accountId))
  } catch {
    return null
  }
}

export function clearLocalDraft(accountId: string): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(draftKey(accountId))
  } catch {
    // ignore
  }
}

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

export type BootstrapResult =
  | {
      status: 'ready'
      accountId: string
      state: AppState
      accounts: AccountRecord[]
    }
  | {
      status: 'needsAccount'
      accounts: AccountRecord[]
      error?: string
    }

/**
 * Server multi-account bootstrap. Session in localStorage; accounts/state in D1.
 * Prefers a newer local draft when present (written between rare server syncs).
 */
export async function bootstrapSession(): Promise<BootstrapResult> {
  try {
    const accounts = await listAccounts()
    const session = loadClientSession()
    if (!session || !accounts.some((item) => item.id === session.accountId)) {
      if (session) clearClientSession()
      return { status: 'needsAccount', accounts }
    }
    try {
      const raw = await fetchAccountState(session.accountId)
      const draft = readLocalDraft(session.accountId)
      const state = parseStoredState(draft ?? raw)
      if (raw) lastPushedJson.set(session.accountId, raw)
      return {
        status: 'ready',
        accountId: session.accountId,
        state,
        accounts,
      }
    } catch (error) {
      console.warn('[storage] session state failed', error)
      const draft = readLocalDraft(session.accountId)
      if (draft) {
        return {
          status: 'ready',
          accountId: session.accountId,
          state: parseStoredState(draft),
          accounts,
        }
      }
      clearClientSession()
      return { status: 'needsAccount', accounts }
    }
  } catch (error) {
    console.warn('[storage] account bootstrap failed', error)
    const message =
      error instanceof Error ? error.message : 'Нет связи с сервером аккаунтов'
    return { status: 'needsAccount', accounts: [], error: message }
  }
}

/** @deprecated Prefer bootstrapSession */
export async function bootstrapAppState(): Promise<AppState> {
  const session = await bootstrapSession()
  if (session.status === 'ready') return session.state
  return createDefaultAppState()
}

export type SaveResult = 'pushed' | 'unchanged' | 'draft-only' | 'skipped'

export async function saveAppState(
  state: AppState,
  accountId?: string | null,
  options?: { force?: boolean },
): Promise<SaveResult> {
  const session = loadClientSession()
  const id = accountId ?? session?.accountId
  if (!id || !session || session.accountId !== id) {
    console.warn('[storage] skip save: no active session')
    return 'skipped'
  }
  const raw = JSON.stringify(state)
  writeLocalDraft(id, raw)

  if (raw === lastPushedJson.get(id)) return 'unchanged'

  const lastAt = lastPushAt.get(id) ?? 0
  if (!options?.force && Date.now() - lastAt < SAVE_MIN_INTERVAL_MS) {
    return 'draft-only'
  }

  await putAccountState(id, raw)
  lastPushedJson.set(id, raw)
  lastPushAt.set(id, Date.now())
  return 'pushed'
}

/** Reset only the active account's progress (keeps the account). */
export async function resetStoredState(): Promise<void> {
  const session = loadClientSession()
  if (!session) return
  const next = createDefaultAppState()
  await saveAppState(next, session.accountId, { force: true })
}

/**
 * Sync helper for unit tests / tooling.
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
