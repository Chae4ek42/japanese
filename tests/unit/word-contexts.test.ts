import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { acceptsContextAnswer, contextCloze, contextSourceLabel } from '../../src/features/contexts/practice.ts'
import { readerSourceSentences } from '../../src/features/reader/contexts.ts'
import type { WordContext } from '../../src/shared/lib/types.ts'
import type { ReaderSentence } from '../../src/features/reader/analyze.ts'

const example: WordContext = { id: 'ex', wordId: 'eat', sentence: '昨日食べました。', surface: '食べました', reading: 'たべました', sourceKind: 'reader', sourceTitle: '日記 · предложение 1', createdAt: 1 }

describe('saved sentence practice', () => {
  it('accepts original surface, kana and romaji but not the dictionary form or another word', () => {
    for (const answer of ['食べました', 'たべました', 'タベマシタ', ' TABEMASHITA ']) assert.equal(acceptsContextAnswer(example, answer), true)
    for (const answer of ['食べる', 'taberu', '飲みました', '']) assert.equal(acceptsContextAnswer(example, answer), false)
  })
  it('accepts ordinary contracted romaji', () => {
    assert.equal(acceptsContextAnswer({ ...example, surface: '茶', reading: 'ちゃ' }, 'cha'), true)
  })
  it('hides all original occurrences and preserves source attribution', () => {
    assert.equal(contextCloze({ ...example, sentence: '水と水。', surface: '水' }), '［　　　］と［　　　］。')
    assert.equal(contextSourceLabel(example), 'Из вашего текста · 日記 · предложение 1')
    assert.equal(contextSourceLabel({ ...example, sourceKind: 'manual', sourceTitle: undefined }), 'Ваш пример')
  })
  it('saves exact source spans including internal whitespace, and refuses mismatched reconstruction', () => {
    const sentences = [{ id: 's1', tokens: [{ surface: '水' }, { surface: 'を' }, { surface: '飲む' }, { surface: '。' }] }, { id: 's2', tokens: [{ surface: '雨' }, { surface: '。' }] }] as ReaderSentence[]
    assert.deepEqual(readerSourceSentences('水 を飲む。\n雨。', sentences), [{ sentence: '水 を飲む。', start: 0 }, { sentence: '雨。', start: 7 }])
    assert.deepEqual(readerSourceSentences('水も飲む。', sentences), [null, null])
  })
})
