import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getColoredReading,
  getHighlightedReading,
  mapWritingColorIndexes,
} from '../../src/shared/lib/reading-align'

function roles(writing: string, kana: string, focus: string) {
  return getHighlightedReading(writing, kana, focus)?.map((item) => `${item.role}:${item.kana}`)
}

function colors(writing: string, kana: string) {
  return getColoredReading(writing, kana)?.map(
    (item) => `${item.colorIndex}:${item.kana}:${item.chars}:${item.source ?? ''}`,
  )
}

describe('getHighlightedReading', () => {
  it('деляет онные чтения в составных словах', () => {
    assert.deepEqual(roles('毎日', 'まいにち', '日'), ['other:まい', 'focus:にち'])
    assert.deepEqual(roles('火曜日', 'かようび', '日'), ['other:か', 'other:よう', 'focus:び'])
  })

  it('учитывает сокуон и делит 学校 в 中学校', () => {
    assert.deepEqual(roles('中学校', 'ちゅうがっこう', '中'), [
      'focus:ちゅう',
      'other:がっ',
      'other:こう',
    ])
    const colored = getColoredReading('中学校', 'ちゅうがっこう')
    assert.ok(colored)
    assert.deepEqual(
      colored.map((item) => `${item.chars}:${item.kana}:${item.colorIndex}`),
      ['中:ちゅう:0', '学:がっ:1', '校:こう:2'],
    )
    assert.equal(colored.map((item) => item.romaji).join(''), 'chyuugakkou')
  })

  it('помечает дзюкудзикун как shared', () => {
    assert.deepEqual(roles('今日', 'きょう', '日'), ['shared:きょう'])
    assert.deepEqual(roles('明日', 'あした', '日'), ['shared:あした'])
  })

  it('отделяет окуригану у глаголов', () => {
    assert.deepEqual(roles('食べる', 'たべる', '食'), ['focus:た', 'other:べる'])
  })

  it('строит ромадзи по сегментам', () => {
    const segments = getHighlightedReading('毎日', 'まいにち', '日')!
    assert.equal(segments.map((item) => item.romaji).join(''), 'mainichi')
    assert.equal(segments.find((item) => item.role === 'focus')?.romaji, 'nichi')
  })

  it('сохраняет разделитель нескольких чтений в ромадзи', () => {
    const segments = getHighlightedReading('私', 'わたし / わたくし', '私')!
    assert.equal(segments.map((item) => item.romaji).join(''), 'watashi / watakushi')
  })
})

describe('getColoredReading', () => {
  it('красит каждый кандзи своим цветом вместе с чтением', () => {
    const segments = getColoredReading('校長', 'こうちょう')
    assert.ok(segments)
    assert.equal(segments.length, 2)
    assert.equal(segments[0].chars, '校')
    assert.equal(segments[0].kana, 'こう')
    assert.equal(segments[0].colorIndex, 0)
    assert.equal(segments[1].chars, '長')
    assert.equal(segments[1].kana, 'ちょう')
    assert.equal(segments[1].colorIndex, 1)

    assert.deepEqual(mapWritingColorIndexes('校長', segments), [0, 1])
  })

  it('не сливает соседние кандзи в один цвет', () => {
    const segments = getColoredReading('火曜日', 'かようび')
    assert.ok(segments)
    assert.equal(segments.length, 3)
    assert.deepEqual(
      segments.map((item) => item.chars),
      ['火', '曜', '日'],
    )
    assert.deepEqual(
      segments.map((item) => item.colorIndex),
      [0, 1, 2],
    )
  })

  it('для дзюкудзикун даёт один общий цвет на группу', () => {
    const segments = getColoredReading('今日', 'きょう')
    assert.ok(segments)
    assert.equal(segments.length, 1)
    assert.equal(segments[0].source, 'group')
    assert.equal(segments[0].chars, '今日')
    assert.equal(segments[0].kana, 'きょう')
    assert.deepEqual(mapWritingColorIndexes('今日', segments), [0, 0])
  })

  it('угадывает нестандартное чтение одиночного кандзи перед окуриганой', () => {
    const segments = getColoredReading('彼の', 'あの')
    assert.ok(segments, 'alignment should succeed for irregular 彼→あ')
    assert.equal(segments[0].chars, '彼')
    assert.equal(segments[0].kana, 'あ')
    assert.equal(segments[0].source, 'guess')
    assert.equal(segments[1].kana, 'の')
    assert.equal(segments[1].colorIndex, -1)
  })

  it('помечает окуригану нейтральным цветом', () => {
    assert.deepEqual(colors('食べる', 'たべる'), ['0:た:食:known', '-1:べる:べる:okuri'])
  })
})
