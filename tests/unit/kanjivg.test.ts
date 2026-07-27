import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  componentMatchKeys,
  kanjiToKanjivgId,
  kanjivgSvgUrl,
} from '../../src/features/kanji/kanjivg'

describe('kanjivg helpers', () => {
  it('строит id и url для кандзи', () => {
    assert.equal(kanjiToKanjivgId('語'), '08a9e')
    assert.equal(kanjivgSvgUrl('語'), 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/08a9e.svg')
  })

  it('сопоставляет варианты радикалов', () => {
    assert.ok(componentMatchKeys('人').includes('亻'))
    assert.ok(componentMatchKeys('氵').includes('水'))
  })
})
