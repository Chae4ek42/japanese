import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

globalThis.window = { localStorage: createLocalStorageMock() }

const { createDefaultAppState, loadAppState, resetStoredState, saveAppState } = await import(
  '../../src/lib/storage.js'
)

const STORAGE_KEY = 'kana-trainer-state-v1'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('без сохранения возвращает дефолтное состояние версии 8', () => {
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 8)
    assert.equal(state.numbers.preferences.mode, 'plain')
    assert.equal(state.numbers.preferences.rangeId, '99')
    assert.equal(state.numbers.preferences.pickMode, 'adaptive')
    assert.deepEqual(state.numbers.stats, {})
  })

  it('сохранение и загрузка проходят круг', () => {
    const state = createDefaultAppState()
    state.numbers.preferences.mode = 'age'
    state.numbers.preferences.rangeId = '10'
    state.numbers.stats['age:5'] = { exposures: 3, mastery: 0.4 }
    saveAppState(state)

    const loaded = loadAppState(createDefaultAppState)
    assert.equal(loaded.numbers.preferences.mode, 'age')
    assert.equal(loaded.numbers.preferences.rangeId, '10')
    assert.equal(loaded.numbers.stats['age:5'].exposures, 3)
  })

  it('мигрирует старое состояние, оставляя только блок numbers', () => {
    const legacy = {
      version: 7,
      preferences: { scriptMode: 'katakana' },
      stats: { 'katakana:shi': { clears: 7 } },
      words: { dictionary: ['w1'] },
      numbers: {
        preferences: { mode: 'age', rangeId: '99', pickMode: 'even' },
        stats: { 'age:20': { hints: 2 } },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 8)
    assert.equal(state.numbers.preferences.mode, 'age')
    assert.equal(state.numbers.preferences.pickMode, 'even')
    assert.equal(state.numbers.stats['age:20'].hints, 2)
    assert.equal(state.preferences, undefined)
    assert.equal(state.words, undefined)
  })

  it('битые данные не роняют приложение', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken json')
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 8)
  })

  it('reset удаляет сохранение', async () => {
    saveAppState(createDefaultAppState())
    await resetStoredState()
    assert.equal(window.localStorage.getItem(STORAGE_KEY), null)
  })
})
