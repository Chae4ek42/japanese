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
const { ALL_CARD_IDS } = await import('../../src/data/kana.js')

const STORAGE_KEY = 'kana-trainer-state-v1'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('без сохранения возвращает дефолтное состояние версии 10', () => {
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 10)
    assert.equal(state.preferences.mode, 'adaptive')
    assert.equal(state.numbers.preferences.mode, 'plain')
    assert.equal(state.numbers.preferences.rangeId, '99')
    assert.equal(Object.keys(state.stats).length, ALL_CARD_IDS.length)
    assert.deepEqual(state.numbers.stats, {})
    assert.deepEqual(state.kanji.learned, [])
    assert.equal(state.kanji.preferences.complexityFilter, true)
  })

  it('сохранение и загрузка проходят круг', () => {
    const state = createDefaultAppState()
    state.numbers.preferences.mode = 'age'
    state.numbers.preferences.rangeId = '10'
    state.numbers.stats['age:5'] = { exposures: 3, mastery: 0.4 }
    state.stats['hiragana:a'].clears = 5
    state.kanji.learned = ['日', '本']
    state.kanji.preferences.complexityFilter = false
    saveAppState(state)

    const loaded = loadAppState(createDefaultAppState)
    assert.equal(loaded.numbers.preferences.mode, 'age')
    assert.equal(loaded.numbers.preferences.rangeId, '10')
    assert.equal(loaded.numbers.stats['age:5'].exposures, 3)
    assert.equal(loaded.stats['hiragana:a'].clears, 5)
    assert.deepEqual(loaded.kanji.learned, ['日', '本'])
    assert.equal(loaded.kanji.preferences.complexityFilter, false)
  })

  it('мигрирует v8, добавляя кана и сохраняя numbers', () => {
    const legacy = {
      version: 8,
      numbers: {
        preferences: { mode: 'age', rangeId: '99', pickMode: 'even' },
        stats: { 'age:20': { hints: 2 } },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 10)
    assert.equal(state.numbers.preferences.mode, 'age')
    assert.equal(state.numbers.preferences.pickMode, 'even')
    assert.equal(state.numbers.stats['age:20'].hints, 2)
    assert.equal(state.preferences.mode, 'adaptive')
    assert.equal(state.stats['hiragana:a'].exposures, 0)
    assert.deepEqual(state.kanji.learned, [])
    assert.equal(state.words, undefined)
  })

  it('мигрирует старое состояние с кана и numbers, без words', () => {
    const legacy = {
      version: 7,
      preferences: { scriptMode: 'katakana', mode: 'even' },
      stats: { 'katakana:shi': { clears: 7 } },
      history: { daily: {}, confusions: {}, recent: [] },
      words: { dictionary: ['w1'] },
      numbers: {
        preferences: { mode: 'plain', rangeId: '10', pickMode: 'adaptive' },
        stats: {},
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 10)
    assert.equal(state.preferences.scriptMode, 'katakana')
    assert.equal(state.preferences.mode, 'even')
    assert.equal(state.stats['katakana:shi'].clears, 7)
    assert.equal(state.numbers.preferences.rangeId, '10')
    assert.equal(state.words, undefined)
  })

  it('битые данные не роняют приложение', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken json')
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 10)
  })

  it('reset удаляет сохранение', async () => {
    saveAppState(createDefaultAppState())
    await resetStoredState()
    assert.equal(window.localStorage.getItem(STORAGE_KEY), null)
  })
})
