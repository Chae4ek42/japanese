import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectUnitWordIds,
  extractJapaneseTokens,
  resolveTheoryWordIds,
} from '../../src/features/theory/resolveTheoryWords'
import { getTheoryUnit } from '../../src/features/theory/units'

describe('theory word resolve', () => {
  it('резолвит これ / あそこ в id банка', () => {
    const kore = resolveTheoryWordIds({ writing: 'これ', romaji: 'kore' })
    const asoko = resolveTheoryWordIds({ writing: 'あそこ', romaji: 'asoko' })
    assert.ok(kore.length >= 1)
    assert.ok(asoko.length >= 1)
  })

  it('достаёт токены из ячеек таблицы', () => {
    assert.deepEqual(extractJapaneseTokens('こちら / こっち'), ['こちら', 'こっち'])
    assert.deepEqual(extractJapaneseTokens('こ · рядом со мной'), [])
  })

  it('собирает слова урока ko-so-a-do', () => {
    const unit = getTheoryUnit('ko-so-a-do')
    assert.ok(unit)
    const ids = collectUnitWordIds(unit!)
    assert.ok(ids.length >= 20, `got ${ids.length}`)
  })

  it('резолвит kana-формы あたし / あなた / どこ', () => {
    const atashi = resolveTheoryWordIds({ writing: 'あたし', romaji: 'atashi' })
    const atashiCanon = resolveTheoryWordIds({
      writing: '私',
      kana: 'あたし',
      romaji: 'atashi',
    })
    const anata = resolveTheoryWordIds({ writing: 'あなた', romaji: 'anata' })
    const doko = resolveTheoryWordIds({ writing: 'どこ', romaji: 'doko' })
    assert.ok(atashi.length >= 1, 'あたし via kana index')
    assert.ok(atashiCanon.length >= 1, '私 + あたし')
    assert.ok(anata.length >= 1, 'あなた via kana index')
    assert.ok(doko.length >= 1, 'どこ via kana index')
  })
})
