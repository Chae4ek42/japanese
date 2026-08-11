import {
  accountHasPassword,
  hashPassword,
  newId,
  newSessionToken,
  validatePassword,
  verifyPassword,
} from './auth'
import {
  MAX_STATE_BYTES,
  createSession,
  defaultAccountName,
  deleteAccount,
  deleteSession,
  ensureSchema,
  getAccount,
  getAccountState,
  insertAccount,
  listAccounts,
  migrateFromKvIfNeeded,
  publicAccount,
  putAccountState,
  readSession,
  sanitizeName,
  updateAccount,
  type StoredAccount,
} from './store'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  /** Optional shared secret. When set, require `Authorization: Bearer <token>`. */
  STATE_AUTH?: string
  /** Legacy KV — used only for one-time import into D1 if still bound. */
  APP_STATE?: KVNamespace
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function errorJson(message: string, status: number, code?: string): Response {
  return json(code ? { error: message, code } : { error: message }, status)
}

function getBearer(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

function deployAuthorized(request: Request, env: Env): boolean {
  if (!env.STATE_AUTH) return true
  return getBearer(request) === env.STATE_AUTH
}

async function requireAccountSession(
  request: Request,
  env: Env,
  accountId: string,
): Promise<{ token: string } | Response> {
  const token = request.headers.get('X-Account-Session')?.trim() || null
  if (!token) return errorJson('Нужна сессия аккаунта', 401)
  const session = await readSession(env.DB, token)
  if (!session) return errorJson('Сессия истекла, войдите снова', 401)
  if (session.accountId !== accountId) return errorJson('Чужой аккаунт', 403)
  return { token }
}

async function parseJson(request: Request): Promise<unknown | Response> {
  try {
    return await request.json()
  } catch {
    return errorJson('Invalid JSON', 400)
  }
}

async function prepareDb(env: Env): Promise<void> {
  await ensureSchema(env.DB)
  await migrateFromKvIfNeeded(env.DB, env.APP_STATE)
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    return await handleApiInner(request, env, url)
  } catch (error) {
    console.error('[api]', error)
    const message = error instanceof Error ? error.message : 'Ошибка сервера'
    return errorJson(message, 500)
  }
}

