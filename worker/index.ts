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
  accountStateKey,
  createSession,
  defaultAccountName,
  deleteSession,
  ensureLegacyMigrated,
  loadMeta,
  publicAccount,
  readSession,
  sanitizeName,
  saveMeta,
  touchSession,
  type StoredAccount,
} from './store'

interface Env {
  APP_STATE: KVNamespace
  ASSETS: Fetcher
  /** Optional shared secret. When set, require `Authorization: Bearer <token>`. */
  STATE_AUTH?: string
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

function text(body: string, status: number): Response {
  return new Response(body, { status })
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
  if (!token) return text('Unauthorized', 401)
  const session = await readSession(env.APP_STATE, token)
  if (!session) return text('Unauthorized', 401)
  if (session.accountId !== accountId) return text('Forbidden', 403)
  await touchSession(env.APP_STATE, token, session)
  return { token }
}

async function parseJson(request: Request): Promise<unknown | Response> {
  try {
    return await request.json()
  } catch {
    return text('Invalid JSON', 400)
  }
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!deployAuthorized(request, env)) {
    return text('Unauthorized', 401)
  }

  await ensureLegacyMigrated(env.APP_STATE)
  const parts = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/api/session/logout' && request.method === 'POST') {
    await deleteSession(env.APP_STATE, request.headers.get('X-Account-Session'))
    return new Response(null, { status: 204 })
  }

  // GET/POST /api/accounts
  if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'accounts') {
    if (request.method === 'GET') {
      const meta = await loadMeta(env.APP_STATE)
      return json({ accounts: meta.accounts.map(publicAccount) })
    }
    if (request.method === 'POST') {
      const body = await parseJson(request)
      if (body instanceof Response) return body
      const data = body as { name?: string; password?: string }
      const password = typeof data.password === 'string' ? data.password : ''
      const pwErr = validatePassword(password)
      if (pwErr) return json({ error: pwErr }, 400)
      const meta = await loadMeta(env.APP_STATE)
      const name = sanitizeName(
        typeof data.name === 'string' ? data.name : '',
        defaultAccountName(meta.accounts),
      )
      const { salt, hash } = await hashPassword(password)
      const account: StoredAccount = {
        id: newId('acc'),
        name,
        createdAt: Date.now(),
        passwordSalt: salt,
        passwordHash: hash,
      }
      meta.accounts.push(account)
      await saveMeta(env.APP_STATE, meta)
      const token = newSessionToken()
      const session = await createSession(env.APP_STATE, account.id, token)
      return json(
        {
          account: publicAccount(account),
          accounts: meta.accounts.map(publicAccount),
          session: { token, accountId: account.id, expiresAt: session.expiresAt },
        },
        201,
      )
    }
    return text('Method Not Allowed', 405)
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
      const meta = await loadMeta(env.APP_STATE)
      const account = meta.accounts.find((item) => item.id === accountId)
      if (!account) return json({ error: 'Аккаунт не найден' }, 404)
      if (!accountHasPassword(account)) {
        return json({ error: 'Сначала задайте пароль', code: 'needs_password' }, 400)
      }
      const ok = await verifyPassword(password, account.passwordSalt!, account.passwordHash!)
      if (!ok) return json({ error: 'Неверный пароль' }, 401)
      const token = newSessionToken()
      const session = await createSession(env.APP_STATE, account.id, token)
      return json({
        account: publicAccount(account),
        accounts: meta.accounts.map(publicAccount),
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
      const meta = await loadMeta(env.APP_STATE)
      const account = meta.accounts.find((item) => item.id === accountId)
      if (!account) return json({ error: 'Аккаунт не найден' }, 404)

      if (accountHasPassword(account)) {
        const current = typeof data.currentPassword === 'string' ? data.currentPassword : ''
        const ok = await verifyPassword(current, account.passwordSalt!, account.passwordHash!)
        if (!ok) return json({ error: 'Неверный пароль' }, 401)
      }

      const { salt, hash } = await hashPassword(newPassword)
      account.passwordSalt = salt
      account.passwordHash = hash
      await saveMeta(env.APP_STATE, meta)

      const token = newSessionToken()
      const session = await createSession(env.APP_STATE, account.id, token)
      return json({
        account: publicAccount(account),
        accounts: meta.accounts.map(publicAccount),
        session: { token, accountId: account.id, expiresAt: session.expiresAt },
      })
    }

    if (action === 'state') {
      const auth = await requireAccountSession(request, env, accountId)
      if (auth instanceof Response) return auth

      if (request.method === 'GET') {
        const raw = await env.APP_STATE.get(accountStateKey(accountId))
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
        if (body.length > MAX_STATE_BYTES) return text('Payload too large', 413)
        try {
          JSON.parse(body)
        } catch {
          return text('Invalid JSON', 400)
        }
        await env.APP_STATE.put(accountStateKey(accountId), body)
        return new Response(null, { status: 204 })
      }
      return text('Method Not Allowed', 405)
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
        const meta = await loadMeta(env.APP_STATE)
        const account = meta.accounts.find((item) => item.id === accountId)
        if (!account) return json({ error: 'Аккаунт не найден' }, 404)
        account.name = name
        await saveMeta(env.APP_STATE, meta)
        return json({
          account: publicAccount(account),
          accounts: meta.accounts.map(publicAccount),
        })
      }

      if (request.method === 'DELETE') {
        const body = await parseJson(request)
        if (body instanceof Response) return body
        const password =
          typeof (body as { password?: string }).password === 'string'
            ? (body as { password: string }).password
            : ''
        const meta = await loadMeta(env.APP_STATE)
        const account = meta.accounts.find((item) => item.id === accountId)
        if (!account) return json({ error: 'Аккаунт не найден' }, 404)
        if (accountHasPassword(account)) {
          const ok = await verifyPassword(password, account.passwordSalt!, account.passwordHash!)
          if (!ok) return json({ error: 'Неверный пароль' }, 401)
        }
        meta.accounts = meta.accounts.filter((item) => item.id !== accountId)
        await saveMeta(env.APP_STATE, meta)
        await env.APP_STATE.delete(accountStateKey(accountId))
        await deleteSession(env.APP_STATE, request.headers.get('X-Account-Session'))
        return json({ accounts: meta.accounts.map(publicAccount) })
      }

      return text('Method Not Allowed', 405)
    }
  }

  return text('Not Found', 404)
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
