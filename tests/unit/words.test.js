import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WORDS,
  checkTranslation,
  getReadingAnswers,
  getTranslationAnswers,
  getWordById,
  normalizeRu,
} from '../../src/data/words.js'

describe('датасет слов', () => {
  it('300 слов, id уникальны', () => {
    assert.equal(WORDS.length, 300)
    assert.equal(new Set(WORDS.map((word) => word.id)).size, 300)
  })

  it('у каждого слова есть перевод, чтение и ромадзи', () => {
    for (const word of WORDS) {
      assert.ok(word.meanings.length > 0, `${word.id}: нет переводов`)
      assert.ok(word.kana, `${word.id}: нет каны`)
      assert.ok(word.katakana, `${word.id}: нет катаканы`)
      assert.ok(word.romaji, `${word.id}: нет ромадзи`)
    }
  })

  it('переводы не содержат японских символов и мусора', () => {
    const jp = /[\u3040-\u30ff\u4e00-\u9fff]/
    for (const word of WORDS) {
      for (const meaning of word.meanings) {
        assert.ok(!jp.test(meaning), `${word.id}: ${meaning}`)
        assert.ok(meaning.length <= 40, `${word.id}: слишком длинное «${meaning}»`)
      }
    }
  })

  it('катакана отличается от хираганы', () => {
    const okane = getWordById('o-okane-9859876a')
    assert.equal(okane.kana, 'おかね')
    assert.equal(okane.katakana, 'オカネ')
  })
})

describe('проверка ответов', () => {
  it('чтение: варианты ромадзи включают хэпбёрн и кунрэй', () => {
    const word = WORDS.find((entry) => entry.kana === 'おとうさん')
    const answers = getReadingAnswers(word)
    assert.ok(answers.includes('otousan'))
  })

  it('перевод: нормализация регистра и ё', () => {
    const word = WORDS.find((entry) => entry.meanings.includes('дешёвый'))
    assert.ok(checkTranslation(word, 'Дешевый'))
    assert.ok(checkTranslation(word, 'дешёвый'))
  })

  it('перевод: принимается любое из значений', () => {
    const word = getWordById('o-i-otearai-e03da3b8')
    assert.ok(checkTranslation(word, 'туалет'))
    assert.ok(checkTranslation(word, 'уборная'))
    assert.ok(!checkTranslation(word, 'кухня'))
  })

  it('перевод: скобочные уточнения необязательны', () => {
    const word = getWordById('ku-hiku-b5c09767')
    const answers = getTranslationAnswers(word)
    assert.ok(answers.includes(normalizeRu('играть')))
    assert.ok(answers.includes(normalizeRu('играть на инструменте')))
  })

  it('normalizeRu убирает пунктуацию и лишние пробелы', () => {
    assert.equal(normalizeRu('  Старший   брат! '), 'старший брат')
  })
})
