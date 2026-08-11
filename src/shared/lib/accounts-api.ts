/// <reference path="../../vite-env.d.ts" />
import type { AccountRecord } from './accounts'
import { clearClientSession, loadClientSession, saveClientSession, type ClientSession } from './session'
import { AuthError } from './account-auth'

const ACCOUNTS_PATH = '/api/accounts'

function apiUrl(path: string): string {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(path, window.location.origin).href
    }
  } catch {
    // fall through
  }
  return path
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeaders(sessionToken?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  const deploy = import.meta.env?.VITE_STATE_AUTH
  if (typeof deploy === 'string' && deploy) {
    headers.Authorization = `Bearer ${deploy}`
  }
  if (sessionToken) {
    headers['X-Account-Session'] = sessionToken
  }
  return headers
}

async function readError(response: Response): Promise<ApiError> {
  const status = response.status
  const raw = await response.text().catch(() => '')
  try {
    const data = JSON.parse(raw) as { error?: string; code?: string }
    if (data.error) return new ApiError(data.error, status, data.code)
  } catch {
    // not JSON
  }
  const trimmed = raw.trim().slice(0, 160)
  const fallback =
    trimmed ||
    response.statusText ||
    (status === 401
      ? 'Нет доступа к API'
      : status === 404
        ? 'API аккаунтов не найдено (нужен деплой worker)'
        : status >= 500
          ? 'Ошибка сервера'
          : 'Ошибка API')
  return new ApiError(status ? `${fallback} (${status})` : fallback, status)
}

function toAuthError(error: unknown): never {
  if (error instanceof AuthError) throw error
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === 'needs_password') {
      throw new AuthError(error.message, error.code === 'needs_password' ? 'missing' : 'invalid')
    }
    throw new AuthError(error.message, 'invalid')
  }
  if (error instanceof TypeError) {
    throw new AuthError('Нет связи с сервером аккаунтов', 'invalid')
  }
  throw error
}

export interface SessionPayload {
  token: string
  accountId: string
  expiresAt: number
}

export interface AuthResponse {
  account: AccountRecord
  accounts: AccountRecord[]
  session: SessionPayload
}

function persistSession(session: SessionPayload): ClientSession {
  const next: ClientSession = {
    token: session.token,
    accountId: session.accountId,
    expiresAt: session.expiresAt,
  }
  saveClientSession(next)
  return next
}

export async function listAccounts(): Promise<AccountRecord[]> {
  try {
    const response = await fetch(apiUrl(ACCOUNTS_PATH), { headers: authHeaders() })
    if (!response.ok) throw await readError(response)
    const data = (await response.json()) as { accounts: AccountRecord[] }
    return Array.isArray(data.accounts) ? data.accounts : []
  } catch (error) {
    return toAuthError(error)
  }
}

export async function createAccountRemote(name: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(apiUrl(ACCOUNTS_PATH), {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ name, password }),
    })
    if (!response.ok) throw await readError(response)
    const data = (await response.json()) as AuthResponse
    persistSession(data.session)
    return data
  } catch (error) {
    return toAuthError(error)
  }
}

export async function loginAccountRemote(accountId: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(apiUrl(`${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}/login`), {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!response.ok) throw await readError(response)
    const data = (await response.json()) as AuthResponse
    persistSession(data.session)
    return data
  } catch (error) {
    return toAuthError(error)
  }
}

export async function setPasswordRemote(
  accountId: string,
  currentPassword: string | null,
  newPassword: string,
): Promise<AuthResponse> {
  try {
    const response = await fetch(
      apiUrl(`${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}/password`),
      {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    )
    if (!response.ok) throw await readError(response)
    const data = (await response.json()) as AuthResponse
    persistSession(data.session)
    return data
  } catch (error) {
    return toAuthError(error)
  }
}

export async function renameAccountRemote(accountId: string, name: string): Promise<AccountRecord[]> {
  const session = loadClientSession()
  try {
    const response = await fetch(apiUrl(`${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}`), {
      method: 'PATCH',
      headers: {
        ...authHeaders(session?.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) throw await readError(response)
    const data = (await response.json()) as { accounts: AccountRecord[] }
    return data.accounts
  } catch (error) {
    return toAuthError(error)
  }
}

export async function deleteAccountRemote(accountId: string, password: string): Promise<AccountRecord[]> {
  const session = loadClientSession()
  try {
    const response = await fetch(apiUrl(`${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}`), {
      method: 'DELETE',
      headers: {
        ...authHeaders(session?.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ password }),
    })
    if (!response.ok) throw await readError(response)
    if (session?.accountId === accountId) clearClientSession()
    const data = (await response.json()) as { accounts: AccountRecord[] }
    return data.accounts
  } catch (error) {
    return toAuthError(error)
  }
}

export async function fetchAccountState(accountId: string): Promise<string | null> {
  const session = loadClientSession()
  if (!session || session.accountId !== accountId) {
    throw new AuthError('Нет активной сессии', 'missing')
  }
  const response = await fetch(
    apiUrl(`${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}/state`),
    { headers: authHeaders(session.token) },
  )
  if (response.status === 404) return null
  if (!response.ok) throw await readError(response)
  return response.text()
}

export async function putAccountState(accountId: string, rawJson: string): Promise<void> {
  const session = loadClientSession()
  if (!session || session.accountId !== accountId) {
    throw new AuthError('Нет активной сессии', 'missing')
  }
  const response = await fetch(
    apiUrl(`${ACCOUNTS_PATH}/${encodeURIComponent(accountId)}/state`),
    {
      method: 'PUT',
      headers: {
        ...authHeaders(session.token),
        'content-type': 'application/json; charset=utf-8',
      },
      body: rawJson,
    },
  )
  if (!response.ok) throw await readError(response)
}

export async function logoutRemote(): Promise<void> {
  const session = loadClientSession()
  try {
    if (session) {
      await fetch(apiUrl('/api/session/logout'), {
        method: 'POST',
        headers: authHeaders(session.token),
      })
    }
  } catch {
    // ignore network
  } finally {
    clearClientSession()
  }
}
