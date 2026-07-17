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

const { createDefaultAppState, loadAppState, resetStoredState, saveAppState } = await import(
  '../../src/shared/lib/storage'
)
const { createStatsRecord } = await import('../../src/shared/lib/trainer')
const { ALL_CARD_IDS } = await import('../../src/data/kana')

const STORAGE_KEY = 'jp-app-state-v1'
const LEGACY_STORAGE_KEY = 'kana-trainer-state-v1'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('без сохранения возвращает дефолтное состояние версии 13', () => {
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 13)
    assert.equal(state.kana.preferences.mode, 'adaptive')
    assert.equal(state.numbers.preferences.mode, 'plain')
    assert.equal(state.numbers.preferences.rangeId, '99')
    assert.equal(Object.keys(state.kana.stats).length, ALL_CARD_IDS.length)
    assert.deepEqual(state.numbers.stats, {})
    assert.deepEqual(state.kanji.learned, [])
    assert.equal(state.kanji.preferences.complexityFilter, true)
    assert.deepEqual(state.vocab.myWords, [])
    assert.equal(state.vocab.preferences.drillMode, 'romaji')
    assert.deepEqual(state.vocab.stats, {})
  })

  it('сохранение и загрузка проходят круг', () => {
    const state = createDefaultAppState()
    state.numbers.preferences.mode = 'age'
    state.numbers.preferences.rangeId = '10'
    state.numbers.stats['age:5'] = { ...createStatsRecord(), exposures: 3, mastery: 0.4 }
    state.kana.stats['hiragana:a'].clears = 5
    state.kanji.learned = ['日', '本']
    state.kanji.preferences.complexityFilter = false
    state.vocab.myWords = ['1524720']
    state.vocab.preferences.drillMode = 'choice'
    saveAppState(state)

    const loaded = loadAppState(createDefaultAppState)
    assert.equal(loaded.numbers.preferences.mode, 'age')
    assert.equal(loaded.numbers.preferences.rangeId, '10')
    assert.equal(loaded.numbers.stats['age:5'].exposures, 3)
    assert.equal(loaded.kana.stats['hiragana:a'].clears, 5)
    assert.deepEqual(loaded.kanji.learned, ['日', '本'])
    assert.equal(loaded.kanji.preferences.complexityFilter, false)
    assert.deepEqual(loaded.vocab.myWords, ['1524720'])
    assert.equal(loaded.vocab.preferences.drillMode, 'choice')
    assert.equal(window.localStorage.getItem(STORAGE_KEY) != null, true)
  })

  it('мигрирует legacy storage key', () => {
    const legacy = createDefaultAppState()
    legacy.kana.preferences.mode = 'even'
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.kana.preferences.mode, 'even')
    assert.equal(window.localStorage.getItem(STORAGE_KEY) != null, true)
    assert.equal(window.localStorage.getItem(LEGACY_STORAGE_KEY), null)
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 13)
    assert.equal(state.kana.preferences.scriptMode, 'katakana')
    assert.equal(state.kana.preferences.mode, 'even')
    assert.equal(state.kana.stats['katakana:shi'].clears, 7)
    assert.equal(state.numbers.preferences.rangeId, '10')
    assert.deepEqual(state.kanji.learned, ['日'])
    assert.equal(state.kanji.preferences.complexityFilter, false)
    assert.deepEqual(state.vocab.myWords, [])
    assert.equal((state as unknown as Record<string, unknown>).preferences, undefined)
  })

  it('мигрирует v11, добавляя vocab preferences', () => {
    const legacy = {
      version: 11,
      kana: {
        preferences: { scriptMode: 'hiragana', mode: 'adaptive' },
        stats: {},
        history: { daily: {}, confusions: {}, recent: [] },
      },
      numbers: {
        preferences: { mode: 'plain', rangeId: '99', pickMode: 'adaptive' },
        stats: {},
      },
      kanji: { learned: ['日'], preferences: { complexityFilter: true } },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 13)
    assert.deepEqual(state.kanji.learned, ['日'])
    assert.deepEqual(state.vocab.myWords, [])
    assert.equal(state.vocab.preferences.drillMode, 'romaji')
  })

  it('мигрирует v8, добавляя kana и сохраняя numbers', () => {
    const legacy = {
      version: 8,
      numbers: {
        preferences: { mode: 'age', rangeId: '99', pickMode: 'even' },
        stats: { 'age:20': { hints: 2 } },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 13)
    assert.equal(state.numbers.preferences.mode, 'age')
    assert.equal(state.numbers.preferences.pickMode, 'even')
    assert.equal(state.numbers.stats['age:20'].hints, 2)
    assert.equal(state.kana.preferences.mode, 'adaptive')
    assert.equal(state.kana.stats['hiragana:a'].exposures, 0)
    assert.deepEqual(state.kanji.learned, [])
    assert.equal((state as unknown as Record<string, unknown>).words, undefined)
  })

  it('мигрирует старое состояние с kana и numbers, без words', () => {
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
    assert.equal(state.version, 13)
    assert.equal(state.kana.preferences.scriptMode, 'katakana')
    assert.equal(state.kana.preferences.mode, 'even')
    assert.equal(state.kana.stats['katakana:shi'].clears, 7)
    assert.equal(state.numbers.preferences.rangeId, '10')
    assert.equal((state as unknown as Record<string, unknown>).words, undefined)
  })

  it('принимает уже вложенное v13', () => {
    const nested = createDefaultAppState()
    nested.kana.preferences.mode = 'problem'
    nested.kana.stats['hiragana:a'].clears = 3
    nested.vocab.myWords = ['1000390']
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nested))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 13)
    assert.equal(state.kana.preferences.mode, 'problem')
    assert.equal(state.kana.stats['hiragana:a'].clears, 3)
    assert.deepEqual(state.vocab.myWords, ['1000390'])
  })

  it('битые данные не роняют приложение', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken json')
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 13)
  })

  it('reset удаляет сохранение', async () => {
    saveAppState(createDefaultAppState())
    await resetStoredState()
    assert.equal(window.localStorage.getItem(STORAGE_KEY), null)
    assert.equal(window.localStorage.getItem(LEGACY_STORAGE_KEY), null)
  })
})
