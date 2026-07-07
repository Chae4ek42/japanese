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
const { DEFAULT_HYPERPARAMS } = await import('../../src/lib/trainer.js')

const STORAGE_KEY = 'kana-trainer-state-v1'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('без сохранения возвращает дефолтное состояние версии 3', () => {
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 3)
    assert.equal(state.preferences.inputMode, 'instant')
    assert.deepEqual(state.history.daily, {})
    assert.ok(state.stats['hiragana:a'])
    assert.equal(state.words.preferences.answerMode, 'reading')
    assert.equal(state.words.preferences.inputMode, 'instant')
    assert.deepEqual(state.words.favorites, [])
    assert.ok(state.words.stats['o-okane-9859876a'])
  })

  it('сохранение и загрузка проходят круг', () => {
    const state = createDefaultAppState()
    state.preferences.inputMode = 'submit'
    state.preferences.selectedGroups = ['k']
    saveAppState(state)

    const loaded = loadAppState(createDefaultAppState)
    assert.equal(loaded.preferences.inputMode, 'submit')
    assert.deepEqual(loaded.preferences.selectedGroups, ['k'])
  })

  it('мигрирует состояние версии 1', () => {
    const legacy = {
      version: 1,
      preferences: {
        scriptMode: 'katakana',
        selectedGroups: ['s'],
        mode: 'mistakes',
        retryQueueEnabled: false,
        hyperparams: { masteryGain: 0.3 },
      },
      stats: {
        'katakana:shi': { clears: 7, mastery: 0.9 },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 3)
    assert.equal(state.preferences.mode, 'adaptive', 'удаленный режим mistakes заменяется')
    assert.equal(state.preferences.scriptMode, 'katakana')
    assert.equal(state.preferences.inputMode, 'instant', 'новое поле получает дефолт')
    assert.equal(state.preferences.hyperparams.masteryGain, 0.3)
    assert.equal(state.preferences.hyperparams.targetLatencyMs, DEFAULT_HYPERPARAMS.targetLatencyMs)
    assert.equal(state.stats['katakana:shi'].clears, 7)
    assert.equal(typeof state.stats['katakana:shi'].avgLatencyMs, 'number')
    assert.deepEqual(state.history.confusions, {})
    assert.equal(state.words.preferences.answerMode, 'reading', 'блок слов добавляется при миграции')
  })

  it('избранные слова сохраняются, несуществующие id отбрасываются', () => {
    const stored = createDefaultAppState()
    stored.words.favorites = ['o-okane-9859876a', 'unknown-word']
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    const state = loadAppState(createDefaultAppState)
    assert.deepEqual(state.words.favorites, ['o-okane-9859876a'])
  })

  it('удаленный режим confusion заменяется адаптивным', () => {
    const stored = createDefaultAppState()
    stored.preferences.mode = 'confusion'
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    const state = loadAppState(createDefaultAppState)
    assert.equal(state.preferences.mode, 'adaptive')
  })

  it('битые данные не роняют приложение', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken json')
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 3)
  })

  it('reset удаляет сохранение', () => {
    saveAppState(createDefaultAppState())
    resetStoredState()
    assert.equal(window.localStorage.getItem(STORAGE_KEY), null)
  })
})
