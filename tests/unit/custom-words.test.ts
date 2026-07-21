import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCustomWord,
  extractKanjiChars,
  isCustomWordId,
  parseMeaningsInput,
  resolveMyWords,
} from '../../src/features/vocab/customWords.ts'
import { buildVocabPool } from '../../src/features/vocab/pool.ts'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/app-state.ts'

describe('custom words', () => {
  it('парсит значения и кандзи', () => {
    assert.deepEqual(parseMeaningsInput('японский, японский язык; язык'), [
      'японский',
      'японский язык',
      'язык',
    ])
    assert.deepEqual(extractKanjiChars('日本語'), ['日', '本', '語'])
    assert.deepEqual(extractKanjiChars('あいう'), [])
  })

  it('собирает своё слово', () => {
    const word = buildCustomWord({
      writing: '猫',
      kana: 'ねこ',
      romaji: 'neko',
      meanings: 'кошка, кот',
    })
    assert.ok(word)
    assert.ok(isCustomWordId(word.id))
    assert.equal(word.writing, '猫')
    assert.equal(word.kana, 'ねこ')
    assert.equal(word.romaji, 'neko')
    assert.deepEqual(word.meanings, ['кошка', 'кот'])
    assert.deepEqual(word.kanji, ['猫'])
  })

  it('отклоняет неполные поля', () => {
    assert.equal(
      buildCustomWord({ writing: '猫', kana: '', romaji: 'neko', meanings: 'кошка' }),
      null,
    )
  })

  it('сохраняет id при редактировании', () => {
    const word = buildCustomWord({
      id: 'custom:fixed-id',
      writing: '犬',
      kana: 'いぬ',
      romaji: 'inu',
      meanings: 'собака',
    })
    assert.ok(word)
    assert.equal(word.id, 'custom:fixed-id')
    assert.equal(word.writing, '犬')
  })

  it('резолвит свои слова в пуле mine', () => {
    const custom = buildCustomWord({
      writing: '犬',
      kana: 'いぬ',
      romaji: 'inu',
      meanings: 'собака',
    })
    assert.ok(custom?.id)
    const resolved = resolveMyWords([custom.id], { [custom.id]: custom })
    assert.equal(resolved.length, 1)
    assert.equal(resolved[0].writing, '犬')

    const pool = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'mine' },
      [custom.id],
      { [custom.id]: custom },
    )
    assert.equal(pool.length, 1)
    assert.equal(pool[0].answers[0], 'inu')
  })
})
