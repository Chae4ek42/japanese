import { accountHasPassword, newId } from './auth'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_STATE_BYTES = 20_000_000

/** Legacy KV keys — only used when migrating into D1. */
const META_KEY = 'accounts-meta'
const LEGACY_STATE_KEY = 'app-state'

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

interface AccountRow {
  id: string
  name: string
  created_at: number
  password_salt: string | null
  password_hash: string | null
}

interface SessionRow {
  token: string
  account_id: string
  expires_at: number
}

let schemaReady: Promise<void> | null = null

/** Built with join(' ') so formatters cannot put newlines inside DDL. */
const SCHEMA_STATEMENTS = [
  [
    'CREATE TABLE IF NOT EXISTS accounts (',
    'id TEXT PRIMARY KEY NOT NULL,',
    'name TEXT NOT NULL,',
    'created_at INTEGER NOT NULL,',
    'password_salt TEXT,',
    'password_hash TEXT',
    ')',
  ].join(' '),
  [
    'CREATE TABLE IF NOT EXISTS account_state (',
    'account_id TEXT PRIMARY KEY NOT NULL,',
    'body TEXT NOT NULL,',
    'updated_at INTEGER NOT NULL',
    ')',
  ].join(' '),
  [
    'CREATE TABLE IF NOT EXISTS sessions (',
    'token TEXT PRIMARY KEY NOT NULL,',
    'account_id TEXT NOT NULL,',
    'expires_at INTEGER NOT NULL',
    ')',
  ].join(' '),
  'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions (account_id)',
]

/** Never use db.exec() — it splits SQL on newlines and breaks CREATE TABLE. */
export async function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const existing = await db
        .prepare(
          "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'accounts' LIMIT 1",
        )
        .first<{ ok: number }>()
      if (existing) return
      for (const sql of SCHEMA_STATEMENTS) {
        await db.prepare(sql).run()
      }
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  await schemaReady
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

function rowToAccount(row: AccountRow): StoredAccount {
  const account: StoredAccount = {
    id: row.id,
    name: sanitizeName(row.name),
    createdAt:
      typeof row.created_at === 'number' && Number.isFinite(row.created_at)
        ? row.created_at
        : Date.now(),
  }
  if (row.password_salt && row.password_hash) {
    account.passwordSalt = row.password_salt
    account.passwordHash = row.password_hash
  }
  return account
}

export async function listAccounts(db: D1Database): Promise<StoredAccount[]> {
  const result = await db
    .prepare(
      `SELECT id, name, created_at, password_salt, password_hash
       FROM accounts ORDER BY created_at ASC`,
    )
    .all<AccountRow>()
  return (result.results ?? []).map(rowToAccount)
}

export async function loadMeta(db: D1Database): Promise<AccountsMeta> {
  return { accounts: await listAccounts(db) }
}

export async function getAccount(
  db: D1Database,
  accountId: string,
): Promise<StoredAccount | null> {
  const row = await db
    .prepare(
      `SELECT id, name, created_at, password_salt, password_hash
       FROM accounts WHERE id = ?`,
    )
    .bind(accountId)
    .first<AccountRow>()
  return row ? rowToAccount(row) : null
}

export async function insertAccount(db: D1Database, account: StoredAccount): Promise<void> {
  await db
    .prepare(
      `INSERT INTO accounts (id, name, created_at, password_salt, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      account.id,
      account.name,
      account.createdAt,
      account.passwordSalt ?? null,
      account.passwordHash ?? null,
    )
    .run()
}

export async function updateAccount(db: D1Database, account: StoredAccount): Promise<void> {
  await db
    .prepare(
      `UPDATE accounts
       SET name = ?, password_salt = ?, password_hash = ?
       WHERE id = ?`,
    )
    .bind(
      account.name,
      account.passwordSalt ?? null,
      account.passwordHash ?? null,
      account.id,
    )
    .run()
}

export async function deleteAccount(db: D1Database, accountId: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE account_id = ?`).bind(accountId),
    db.prepare(`DELETE FROM account_state WHERE account_id = ?`).bind(accountId),
    db.prepare(`DELETE FROM accounts WHERE id = ?`).bind(accountId),
  ])
}

export async function getAccountState(
  db: D1Database,
  accountId: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT body FROM account_state WHERE account_id = ?`)
    .bind(accountId)
    .first<{ body: string }>()
  return row?.body ?? null
}

export async function putAccountState(
  db: D1Database,
  accountId: string,
  body: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO account_state (account_id, body, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         body = excluded.body,
         updated_at = excluded.updated_at`,
    )
    .bind(accountId, body, Date.now())
    .run()
}

export async function createSession(
  db: D1Database,
  accountId: string,
  token: string,
): Promise<SessionRecord> {
  const record: SessionRecord = {
    accountId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
  await db
    .prepare(
      `INSERT INTO sessions (token, account_id, expires_at)
       VALUES (?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET
         account_id = excluded.account_id,
         expires_at = excluded.expires_at`,
    )
    .bind(token, accountId, record.expiresAt)
    .run()
  return record
}

export async function readSession(
  db: D1Database,
  token: string | null,
): Promise<SessionRecord | null> {
  if (!token) return null
  const row = await db
    .prepare(`SELECT token, account_id, expires_at FROM sessions WHERE token = ?`)
    .bind(token)
    .first<SessionRow>()
  if (!row) return null
  if (row.expires_at < Date.now()) {
    await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
    return null
  }
  return { accountId: row.account_id, expiresAt: row.expires_at }
}

export async function deleteSession(db: D1Database, token: string | null): Promise<void> {
  if (!token) return
  await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
}

function parseKvMeta(raw: string | null): AccountsMeta {
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

/**
 * One-time: copy KV accounts/state into empty D1 (if legacy APP_STATE binding exists).
 * Also handles old single `app-state` key → account «Основной».
 */
export async function migrateFromKvIfNeeded(
  db: D1Database,
  kv: KVNamespace | undefined,
): Promise<void> {
  const existing = await listAccounts(db)
  if (existing.length > 0) return

  if (kv) {
    const meta = parseKvMeta(await kv.get(META_KEY))
    if (meta.accounts.length > 0) {
      for (const account of meta.accounts) {
        await insertAccount(db, account)
        const state = await kv.get(`account:${account.id}`)
        if (state) await putAccountState(db, account.id, state)
      }
      return
    }

    const legacy = await kv.get(LEGACY_STATE_KEY)
    if (legacy) {
      try {
        JSON.parse(legacy)
        const id = newId('acc')
        await insertAccount(db, { id, name: 'Основной', createdAt: Date.now() })
        await putAccountState(db, id, legacy)
        await kv.delete(LEGACY_STATE_KEY)
        return
      } catch {
        await kv.delete(LEGACY_STATE_KEY)
      }
    }
  }
}
