import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  KANJI_LIST,
  POPULAR_WORDS_PER_KANJI,
  formatCompositionFormula,
  getComponent,
  getJoyoKanji,
  getKanjiComponents,
  getKanjiUsingComponent,
  getPopularWordsForKanji,
  getPracticeWords,
  getWordsForKanji,
  pickRandomUnlearnedKanji,
} from '../../src/data/words/bank'

describe('kanji bank', () => {
  it('содержит кандзи N5–N1 и Jōyō', () => {
    assert.ok(KANJI_LIST.length >= 2000)
    assert.ok(KANJI_LIST.some((item) => item.level === 5 && item.character === '日'))
    assert.ok(KANJI_LIST.some((item) => item.level === 4))
    assert.ok(KANJI_LIST.some((item) => item.level === 3))
    assert.ok(KANJI_LIST.some((item) => item.level === 2 || item.level === 1))
    assert.ok(getJoyoKanji().length >= 2000)
    assert.ok(KANJI_LIST.find((item) => item.character === '日')?.joyo)
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

  it('getPopularWordsForKanji отдаёт короткий JLPT-список', () => {
    const all = getWordsForKanji('日')
    const popular = getPopularWordsForKanji('日')
    assert.ok(popular.length > 0)
    assert.ok(popular.length <= POPULAR_WORDS_PER_KANJI)
    assert.ok(popular.length < all.length)
    assert.ok(popular.every((word) => typeof word.jlpt === 'number'))
    assert.ok(popular[0]!.jlpt === 5)
  })

  it('getPracticeWords исключает скрытые id', () => {
    const all = getPracticeWords('日', { limit: 20 })
    const firstId = all[0]?.id
    assert.ok(firstId)
    const next = getPracticeWords('日', {
      excludedIds: [firstId!],
      limit: 20,
    })
    assert.ok(!next.some((word) => word.id === firstId))
    assert.ok(next.length >= Math.min(19, all.length - 1))
  })

  it('getPracticeWords фильтрует слова по JLPT', () => {
    const all = getPracticeWords('日', { limit: 1000 })
    const onlyN5 = getPracticeWords('日', {
      wordJlptLevels: [5],
      limit: 1000,
    })
    assert.ok(onlyN5.length > 0)
    assert.ok(onlyN5.length <= all.length)
    assert.ok(onlyN5.every((word) => word.jlpt === 5))
    const n5n4 = getPracticeWords('日', {
      wordJlptLevels: [5, 4],
      limit: 1000,
    })
    assert.ok(n5n4.every((word) => word.jlpt === 5 || word.jlpt === 4))
    assert.ok(n5n4.length >= onlyN5.length)
  })

  it('случайный кандзи избегает выученных', () => {
    const learned = KANJI_LIST.filter((item) => item.level === 5).map((item) => item.character)
    const picked = pickRandomUnlearnedKanji(learned, [5, 4, 3], () => 0)
    assert.ok(picked)
    assert.notEqual(picked!.level, 5)
  })

  it('разбор компонентов для sample Jōyō (日, 語, 緑)', () => {
    const go = getKanjiComponents('語')
    assert.ok(go.length >= 2, '語 should have components')
    assert.ok(go.some((part) => part.glyph === '言' || part.id === '言'))
    assert.ok(formatCompositionFormula('語').includes('→ 語'))

    const midori = getKanjiComponents('緑')
    assert.ok(midori.length >= 1, '緑 should have components')
    assert.ok(midori.some((part) => part.glyph === '糸' || part.id === '糸'))

    // 日 is often atomic; still a Joyo entry with optional empty/self components
    const hi = KANJI_LIST.find((item) => item.character === '日')
    assert.ok(hi)
    assert.equal(hi!.joyo, true)
    assert.ok(Array.isArray(hi!.components))
  })

  it('lookup компонента и usedIn', () => {
    const component = getComponent('言')
    assert.ok(component, 'component 言 should exist in catalog')
    assert.ok(component!.usedIn.includes('語'))
    const users = getKanjiUsingComponent('言', 200)
    assert.ok(users.some((item) => item.character === '語'))
  })
})
