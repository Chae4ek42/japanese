import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { KanjiWord } from '../../src/shared/lib/types'
import {
  KANJI_LIST,
  getPracticeWords,
  getWordsForKanji,
  isWordAllowedByComplexity,
  pickRandomUnlearnedKanji,
} from '../../src/features/kanji/data/bank'

describe('kanji bank', () => {
  it('содержит кандзи N5–N3', () => {
    assert.ok(KANJI_LIST.length >= 600)
    assert.ok(KANJI_LIST.some((item) => item.level === 5 && item.character === '日'))
    assert.ok(KANJI_LIST.some((item) => item.level === 4))
    assert.ok(KANJI_LIST.some((item) => item.level === 3))
  })

  it('для 日 есть слова с чтением и переводом', () => {
    const words = getWordsForKanji('日')
    assert.ok(words.length > 10)
    const sample = words[0]
    assert.ok(sample.writing.includes('日'))
    assert.ok(sample.kana)
    assert.ok(sample.romaji)
    assert.ok(sample.meanings.length)
  })

  it('фильтр сложности отсекает слова с более сложными соседними кандзи', () => {
    const hardWord = {
      writing: '試験',
      kanji: ['試', '験'],
    } as Pick<KanjiWord, 'writing' | 'kanji'>
    // 試 is N3-ish; if target is N5 日, unknown/harder neighbors fail
    assert.equal(isWordAllowedByComplexity(hardWord, '日', new Set()), false)

    const easyWord = {
      writing: '日本',
      kanji: ['日', '本'],
    } as Pick<KanjiWord, 'writing' | 'kanji'>
    assert.equal(isWordAllowedByComplexity(easyWord, '日', new Set()), true)
    assert.equal(isWordAllowedByComplexity(easyWord, '日', new Set(['本'])), true)
  })

  it('getPracticeWords уважает флаг фильтра', () => {
    const all = getPracticeWords('日', { complexityFilter: false, limit: 1000 })
    const filtered = getPracticeWords('日', { complexityFilter: true, limit: 1000 })
    assert.ok(all.length >= filtered.length)
  })

  it('случайный кандзи избегает выученных', () => {
    const learned = KANJI_LIST.filter((item) => item.level === 5).map((item) => item.character)
    const picked = pickRandomUnlearnedKanji(learned, [5, 4, 3], () => 0)
    assert.ok(picked)
    assert.notEqual(picked!.level, 5)
  })
})
