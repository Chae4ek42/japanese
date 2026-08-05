interface Env {
  APP_STATE: KVNamespace
  ASSETS: Fetcher
  /** Optional shared secret. When set, require `Authorization: Bearer <token>`. */
  STATE_AUTH?: string
}

const STATE_KEY = 'app-state'
const MAX_BYTES = 20_000_000

function jsonResponse(body: string | null, status: number): Response {
  if (body === null) {
    return new Response(null, { status })
  }
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function authorized(request: Request, env: Env): boolean {
  if (!env.STATE_AUTH) return true
  return request.headers.get('Authorization') === `Bearer ${env.STATE_AUTH}`
}

async function handleState(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env)) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (request.method === 'GET') {
    const raw = await env.APP_STATE.get(STATE_KEY)
    if (!raw) return jsonResponse(null, 404)
    return jsonResponse(raw, 200)
  }

  if (request.method === 'PUT') {
    const body = await request.text()
    if (body.length > MAX_BYTES) {
      return new Response('Payload too large', { status: 413 })
    }
    try {
      JSON.parse(body)
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }
    await env.APP_STATE.put(STATE_KEY, body)
    return new Response(null, { status: 204 })
  }

  if (request.method === 'DELETE') {
    await env.APP_STATE.delete(STATE_KEY)
    return new Response(null, { status: 204 })
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT, DELETE' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/state') {
      return handleState(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}
