import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_READER_STATE,
  MAX_SAVED_READER_TEXTS,
  deleteReaderText,
  duplicateReaderText,
  openReaderText,
  persistReaderDraft,
  renameReaderText,
  sanitizeReaderState,
  sanitizeReaderSavedText,
  startNewReaderText,
  titleFromReaderText,
} from '../../src/shared/state/slices/reader.ts'
import { createDefaultAppState, CURRENT_VERSION, normalizeAppState } from '../../src/shared/state/app-state.ts'

describe('reader saved texts', () => {
  it('собирает заголовок из начала текста', () => {
    assert.equal(titleFromReaderText('  今日は暑いです。\n明日も。'), '今日は暑いです。 明日も。')
    assert.equal(titleFromReaderText('   '), 'Текст')
  })

  it('отбрасывает пустые и чинит поля', () => {
    assert.equal(sanitizeReaderSavedText({ id: 'x', text: '   ' }), null)
    const item = sanitizeReaderSavedText({
      id: ' rt_1 ',
      text: '私は学生です。',
      createdAt: 10,
    })
    assert.ok(item)
    assert.equal(item!.id, 'rt_1')
    assert.equal(item!.title, '私は学生です。')
    assert.equal(item!.updatedAt, 10)
  })

  it('хранит пустой текст, если есть название', () => {
    const item = sanitizeReaderSavedText({ id: 'rt_empty', text: '', title: 'Урок 1' })
    assert.ok(item)
    assert.equal(item!.text, '')
    assert.equal(item!.title, 'Урок 1')
  })

  it('нормализует список и активный id', () => {
    const state = sanitizeReaderState({
      activeTextId: 'missing',
      draft: 'abc',
      texts: [
        { id: 'a', text: 'こんにちは' },
        { id: 'a', text: 'duplicate' },
        { id: 'b', text: '' },
      ],
    })
    assert.equal(state.texts.length, 1)
    assert.equal(state.texts[0]!.id, 'a')
    assert.equal(state.activeTextId, null)
    assert.equal(state.draft, 'abc')
  })

  it('старое состояние без reader поднимается до текущей версии', () => {
    const fallback = createDefaultAppState()
    const raw = { ...fallback, version: 29 } as unknown as Record<string, unknown>
    delete raw.reader
    const next = normalizeAppState(raw)
    assert.ok(next)
    assert.equal(next!.version, CURRENT_VERSION)
    assert.equal(next!.numbers.liveSession, null)
    assert.equal(next!.particles.liveSession, null)
    assert.deepEqual(next!.reader, { texts: [], activeTextId: null, draft: '' })
  })

  it('черновик сам становится текстом в библиотеке', () => {
    const next = persistReaderDraft(DEFAULT_READER_STATE, 'こんにちは', 1000)
    assert.equal(next.texts.length, 1)
    assert.equal(next.texts[0]!.text, 'こんにちは')
    assert.equal(next.texts[0]!.title, 'こんにちは')
    assert.equal(next.activeTextId, next.texts[0]!.id)
    assert.equal(next.draft, 'こんにちは')
  })

  it('правка обновляет активный текст и не затирает своё название', () => {
    let state = persistReaderDraft(DEFAULT_READER_STATE, 'hello', 1)
    state = renameReaderText(state, state.activeTextId!, 'Урок 1', 2)
    state = persistReaderDraft(state, 'hello world', 3)
    assert.equal(state.texts.length, 1)
    assert.equal(state.texts[0]!.title, 'Урок 1')
    assert.equal(state.texts[0]!.text, 'hello world')
  })

  it('автоназвание следует за началом текста', () => {
    let state = persistReaderDraft(DEFAULT_READER_STATE, '今日は暑いです。', 1)
    state = persistReaderDraft(state, '明日も暑いです。', 2)
    assert.equal(state.texts[0]!.title, '明日も暑いです。')
  })

  it('Новый оставляет текущий в библиотеке и открывает пустой лист', () => {
    let state = persistReaderDraft(DEFAULT_READER_STATE, 'one', 1)
    const first = state.activeTextId
    state = startNewReaderText(state, 'one', 2)
    assert.equal(state.activeTextId, null)
    assert.equal(state.draft, '')
    assert.equal(state.texts.length, 1)
    assert.equal(state.texts[0]!.id, first)
  })

  it('переключение сначала дописывает текущий черновик', () => {
    let state = persistReaderDraft(DEFAULT_READER_STATE, 'one', 1)
    const first = state.activeTextId!
    state = startNewReaderText(state, 'one', 2)
    state = persistReaderDraft(state, 'two', 3)
    const second = state.activeTextId
    state = openReaderText(state, first, 'two edited', 4)
    assert.equal(state.activeTextId, first)
    assert.equal(state.draft, 'one')
    const other = state.texts.find((item) => item.id === second)
    assert.equal(other?.text, 'two edited')
  })

  it('удаление активного открывает соседний текст', () => {
    let state = persistReaderDraft(DEFAULT_READER_STATE, 'one', 1)
    const first = state.activeTextId!
    state = startNewReaderText(state, 'one', 2)
    state = persistReaderDraft(state, 'two', 3)
    const second = state.activeTextId!
    state = deleteReaderText(state, second)
    assert.equal(state.activeTextId, first)
    assert.equal(state.draft, 'one')
    assert.equal(state.texts.length, 1)
  })

  it('копия добавляет новый текст с тем же содержимым', () => {
    let state = persistReaderDraft(DEFAULT_READER_STATE, '本文です。', 1)
    const original = state.activeTextId!
    state = duplicateReaderText(state, original, '本文です。', 2)
    assert.equal(state.texts.length, 2)
    assert.notEqual(state.activeTextId, original)
    assert.equal(state.draft, '本文です。')
    assert.match(state.texts[0]!.title, /копия/)
  })

  it('при лимите не создаёт новый текст и не бросает черновик', () => {
    let state = DEFAULT_READER_STATE
    for (let i = 0; i < MAX_SAVED_READER_TEXTS; i += 1) {
      state = persistReaderDraft(startNewReaderText(state, state.draft, i), `text-${i}`, i)
    }
    assert.equal(state.texts.length, MAX_SAVED_READER_TEXTS)
    const blocked = persistReaderDraft(startNewReaderText(state, state.draft, 100), 'scratch', 101)
    assert.equal(blocked.texts.length, MAX_SAVED_READER_TEXTS)
    assert.equal(blocked.activeTextId, null)
    assert.equal(blocked.draft, 'scratch')
    const stayed = startNewReaderText(blocked, 'scratch', 102)
    assert.equal(stayed.draft, 'scratch')
    assert.equal(stayed.activeTextId, null)
  })
})