async function handleApiInner(request: Request, env: Env, url: URL): Promise<Response> {
  if (!deployAuthorized(request, env)) {
    return errorJson('Нет доступа к API (проверьте STATE_AUTH)', 401)
  }

  await prepareDb(env)
  const parts = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/api/session/logout' && request.method === 'POST') {
    await deleteSession(env.DB, request.headers.get('X-Account-Session'))
    return new Response(null, { status: 204 })
  }

  // GET/POST /api/accounts
  if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'accounts') {
    if (request.method === 'GET') {
      const accounts = await listAccounts(env.DB)
      return json({ accounts: accounts.map(publicAccount) })
    }
    if (request.method === 'POST') {
      const body = await parseJson(request)
      if (body instanceof Response) return body
      const data = body as { name?: string; password?: string }
      const password = typeof data.password === 'string' ? data.password : ''
      const pwErr = validatePassword(password)
      if (pwErr) return json({ error: pwErr }, 400)
      const accounts = await listAccounts(env.DB)
      const name = sanitizeName(
        typeof data.name === 'string' ? data.name : '',
        defaultAccountName(accounts),
      )
      const { salt, hash } = await hashPassword(password)
      const account: StoredAccount = {
        id: newId('acc'),
        name,
        createdAt: Date.now(),
        passwordSalt: salt,
        passwordHash: hash,
      }
      await insertAccount(env.DB, account)
      const token = newSessionToken()
      const session = await createSession(env.DB, account.id, token)
      const nextAccounts = await listAccounts(env.DB)
      return json(
        {
          account: publicAccount(account),
          accounts: nextAccounts.map(publicAccount),
          session: { token, accountId: account.id, expiresAt: session.expiresAt },
        },
        201,
      )
    }
    return errorJson('Method Not Allowed', 405)
  }

  if (parts.length >= 3 && parts[0] === 'api' && parts[1] === 'accounts') {
    const accountId = parts[2]!
    const action = parts[3]

    if (action === 'login' && request.method === 'POST') {
      const body = await parseJson(request)
      if (body instanceof Response) return body
      const password =
        typeof (body as { password?: string }).password === 'string'
          ? (body as { password: string }).password
          : ''
      const account = await getAccount(env.DB, accountId)
      if (!account) return json({ error: 'Аккаунт не найден' }, 404)
      if (!accountHasPassword(account)) {
        return json({ error: 'Сначала задайте пароль', code: 'needs_password' }, 400)
      }
      const ok = await verifyPassword(password, account.passwordSalt!, account.passwordHash!)
      if (!ok) return json({ error: 'Неверный пароль' }, 401)
      const token = newSessionToken()
      const session = await createSession(env.DB, account.id, token)
      const accounts = await listAccounts(env.DB)
      return json({
        account: publicAccount(account),
        accounts: accounts.map(publicAccount),
        session: { token, accountId: account.id, expiresAt: session.expiresAt },
      })
    }

    if (action === 'password' && request.method === 'POST') {
      const body = await parseJson(request)
      if (body instanceof Response) return body
      const data = body as { currentPassword?: string | null; newPassword?: string }
      const newPassword = typeof data.newPassword === 'string' ? data.newPassword : ''
      const pwErr = validatePassword(newPassword)
      if (pwErr) return json({ error: pwErr }, 400)
      const account = await getAccount(env.DB, accountId)
      if (!account) return json({ error: 'Аккаунт не найден' }, 404)

      if (accountHasPassword(account)) {
        const current = typeof data.currentPassword === 'string' ? data.currentPassword : ''
        const ok = await verifyPassword(current, account.passwordSalt!, account.passwordHash!)
        if (!ok) return json({ error: 'Неверный пароль' }, 401)
      }

      const { salt, hash } = await hashPassword(newPassword)
      account.passwordSalt = salt
      account.passwordHash = hash
      await updateAccount(env.DB, account)

      const token = newSessionToken()
      const session = await createSession(env.DB, account.id, token)
      const accounts = await listAccounts(env.DB)
      return json({
        account: publicAccount(account),
        accounts: accounts.map(publicAccount),
        session: { token, accountId: account.id, expiresAt: session.expiresAt },
      })
    }

    if (action === 'state') {
      const auth = await requireAccountSession(request, env, accountId)
      if (auth instanceof Response) return auth

      if (request.method === 'GET') {
        const raw = await getAccountState(env.DB, accountId)
        if (!raw) return json(null, 404)
        return new Response(raw, {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        })
      }

      if (request.method === 'PUT') {
        const body = await request.text()
        if (body.length > MAX_STATE_BYTES) return errorJson('Payload too large', 413)
        try {
          JSON.parse(body)
        } catch {
          return errorJson('Invalid JSON', 400)
        }
        const account = await getAccount(env.DB, accountId)
        if (!account) return json({ error: 'Аккаунт не найден' }, 404)
        await putAccountState(env.DB, accountId, body)
        return new Response(null, { status: 204 })
      }
      return errorJson('Method Not Allowed', 405)
    }

    if (!action) {
      if (request.method === 'PATCH') {
        const auth = await requireAccountSession(request, env, accountId)
        if (auth instanceof Response) return auth
        const body = await parseJson(request)
        if (body instanceof Response) return body
        const name = sanitizeName(
          typeof (body as { name?: string }).name === 'string'
            ? (body as { name: string }).name
            : '',
        )
        const account = await getAccount(env.DB, accountId)
        if (!account) return json({ error: 'Аккаунт не найден' }, 404)
        account.name = name
        await updateAccount(env.DB, account)
        const accounts = await listAccounts(env.DB)
        return json({
          account: publicAccount(account),
          accounts: accounts.map(publicAccount),
        })
      }

      if (request.method === 'DELETE') {
        const body = await parseJson(request)
        if (body instanceof Response) return body
        const password =
          typeof (body as { password?: string }).password === 'string'
            ? (body as { password: string }).password
            : ''
        const account = await getAccount(env.DB, accountId)
        if (!account) return json({ error: 'Аккаунт не найден' }, 404)
        if (accountHasPassword(account)) {
          const ok = await verifyPassword(password, account.passwordSalt!, account.passwordHash!)
          if (!ok) return json({ error: 'Неверный пароль' }, 401)
        }
        await deleteAccount(env.DB, accountId)
        await deleteSession(env.DB, request.headers.get('X-Account-Session'))
        const accounts = await listAccounts(env.DB)
        return json({ accounts: accounts.map(publicAccount) })
      }

      return errorJson('Method Not Allowed', 405)
    }
  }

  return errorJson('Not Found', 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url)
    }
    return env.ASSETS.fetch(request)
  },
}
