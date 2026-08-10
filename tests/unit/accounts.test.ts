import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
  }
}

globalThis.window = {
  localStorage: createLocalStorageMock(),
  location: { origin: 'http://localhost' },
} as Window & typeof globalThis

const { accountHasPassword, defaultAccountName } = await import('../../src/shared/lib/accounts.ts')
const { saveClientSession, clearClientSession } = await import('../../src/shared/lib/session.ts')
const { createDefaultAppState } = await import('../../src/shared/lib/storage.ts')
const { bootstrapSession } = await import('../../src/shared/lib/storage.ts')

describe('accounts (server-backed)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearClientSession()
  })

  it('defaultAccountName избегает дубликатов', () => {
    assert.equal(defaultAccountName([]), 'Аккаунт')
    assert.equal(
      defaultAccountName([{ id: '1', name: 'Аккаунт', createdAt: 1, hasPassword: true }]),
      'Аккаунт 2',
    )
  })

  it('accountHasPassword смотрит на флаг', () => {
    assert.equal(accountHasPassword({ id: '1', name: 'A', createdAt: 1, hasPassword: false }), false)
    assert.equal(accountHasPassword({ id: '1', name: 'A', createdAt: 1, hasPassword: true }), true)
  })

  it('bootstrap без session → needsAccount со списком с сервера', async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      assert.match(url, /\/api\/accounts$/)
      return new Response(
        JSON.stringify({
          accounts: [{ id: 'acc_1', name: 'Аня', createdAt: 1, hasPassword: true }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    const session = await bootstrapSession()
    assert.equal(session.status, 'needsAccount')
    assert.equal(session.accounts.length, 1)
    assert.equal(session.accounts[0].name, 'Аня')
  })

  it('bootstrap с session грузит state', async () => {
    saveClientSession({
      token: 'tok',
      accountId: 'acc_1',
      expiresAt: Date.now() + 60_000,
    })
    const remoteState = createDefaultAppState()
    remoteState.vocab.myWords = ['1524720']

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.endsWith('/api/accounts') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            accounts: [{ id: 'acc_1', name: 'Аня', createdAt: 1, hasPassword: true }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/api/accounts/acc_1/state')) {
        return new Response(JSON.stringify(remoteState), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404 })
    }

    const session = await bootstrapSession()
    assert.equal(session.status, 'ready')
    if (session.status === 'ready') {
      assert.equal(session.accountId, 'acc_1')
      assert.deepEqual(session.state.vocab.myWords, ['1524720'])
    }
  })
})
