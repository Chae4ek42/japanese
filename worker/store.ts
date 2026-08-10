import { accountHasPassword, newId } from './auth'

export const META_KEY = 'accounts-meta'
export const LEGACY_STATE_KEY = 'app-state'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_STATE_BYTES = 20_000_000

export interface StoredAccount {
  id: string
  name: string
  createdAt: number
  passwordSalt?: string
  passwordHash?: string
}

export interface AccountsMeta {
  accounts: StoredAccount[]
}

export interface SessionRecord {
  accountId: string
  expiresAt: number
}

export function accountStateKey(accountId: string): string {
  return `account:${accountId}`
}

export function sessionKey(token: string): string {
  return `session:${token}`
}

export function sanitizeName(raw: string, fallback = 'Аккаунт'): string {
  const name = raw.trim().slice(0, 32)
  return name || fallback
}

export function defaultAccountName(accounts: StoredAccount[], base = 'Аккаунт'): string {
  const used = new Set(accounts.map((item) => item.name))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

export function publicAccount(account: StoredAccount) {
  return {
    id: account.id,
    name: account.name,
    createdAt: account.createdAt,
    hasPassword: accountHasPassword(account),
  }
}

export async function loadMeta(kv: KVNamespace): Promise<AccountsMeta> {
  const raw = await kv.get(META_KEY)
  if (!raw) return { accounts: [] }
  try {
    const parsed = JSON.parse(raw) as Partial<AccountsMeta>
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts
          .filter(
            (item): item is StoredAccount =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof (item as StoredAccount).id === 'string' &&
              typeof (item as StoredAccount).name === 'string',
          )
          .map((item) => {
            const account: StoredAccount = {
              id: item.id,
              name: sanitizeName(item.name),
              createdAt:
                typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
                  ? item.createdAt
                  : Date.now(),
            }
            if (
              typeof item.passwordSalt === 'string' &&
              item.passwordSalt &&
              typeof item.passwordHash === 'string' &&
              item.passwordHash
            ) {
              account.passwordSalt = item.passwordSalt
              account.passwordHash = item.passwordHash
            }
            return account
          })
      : []
    return { accounts }
  } catch {
    return { accounts: [] }
  }
}

export async function saveMeta(kv: KVNamespace, meta: AccountsMeta): Promise<void> {
  await kv.put(META_KEY, JSON.stringify({ accounts: meta.accounts }))
}

/** One-time: legacy single app-state → account «Основной» without password. */
export async function ensureLegacyMigrated(kv: KVNamespace): Promise<AccountsMeta> {
  let meta = await loadMeta(kv)
  if (meta.accounts.length > 0) {
    await kv.delete(LEGACY_STATE_KEY)
    return meta
  }
  const legacy = await kv.get(LEGACY_STATE_KEY)
  if (!legacy) return meta
  try {
    JSON.parse(legacy)
  } catch {
    await kv.delete(LEGACY_STATE_KEY)
    return meta
  }
  const id = newId('acc')
  const account: StoredAccount = {
    id,
    name: 'Основной',
    createdAt: Date.now(),
  }
  await kv.put(accountStateKey(id), legacy)
  meta = { accounts: [account] }
  await saveMeta(kv, meta)
  await kv.delete(LEGACY_STATE_KEY)
  return meta
}

export async function createSession(
  kv: KVNamespace,
  accountId: string,
  token: string,
): Promise<SessionRecord> {
  const record: SessionRecord = {
    accountId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
  await kv.put(sessionKey(token), JSON.stringify(record), {
    expirationTtl: Math.ceil(SESSION_TTL_MS / 1000),
  })
  return record
}

export async function readSession(
  kv: KVNamespace,
  token: string | null,
): Promise<SessionRecord | null> {
  if (!token) return null
  const raw = await kv.get(sessionKey(token))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionRecord
    if (!parsed.accountId || typeof parsed.expiresAt !== 'number') return null
    if (parsed.expiresAt < Date.now()) {
      await kv.delete(sessionKey(token))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function touchSession(
  kv: KVNamespace,
  token: string,
  session: SessionRecord,
): Promise<SessionRecord> {
  const next = { ...session, expiresAt: Date.now() + SESSION_TTL_MS }
  await kv.put(sessionKey(token), JSON.stringify(next), {
    expirationTtl: Math.ceil(SESSION_TTL_MS / 1000),
  })
  return next
}

export async function deleteSession(kv: KVNamespace, token: string | null): Promise<void> {
  if (!token) return
  await kv.delete(sessionKey(token))
}
