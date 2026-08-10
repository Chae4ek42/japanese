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

globalThis.window = { localStorage: createLocalStorageMock() } as Window & typeof globalThis

const {
  ACCOUNTS_META_KEY,
  LEGACY_APP_STATE_KEY,
  accountStateKey,
  createAccountRecord,
  ensureAccountsMigrated,
  loadAccountState,
  loadAccountsMeta,
  saveAccountState,
  saveAccountsMeta,
  updateAccountPassword,
} = await import('../../src/shared/lib/accounts')
const {
  bootstrapSession,
  createDefaultAppState,
  removeAccountCompletely,
  saveAppState,
} = await import('../../src/shared/lib/storage')
const { accountHasPassword, hashPassword, verifyPassword } = await import(
  '../../src/shared/lib/account-auth'
)

const FIXTURE_SALT = 'AAAAAAAAAAAAAAAAAAAAAA=='
const FIXTURE_HASH = '2jonN7v33cMAvv/2Z6Uu0R+V95oP9S8k1wiQ1sdSPD0='

describe('accounts', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('мигрирует legacy blob в «Основной» без пароля и без автологина', async () => {
    const legacy = createDefaultAppState()
    legacy.vocab.myWords = ['1524720']
    window.localStorage.setItem(LEGACY_APP_STATE_KEY, JSON.stringify(legacy))

    const meta = ensureAccountsMigrated()
    assert.equal(meta.accounts.length, 1)
    assert.equal(meta.accounts[0].name, 'Основной')
    assert.equal(meta.activeId, null)
    assert.equal(accountHasPassword(meta.accounts[0]), false)
    assert.equal(window.localStorage.getItem(LEGACY_APP_STATE_KEY), null)
    assert.deepEqual(loadAccountState(meta.accounts[0].id).vocab.myWords, ['1524720'])

    const session = await bootstrapSession()
    assert.equal(session.status, 'needsAccount')
    assert.equal(session.accounts.length, 1)
  })

  it('без legacy и без аккаунтов нужен экран выбора', async () => {
    const session = await bootstrapSession()
    assert.equal(session.status, 'needsAccount')
    assert.deepEqual(session.accounts, [])
  })

  it('createAccountRecord с хэшем сохраняет credentials', async () => {
    const { salt, hash } = await hashPassword('pass1')
    const account = createAccountRecord('Аня', [], { passwordSalt: salt, passwordHash: hash })
    const state = createDefaultAppState()
    state.kana.preferences.mode = 'even'
    saveAccountState(account.id, state)
    saveAccountsMeta({ activeId: account.id, accounts: [account] })

    const loaded = loadAccountsMeta()
    assert.equal(accountHasPassword(loaded.accounts[0]), true)
    assert.equal(await verifyPassword('pass1', loaded.accounts[0].passwordSalt!, loaded.accounts[0].passwordHash!), true)
    assert.equal(await verifyPassword('wrong', loaded.accounts[0].passwordSalt!, loaded.accounts[0].passwordHash!), false)

    const session = await bootstrapSession()
    assert.equal(session.status, 'ready')
    if (session.status === 'ready') {
      assert.equal(session.accountId, account.id)
      assert.equal(session.state.kana.preferences.mode, 'even')
      assert.equal(session.accounts[0].name, 'Аня')
    }
    assert.ok(window.localStorage.getItem(accountStateKey(account.id)))
    assert.ok(window.localStorage.getItem(ACCOUNTS_META_KEY))
  })

  it('signOut: activeId = null, state ключ остаётся', async () => {
    const account = createAccountRecord('Боб', [], {
      passwordSalt: FIXTURE_SALT,
      passwordHash: FIXTURE_HASH,
    })
    const state = createDefaultAppState()
    state.vocab.myWords = ['1000390']
    saveAccountState(account.id, state)
    saveAccountsMeta({ activeId: account.id, accounts: [account] })
    await saveAppState(state, account.id)

    saveAccountsMeta({ activeId: null, accounts: [account] })
    const session = await bootstrapSession()
    assert.equal(session.status, 'needsAccount')
    assert.equal(session.accounts.length, 1)
    assert.deepEqual(loadAccountState(account.id).vocab.myWords, ['1000390'])
  })

  it('deleteAccount удаляет ключ и сбрасывает active', () => {
    const a = createAccountRecord('A', [], {
      passwordSalt: FIXTURE_SALT,
      passwordHash: FIXTURE_HASH,
    })
    const b = createAccountRecord('B', [a], {
      passwordSalt: FIXTURE_SALT,
      passwordHash: FIXTURE_HASH,
    })
    saveAccountState(a.id, createDefaultAppState())
    saveAccountState(b.id, createDefaultAppState())
    saveAccountsMeta({ activeId: a.id, accounts: [a, b] })

    const next = removeAccountCompletely(a.id)
    assert.equal(next.activeId, null)
    assert.equal(next.accounts.length, 1)
    assert.equal(next.accounts[0].id, b.id)
    assert.equal(window.localStorage.getItem(accountStateKey(a.id)), null)
    assert.ok(window.localStorage.getItem(accountStateKey(b.id)))
  })

  it('updateAccountPassword задаёт хэш legacy-аккаунту', async () => {
    const account = createAccountRecord('Основной', [])
    saveAccountsMeta({ activeId: null, accounts: [account] })
    assert.equal(accountHasPassword(loadAccountsMeta().accounts[0]), false)

    const { salt, hash } = await hashPassword('newpass')
    updateAccountPassword(account.id, { passwordSalt: salt, passwordHash: hash })
    const loaded = loadAccountsMeta().accounts[0]
    assert.equal(accountHasPassword(loaded), true)
    assert.equal(await verifyPassword('newpass', loaded.passwordSalt!, loaded.passwordHash!), true)
  })

  it('loadAccountsMeta игнорирует битый meta', () => {
    window.localStorage.setItem(ACCOUNTS_META_KEY, '{broken')
    assert.deepEqual(loadAccountsMeta(), { activeId: null, accounts: [] })
  })
})
