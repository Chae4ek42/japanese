import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hiraganaToKatakana,
  kanaToRomaji,
  kanaToRomajiVariants,
  katakanaToHiragana,
} from '../../src/lib/romaji.js'

describe('hiraganaToKatakana', () => {
  it('конвертирует хирагану, не трогая остальное', () => {
    assert.equal(hiraganaToKatakana('おかね'), 'オカネ')
    assert.equal(hiraganaToKatakana('きょう'), 'キョウ')
    assert.equal(hiraganaToKatakana('テレビ'), 'テレビ')
  })

  it('обратная конвертация', () => {
    assert.equal(katakanaToHiragana('オカネ'), 'おかね')
  })
})

describe('kanaToRomaji', () => {
  it('базовые слоги', () => {
    assert.equal(kanaToRomaji('おかね'), 'okane')
    assert.equal(kanaToRomaji('わたし'), 'watashi')
  })

  it('ёон (digraphs)', () => {
    assert.equal(kanaToRomaji('きょう'), 'kyou')
    assert.equal(kanaToRomaji('しゃしん'), 'shashin')
    assert.equal(kanaToRomaji('ぎゅうにゅう'), 'gyuunyuu')
  })

  it('сокуон (っ) удваивает согласную', () => {
    assert.equal(kanaToRomaji('きっぷ'), 'kippu')
    assert.equal(kanaToRomaji('がっこう'), 'gakkou')
    assert.equal(kanaToRomaji('まっちゃ'), 'ccha'.replace('ccha', 'maccha'))
  })

  it('долгие гласные вапуро-стилем', () => {
    assert.equal(kanaToRomaji('おとうさん'), 'otousan')
    assert.equal(kanaToRomaji('おねえさん'), 'oneesan')
  })

  it('катакана тоже конвертируется', () => {
    assert.equal(kanaToRomaji('テレビ'), 'terebi')
    assert.equal(kanaToRomaji('ケーキ'), 'keeki')
  })
})

describe('kanaToRomajiVariants', () => {
  it('включает кунрэй-варианты', () => {
    const variants = kanaToRomajiVariants('しゃしん')
    assert.ok(variants.includes('shashin'))
    assert.ok(variants.includes('syasin'))
  })

  it('っち принимает и cchi, и tchi', () => {
    const variants = kanaToRomajiVariants('まっちゃ')
    assert.ok(variants.includes('maccha'))
    assert.ok(variants.includes('matcha'))
  })

  it('ん принимает n и nn', () => {
    const variants = kanaToRomajiVariants('ほん')
    assert.ok(variants.includes('hon'))
    assert.ok(variants.includes('honn'))
  })

  it('первый вариант — хэпбёрн', () => {
    assert.equal(kanaToRomajiVariants('ふじさん')[0], 'fujisan')
  })
})
