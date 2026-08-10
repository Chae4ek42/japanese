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
 * Server multi-account bootstrap. Session in localStorage; accounts/state in KV.
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
      const state = parseStoredState(raw)
      return {
        status: 'ready',
        accountId: session.accountId,
        state,
        accounts,
      }
    } catch (error) {
      console.warn('[storage] session state failed', error)
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

export async function saveAppState(state: AppState, accountId?: string | null): Promise<void> {
  const session = loadClientSession()
  const id = accountId ?? session?.accountId
  if (!id || !session || session.accountId !== id) {
    console.warn('[storage] skip save: no active session')
    return
  }
  await putAccountState(id, JSON.stringify(state))
}

/** Reset only the active account's progress (keeps the account). */
export async function resetStoredState(): Promise<void> {
  const session = loadClientSession()
  if (!session) return
  await putAccountState(session.accountId, JSON.stringify(createDefaultAppState()))
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
