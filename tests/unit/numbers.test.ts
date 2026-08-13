import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildNumberPool,
  createClockCard,
  createCounterCard,
  createNumberCard,
  formatAgePrompt,
  formatAgeReading,
  formatNumberReading,
} from '../../src/data/numbers'

describe('чтение чисел', () => {
  it('базовые числа 1–10', () => {
    assert.deepEqual(formatNumberReading(1), { kanji: '一', kana: 'いち', romaji: 'ichi' })
    assert.deepEqual(formatNumberReading(5), { kanji: '五', kana: 'ご', romaji: 'go' })
    assert.deepEqual(formatNumberReading(10), { kanji: '十', kana: 'じゅう', romaji: 'juu' })
  })

  it('составные числа до 99', () => {
    assert.deepEqual(formatNumberReading(25), { kanji: '二十五', kana: 'にじゅうご', romaji: 'nijuugo' })
    assert.deepEqual(formatNumberReading(42), { kanji: '四十二', kana: 'よんじゅうに', romaji: 'yonjuuni' })
    assert.deepEqual(formatNumberReading(99), { kanji: '九十九', kana: 'きゅうじゅうきゅう', romaji: 'kyuujuukyuu' })
  })

  it('сотни с озвончением', () => {
    assert.deepEqual(formatNumberReading(300), { kanji: '三百', kana: 'さんびゃく', romaji: 'sanbyaku' })
    assert.deepEqual(formatNumberReading(600), { kanji: '六百', kana: 'ろっぴゃく', romaji: 'roppyaku' })
    assert.deepEqual(formatNumberReading(800), { kanji: '八百', kana: 'はっぴゃく', romaji: 'happyaku' })
    assert.deepEqual(formatNumberReading(805), { kanji: '八百五', kana: 'はっぴゃくご', romaji: 'happyakugo' })
  })
})

describe('возраст', () => {
  it('особые чтения', () => {
    assert.deepEqual(formatAgeReading(1), { kanji: '一歳', kana: 'いっさい', romaji: 'issai' })
    assert.deepEqual(formatAgeReading(8), { kanji: '八歳', kana: 'はっさい', romaji: 'hassai' })
    assert.deepEqual(formatAgeReading(10), { kanji: '十歳', kana: 'じっさい', romaji: 'jissai' })
    assert.deepEqual(formatAgeReading(20), { kanji: '二十歳', kana: 'はたち', romaji: 'hatachi' })
  })

  it('обычный возраст', () => {
    assert.deepEqual(formatAgeReading(25), { kanji: '二十五歳', kana: 'にじゅうごさい', romaji: 'nijuugosai' })
    assert.deepEqual(formatAgeReading(42), { kanji: '四十二歳', kana: 'よんじゅうにさい', romaji: 'yonjuunisai' })
  })

  it('русский промпт с правильным склонением', () => {
    assert.equal(formatAgePrompt(1), '1 год')
    assert.equal(formatAgePrompt(2), '2 года')
    assert.equal(formatAgePrompt(5), '5 лет')
    assert.equal(formatAgePrompt(21), '21 год')
    assert.equal(formatAgePrompt(22), '22 года')
    assert.equal(formatAgePrompt(25), '25 лет')
  })
})

describe('набор чисел', () => {
  it('createNumberCard формирует карточку', () => {
    const card = createNumberCard(7, 'plain')
    assert.equal(card.id, 'plain:7')
    assert.equal(card.symbol, '7')
    assert.equal(card.kanji, '七')
    assert.equal(card.kana, 'なな')
  })

  it('buildNumberPool строит диапазон', () => {
    const pool = buildNumberPool({ mode: 'plain', rangeMin: 1, rangeMax: 5 })
    assert.equal(pool.length, 5)
    assert.equal(pool[0].value, 1)
    assert.equal(pool[4].value, 5)
  })
})

describe('счётчики и часы', () => {
  it('本 и 人 с особыми чтениями', () => {
    const hon3 = createCounterCard(3, 'hon')
    assert.equal(hon3.symbol, '3本')
    assert.equal(hon3.kana, 'さんぼん')
    assert.equal(createCounterCard(1, 'nin').kana, 'ひとり')
    assert.equal(createCounterCard(2, 'nin').kana, 'ふたり')
    assert.equal(createCounterCard(1, 'tsu').kana, 'ひとつ')
  })

  it('часы: 4・7・9 и половина', () => {
    const four = createClockCard(4, false)
    assert.equal(four.symbol, '4:00')
    assert.equal(four.kana, 'よじ')
    assert.equal(createClockCard(7, false).kana, 'しちじ')
    assert.equal(createClockCard(9, true).kana, 'くじはん')
    assert.equal(createClockCard(9, true).kanji, '九時半')
  })

  it('пулы счётчиков и часов фиксированного размера', () => {
    const counters = buildNumberPool({ mode: 'counter', rangeMin: 1, rangeMax: 99 })
    assert.equal(counters.length, 50)
    const clock = buildNumberPool({ mode: 'clock', rangeMin: 1, rangeMax: 99 })
    assert.equal(clock.length, 24)
  })
})
