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

let sharedRaw: string | null = null

globalThis.window = { localStorage: createLocalStorageMock() } as Window & typeof globalThis
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (!url.includes('/api/app-state')) {
    return new Response('not found', { status: 404 })
  }
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET') {
    if (!sharedRaw) return new Response(null, { status: 204 })
    return new Response(sharedRaw, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (method === 'PUT' || method === 'POST') {
    sharedRaw = String(init?.body ?? '')
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  if (method === 'DELETE') {
    sharedRaw = null
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  return new Response('no', { status: 405 })
}) as typeof fetch

const {
  bootstrapAppState,
  createDefaultAppState,
  loadAppState,
  parseStoredState,
  resetStoredState,
  saveAppState,
} = await import('../../src/shared/lib/storage')
const { createStatsRecord } = await import('../../src/shared/lib/trainer')
const { ALL_CARD_IDS } = await import('../../src/data/kana')

describe('storage', () => {
  beforeEach(() => {
    sharedRaw = null
    window.localStorage.clear()
  })

  it('без сохранения возвращает дефолтное состояние', () => {
    const state = loadAppState(createDefaultAppState)
    assert.equal(state.version, 20)
    assert.equal(state.kana.preferences.mode, 'adaptive')
    assert.equal(state.numbers.preferences.mode, 'plain')
    assert.equal(state.numbers.preferences.rangeId, '99')
    assert.equal(Object.keys(state.kana.stats).length, ALL_CARD_IDS.length)
    assert.deepEqual(state.numbers.stats, {})
    assert.deepEqual(state.kanji.learned, [])
    assert.equal(state.kanji.preferences.complexityFilter, true)
    assert.deepEqual(state.kanji.preferences.hiddenWordsByKanji, {})
    assert.deepEqual(state.context.knownWordIds, [])
    assert.ok(state.context.knownGrammarIds.includes('copula_desu'))
    assert.equal(state.context.preferences.groupId, 'family')
    assert.equal(state.context.preferences.batchSize, 3)
    assert.equal(state.context.preferences.maxNewPerSentence, 1)
    assert.equal(state.context.session, null)
    assert.deepEqual(state.context.trainingLog, [])
    assert.deepEqual(state.vocab.myWords, [])
    assert.deepEqual(state.vocab.customWords, {})
    assert.equal(state.vocab.preferences.drillMode, 'romaji')
    assert.deepEqual(state.vocab.stats, {})
  })

  it('сохранение и загрузка через shared API проходят круг', async () => {
    const state = createDefaultAppState()
    state.numbers.preferences.mode = 'age'
    state.numbers.preferences.rangeId = '10'
    state.numbers.stats['age:5'] = { ...createStatsRecord(), exposures: 3, mastery: 0.4 }
    state.kana.stats['hiragana:a'].clears = 5
    state.kanji.learned = ['日', '本']
    state.kanji.preferences.complexityFilter = false
    state.vocab.myWords = ['1524720', 'custom:test-1']
    state.vocab.customWords = {
      'custom:test-1': {
        id: 'custom:test-1',
        writing: '猫',
        kana: 'ねこ',
        romaji: 'neko',
        meanings: ['кошка'],
        kanji: ['猫'],
      },
    }
    state.vocab.preferences.drillMode = 'choice'
    state.context.knownWordIds = ['1524720']
    state.context.session = {
      groupId: 'family',
      batchIds: ['1000390'],
      pages: [
        {
          sentence: {
            id: 's1',
            text: '父です。',
            glossRu: 'Это отец.',
            wordIds: ['1000390'],
            grammarIds: ['copula_desu'],
            source: 'seed',
          },
          revealed: true,
        },
      ],
      pageIndex: 0,
      recentSentenceIds: ['s1'],
      wordsLearnedIds: [],
      startedAt: 1,
      status: 'active',
    }
    await saveAppState(state)

    const loaded = await bootstrapAppState()
    assert.equal(loaded.numbers.preferences.mode, 'age')
    assert.equal(loaded.numbers.preferences.rangeId, '10')
    assert.equal(loaded.numbers.stats['age:5'].exposures, 3)
    assert.equal(loaded.kana.stats['hiragana:a'].clears, 5)
    assert.deepEqual(loaded.kanji.learned, ['日', '本'])
    assert.equal(loaded.kanji.preferences.complexityFilter, false)
    assert.deepEqual(loaded.vocab.myWords, ['1524720', 'custom:test-1'])
    assert.equal(loaded.vocab.customWords['custom:test-1'].writing, '猫')
    assert.equal(loaded.vocab.preferences.drillMode, 'choice')
    assert.deepEqual(loaded.context.knownWordIds, ['1524720'])
    assert.equal(loaded.context.session?.pages[0]?.revealed, true)
    assert.ok(sharedRaw)
  })

  it('мигрирует legacy localStorage в shared store', async () => {
    const legacy = createDefaultAppState()
    legacy.kana.preferences.mode = 'even'
    window.localStorage.setItem('kana-trainer-state-v1', JSON.stringify(legacy))

    const state = await bootstrapAppState()
    assert.equal(state.kana.preferences.mode, 'even')
    assert.ok(sharedRaw)
    assert.equal(window.localStorage.getItem('kana-trainer-state-v1'), null)
    assert.equal(window.localStorage.getItem('jp-app-state-v1'), null)
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
    assert.equal(state.version, 20)
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
    const state = parseStoredState(JSON.stringify(legacy))
    assert.equal(state.version, 20)
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
    const state = parseStoredState(JSON.stringify(legacy))
    assert.equal(state.version, 20)
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
    const state = parseStoredState(JSON.stringify(legacy))
    assert.equal(state.version, 20)
    assert.equal(state.kana.preferences.scriptMode, 'katakana')
    assert.equal(state.kana.preferences.mode, 'even')
    assert.equal(state.kana.stats['katakana:shi'].clears, 7)
    assert.equal(state.numbers.preferences.rangeId, '10')
    assert.equal((state as unknown as Record<string, unknown>).words, undefined)
  })

  it('принимает уже вложенное состояние', () => {
    const nested = createDefaultAppState()
    nested.kana.preferences.mode = 'problem'
    nested.kana.stats['hiragana:a'].clears = 3
    nested.vocab.myWords = ['1000390']
    const state = parseStoredState(JSON.stringify(nested))
    assert.equal(state.version, 20)
    assert.equal(state.kana.preferences.mode, 'problem')
    assert.equal(state.kana.stats['hiragana:a'].clears, 3)
    assert.deepEqual(state.vocab.myWords, ['1000390'])
    assert.deepEqual(state.vocab.customWords, {})
  })

  it('v20: старый newWordLimit 0 (без лимита) становится −1', () => {
    const legacy = createDefaultAppState()
    legacy.version = 19
    legacy.vocab.preferences.newWordLimit = 0
    const state = parseStoredState(JSON.stringify(legacy))
    assert.equal(state.version, 20)
    assert.equal(state.vocab.preferences.newWordLimit, -1)
  })

  it('v20: явный newWordLimit 0 сохраняется как 0 новых', async () => {
    const state = createDefaultAppState()
    state.vocab.preferences.newWordLimit = 0
    await saveAppState(state)
    const loaded = await bootstrapAppState()
    assert.equal(loaded.vocab.preferences.newWordLimit, 0)
  })

  it('битые данные не роняют приложение', () => {
    const state = parseStoredState('{broken json')
    assert.equal(state.version, 20)
  })

  it('reset удаляет shared сохранение', async () => {
    await saveAppState(createDefaultAppState())
    await resetStoredState()
    assert.equal(sharedRaw, null)
  })
})
