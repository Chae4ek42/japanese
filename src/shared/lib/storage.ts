import {
  createDefaultAppState,
  CURRENT_VERSION,
  normalizeAppState,
} from '../state/app-state'
import type { AppState } from './types'
import {
  ACCOUNTS_META_KEY,
  LEGACY_APP_STATE_KEY,
  type AccountRecord,
  type AccountsMeta,
  accountStateKey,
  deleteAccountState,
  ensureAccountsMigrated,
  loadAccountState,
  loadAccountsMeta,
  saveAccountState,
  saveAccountsMeta,
} from './accounts'

export { createDefaultAppState, normalizeAppState, CURRENT_VERSION }
export {
  ACCOUNTS_META_KEY,
  LEGACY_APP_STATE_KEY,
  accountStateKey,
  ensureAccountsMigrated,
  loadAccountState,
  loadAccountsMeta,
  saveAccountState,
  saveAccountsMeta,
}
export type { AccountRecord, AccountsMeta }

/** @deprecated Legacy single-blob key — prefer accountStateKey(id). */
export const STORAGE_KEY = LEGACY_APP_STATE_KEY
export const STATE_API_PATH = '/api/state'

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
    }

/**
 * Local multi-account bootstrap. Migrates legacy single-blob into «Основной».
 * Remote `/api/state` is not used (would overwrite per-account stores).
 */
export async function bootstrapSession(): Promise<BootstrapResult> {
  try {
    const meta = ensureAccountsMigrated()
    if (!meta.activeId) {
      return { status: 'needsAccount', accounts: meta.accounts }
    }
    const state = loadAccountState(meta.activeId)
    return {
      status: 'ready',
      accountId: meta.activeId,
      state,
      accounts: meta.accounts,
    }
  } catch (error) {
    console.warn('[storage] account bootstrap failed', error)
    return { status: 'needsAccount', accounts: [] }
  }
}

/** @deprecated Prefer bootstrapSession — returns defaults only when no active account. */
export async function bootstrapAppState(): Promise<AppState> {
  const session = await bootstrapSession()
  if (session.status === 'ready') return session.state
  return createDefaultAppState()
}

export async function saveAppState(state: AppState, accountId?: string | null): Promise<void> {
  const id = accountId ?? loadAccountsMeta().activeId
  if (!id) {
    console.warn('[storage] skip save: no active account')
    return
  }
  saveAccountState(id, state)
}

/** Reset only the active account's progress (keeps the account). */
export async function resetStoredState(): Promise<void> {
  const meta = loadAccountsMeta()
  if (!meta.activeId) return
  saveAccountState(meta.activeId, createDefaultAppState())
}

/**
 * Sync helper for unit tests / tooling. Prefer bootstrapSession in the app.
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

export function removeAccountCompletely(accountId: string): AccountsMeta {
  deleteAccountState(accountId)
  const meta = loadAccountsMeta()
  const accounts = meta.accounts.filter((item) => item.id !== accountId)
  const activeId = meta.activeId === accountId ? null : meta.activeId
  const next = { activeId, accounts }
  saveAccountsMeta(next)
  return next
}
