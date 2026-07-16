import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getHighlightedReading } from '../../src/lib/reading-align.js'

function roles(writing, kana, focus) {
  return getHighlightedReading(writing, kana, focus)?.map((item) => `${item.role}:${item.kana}`)
}

describe('getHighlightedReading', () => {
  it('деляет онные чтения в составных словах', () => {
    assert.deepEqual(roles('毎日', 'まいにち', '日'), ['other:まい', 'focus:にち'])
    assert.deepEqual(roles('火曜日', 'かようび', '日'), ['other:かよう', 'focus:び'])
  })

  it('помечает дзюкудзикун как shared', () => {
    assert.deepEqual(roles('今日', 'きょう', '日'), ['shared:きょう'])
    assert.deepEqual(roles('明日', 'あした', '日'), ['shared:あした'])
  })

  it('отделяет окуригану у глаголов', () => {
    assert.deepEqual(roles('食べる', 'たべる', '食'), ['focus:た', 'other:べる'])
  })

  it('строит ромадзи по сегментам', () => {
    const segments = getHighlightedReading('毎日', 'まいにち', '日')
    assert.equal(segments.map((item) => item.romaji).join(''), 'mainichi')
    assert.equal(segments.find((item) => item.role === 'focus')?.romaji, 'nichi')
  })
})
