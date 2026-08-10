export const SESSION_KEY = 'jp-account-session-v1'

export interface ClientSession {
  token: string
  accountId: string
  expiresAt: number
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function loadClientSession(): ClientSession | null {
  const storage = getLocalStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ClientSession>
    if (
      typeof parsed.token !== 'string' ||
      !parsed.token ||
      typeof parsed.accountId !== 'string' ||
      !parsed.accountId ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null
    }
    if (parsed.expiresAt < Date.now()) {
      storage.removeItem(SESSION_KEY)
      return null
    }
    return {
      token: parsed.token,
      accountId: parsed.accountId,
      expiresAt: parsed.expiresAt,
    }
  } catch {
    return null
  }
}

export function saveClientSession(session: ClientSession): void {
  const storage = getLocalStorage()
  if (!storage) return
  storage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearClientSession(): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
