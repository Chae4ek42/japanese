/** Public account shape from the server (no password hashes). */
export interface AccountRecord {
  id: string
  name: string
  createdAt: number
  hasPassword: boolean
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

export function accountHasPassword(account: AccountRecord): boolean {
  return Boolean(account.hasPassword)
}
