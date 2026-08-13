import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  sanitizeReaderState,
  sanitizeReaderSavedText,
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
})
