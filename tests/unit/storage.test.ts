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
  bootstrapAppState,
  createDefaultAppState,
  loadAppState,
  parseStoredState,
  resetStoredState,
  saveAppState,
} = await import('../../src/shared/lib/storage')
const { CURRENT_VERSION } = await import('../../src/shared/state/app-state')
const { createStatsRecord } = await import('../../src/shared/lib/trainer')
const { ALL_CARD_IDS } = await import('../../src/data/kana')
const { saveClientSession, clearClientSession } = await import('../../src/shared/lib/session')

function seedSession(accountId = 'acc_test') {
  saveClientSession({
    token: 'tok',
    accountId,
    expiresAt: Date.now() + 60_000,
  })
  return accountId
}

describe('storage', () => {
  let remoteState: string | null = null

  beforeEach(() => {
    window.localStorage.clear()
    clearClientSession()
    remoteState = null
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.includes('/api/accounts') && !url.includes('/state') && method === 'GET') {
        return new Response(
          JSON.stringify({
            accounts: [{ id: 'acc_test', name: 'Тест', createdAt: 1, hasPassword: true }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/state')) {
        if (method === 'GET') {
          if (!remoteState) return new Response(null, { status: 404 })
          return new Response(remoteState, {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        if (method === 'PUT') {
          remoteState = String(init?.body ?? '')
          return new Response(null, { status: 204 })
        }
      }
      return new Response('nope', { status: 404 })
    }
  })

  it('без сохранения возвращает дефолтное состояние', () => {
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, CURRENT_VERSION)
    assert.equal(state.kana.preferences.mode, 'adaptive')
    assert.equal(Object.keys(state.kana.stats).length, ALL_CARD_IDS.length)
    assert.deepEqual(state.vocab.myWords, [])
  })

  it('сохранение и загрузка через API проходят круг', async () => {
    seedSession()
    const state = createDefaultAppState()
    state.numbers.preferences.mode = 'age'
    state.numbers.stats['age:5'] = { ...createStatsRecord(), exposures: 3, mastery: 0.4 }
    state.kana.stats['hiragana:a'].clears = 5
    state.vocab.myWords = ['1524720']
    await saveAppState(state)

    const loaded = await bootstrapAppState()
    assert.equal(loaded.numbers.preferences.mode, 'age')
    assert.equal(loaded.numbers.stats['age:5'].exposures, 3)
    assert.equal(loaded.kana.stats['hiragana:a'].clears, 5)
    assert.deepEqual(loaded.vocab.myWords, ['1524720'])
    assert.ok(remoteState)
  })

  it('мигрирует v10, вкладывая kana', () => {
    const legacy = {
      version: 10,
      preferences: { scriptMode: 'katakana', mode: 'even' },
      stats: { 'katakana:shi': { clears: 7 } },
      history: { daily: {}, confusions: {}, recent: [] },
      numbers: {
        preferences: { mode: 'plain', rangeId: '10', pickMode: 'adaptive' },
        stats: {},
      },
      kanji: { learned: ['日'], preferences: { complexityFilter: false } },
    }
    const state = parseStoredState(JSON.stringify(legacy))
    assert.equal(state.version, CURRENT_VERSION)
    assert.equal(state.kana.preferences.scriptMode, 'katakana')
    assert.equal(state.kana.stats['katakana:shi'].clears, 7)
  })

  it('v20: явный newWordLimit 0 сохраняется как 0 новых', async () => {
    seedSession()
    const state = createDefaultAppState()
    state.vocab.preferences.newWordLimit = 0
    await saveAppState(state)
    const loaded = await bootstrapAppState()
    assert.equal(loaded.vocab.preferences.newWordLimit, 0)
  })

  it('битые данные не роняют приложение', () => {
    const state = parseStoredState('{broken json')
    assert.equal(state.version, CURRENT_VERSION)
  })

  it('reset сбрасывает прогресс активного аккаунта', async () => {
    seedSession()
    const dirty = createDefaultAppState()
    dirty.vocab.myWords = ['1524720']
    await saveAppState(dirty)
    await resetStoredState()
    const loaded = await bootstrapAppState()
    assert.deepEqual(loaded.vocab.myWords, [])
  })

  it('без session save не пишет', async () => {
    const state = createDefaultAppState()
    state.vocab.myWords = ['1524720']
    await saveAppState(state)
    assert.equal(remoteState, null)
  })

  it('повторное сохранение без изменений не делает PUT', async () => {
    const accountId = seedSession('acc_dedupe')
    let putCount = 0
    const prevFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.includes('/state') && method === 'PUT') putCount += 1
      return prevFetch(input, init)
    }
    const state = createDefaultAppState()
    state.vocab.myWords = ['1']
    await saveAppState(state, accountId, { force: true })
    await saveAppState(state, accountId)
    assert.equal(putCount, 1)
  })
})
