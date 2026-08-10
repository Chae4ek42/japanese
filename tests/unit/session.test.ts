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

const {
  SESSION_KEY,
  clearClientSession,
  loadClientSession,
  saveClientSession,
} = await import('../../src/shared/lib/session.ts')

describe('client session', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('сохраняет и читает session', () => {
    saveClientSession({
      token: 'tok',
      accountId: 'acc_1',
      expiresAt: Date.now() + 60_000,
    })
    const loaded = loadClientSession()
    assert.equal(loaded?.token, 'tok')
    assert.equal(loaded?.accountId, 'acc_1')
    assert.ok(window.localStorage.getItem(SESSION_KEY))
  })

  it('истекающую session удаляет', () => {
    saveClientSession({
      token: 'tok',
      accountId: 'acc_1',
      expiresAt: Date.now() - 1,
    })
    assert.equal(loadClientSession(), null)
    assert.equal(window.localStorage.getItem(SESSION_KEY), null)
  })

  it('clearClientSession чистит ключ', () => {
    saveClientSession({
      token: 'tok',
      accountId: 'acc_1',
      expiresAt: Date.now() + 60_000,
    })
    clearClientSession()
    assert.equal(loadClientSession(), null)
  })
})
