import { createDefaultAppState, normalizeAppState } from '../state/app-state'
import type { AppState } from './types'
import { accountHasPassword } from './account-auth'

export const ACCOUNTS_META_KEY = 'jp-accounts-meta-v1'
/** Legacy single-blob key (pre multi-account). */
export const LEGACY_APP_STATE_KEY = 'jp-app-state-v1'
const LEGACY_TRAINER_KEYS = ['kana-trainer-state-v1']

export interface AccountRecord {
  id: string
  name: string
  createdAt: number
  /** base64 PBKDF2 salt — absent for legacy until first login sets a password */
  passwordSalt?: string
  /** base64 PBKDF2 hash */
  passwordHash?: string
}

export interface AccountsMeta {
  activeId: string | null
  accounts: AccountRecord[]
}

export function accountStateKey(accountId: string): string {
  return `${LEGACY_APP_STATE_KEY}:${accountId}`
}

export function newAccountId(): string {
  return `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function defaultAccountName(accounts: AccountRecord[], base = 'Аккаунт'): string {
  const used = new Set(accounts.map((item) => item.name))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

export function sanitizeAccountName(raw: string, fallback = 'Аккаунт'): string {
  const name = raw.trim().slice(0, 32)
  return name || fallback
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function emptyAccountsMeta(): AccountsMeta {
  return { activeId: null, accounts: [] }
}

function normalizeAccountRecord(item: AccountRecord): AccountRecord {
  const record: AccountRecord = {
    id: item.id,
    name: sanitizeAccountName(item.name),
    createdAt:
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now(),
  }
  if (
    typeof item.passwordSalt === 'string' &&
    item.passwordSalt.length > 0 &&
    typeof item.passwordHash === 'string' &&
    item.passwordHash.length > 0
  ) {
    record.passwordSalt = item.passwordSalt
    record.passwordHash = item.passwordHash
  }
  return record
}

function serializeAccountRecord(item: AccountRecord) {
  const base = {
    id: item.id,
    name: sanitizeAccountName(item.name),
    createdAt: item.createdAt,
  }
  if (accountHasPassword(item)) {
    return {
      ...base,
      passwordSalt: item.passwordSalt,
      passwordHash: item.passwordHash,
    }
  }
  return base
}

export function loadAccountsMeta(): AccountsMeta {
  const storage = getLocalStorage()
  if (!storage) return emptyAccountsMeta()
  try {
    const raw = storage.getItem(ACCOUNTS_META_KEY)
    if (!raw) return emptyAccountsMeta()
    const parsed = JSON.parse(raw) as Partial<AccountsMeta>
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts
          .filter(
            (item): item is AccountRecord =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof (item as AccountRecord).id === 'string' &&
              (item as AccountRecord).id.length > 0 &&
              typeof (item as AccountRecord).name === 'string',
          )
          .map((item) => normalizeAccountRecord(item))
      : []
    const activeId =
      typeof parsed.activeId === 'string' && accounts.some((item) => item.id === parsed.activeId)
        ? parsed.activeId
        : null
    return { activeId, accounts }
  } catch {
    return emptyAccountsMeta()
  }
}

export function saveAccountsMeta(meta: AccountsMeta): void {
  const storage = getLocalStorage()
  if (!storage) throw new Error('localStorage is unavailable')
  const activeId =
    meta.activeId && meta.accounts.some((item) => item.id === meta.activeId) ? meta.activeId : null
  storage.setItem(
    ACCOUNTS_META_KEY,
    JSON.stringify({
      activeId,
      accounts: meta.accounts.map(serializeAccountRecord),
    }),
  )
}

export function loadAccountState(accountId: string): AppState {
  const storage = getLocalStorage()
  if (!storage) return createDefaultAppState()
  try {
    const raw = storage.getItem(accountStateKey(accountId))
    if (!raw) return createDefaultAppState()
    return normalizeAppState(JSON.parse(raw)) ?? createDefaultAppState()
  } catch {
    return createDefaultAppState()
  }
}

export function saveAccountState(accountId: string, state: AppState): void {
  const storage = getLocalStorage()
  if (!storage) throw new Error('localStorage is unavailable')
  storage.setItem(accountStateKey(accountId), JSON.stringify(state))
}

export function deleteAccountState(accountId: string): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(accountStateKey(accountId))
  } catch {
    // ignore
  }
}

function readLegacyBlob(): string | null {
  const storage = getLocalStorage()
  if (!storage) return null
  try {
    const main = storage.getItem(LEGACY_APP_STATE_KEY)
    if (main) return main
    for (const key of LEGACY_TRAINER_KEYS) {
      const raw = storage.getItem(key)
      if (raw) return raw
    }
    return null
  } catch {
    return null
  }
}

function clearLegacyBlobs(): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(LEGACY_APP_STATE_KEY)
  } catch {
    // ignore
  }
  for (const key of LEGACY_TRAINER_KEYS) {
    try {
      storage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

/**
 * Ensure accounts meta exists. Migrates legacy single-blob state into account «Основной»
 * without a password and without auto-login (activeId = null) so the user sets a password.
 */
export function ensureAccountsMigrated(): AccountsMeta {
  let meta = loadAccountsMeta()
  if (meta.accounts.length > 0) {
    clearLegacyBlobs()
    return meta
  }

  const legacyRaw = readLegacyBlob()
  if (!legacyRaw) {
    return meta
  }

  let state: AppState
  try {
    state = normalizeAppState(JSON.parse(legacyRaw)) ?? createDefaultAppState()
  } catch {
    state = createDefaultAppState()
  }

  const id = newAccountId()
  const now = Date.now()
  const account: AccountRecord = {
    id,
    name: 'Основной',
    createdAt: now,
  }
  saveAccountState(id, state)
  meta = { activeId: null, accounts: [account] }
  saveAccountsMeta(meta)
  clearLegacyBlobs()
  return meta
}

export function createAccountRecord(
  name: string,
  accounts: AccountRecord[],
  credentials?: { passwordSalt: string; passwordHash: string },
): AccountRecord {
  const record: AccountRecord = {
    id: newAccountId(),
    name: sanitizeAccountName(name, defaultAccountName(accounts)),
    createdAt: Date.now(),
  }
  if (credentials) {
    record.passwordSalt = credentials.passwordSalt
    record.passwordHash = credentials.passwordHash
  }
  return record
}

export function updateAccountPassword(
  accountId: string,
  credentials: { passwordSalt: string; passwordHash: string },
): AccountsMeta {
  const meta = loadAccountsMeta()
  const accounts = meta.accounts.map((item) =>
    item.id === accountId
      ? {
          ...item,
          passwordSalt: credentials.passwordSalt,
          passwordHash: credentials.passwordHash,
        }
      : item,
  )
  const next = { ...meta, accounts }
  saveAccountsMeta(next)
  return next
}
