import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  VERB_CARDS,
  buildVerbPool,
  conjugateVerb,
  getVerbCard,
  verbChoiceOptions,
} from '../../src/data/verbs.ts'

const kaku = {
  id: 'kaku',
  writing: '書く',
  kana: 'かく',
  meaning: 'писать',
  group: 'godan' as const,
}

describe('спряжение глаголов', () => {
  it('godan 書く', () => {
    assert.equal(conjugateVerb(kaku, 'te').writing, '書いて')
    assert.equal(conjugateVerb(kaku, 'te').kana, 'かいて')
    assert.equal(conjugateVerb(kaku, 'ta').writing, '書いた')
    assert.equal(conjugateVerb(kaku, 'nai').writing, '書かない')
    assert.equal(conjugateVerb(kaku, 'masu').writing, '書きます')
    assert.equal(conjugateVerb(kaku, 'potential').writing, '書ける')
  })

  it('исключение 行く', () => {
    const iku = {
      id: 'iku',
      writing: '行く',
      kana: 'いく',
      meaning: 'идти',
      group: 'godan' as const,
    }
    assert.equal(conjugateVerb(iku, 'te').kana, 'いって')
    assert.equal(conjugateVerb(iku, 'ta').writing, '行った')
  })

  it('ichidan 食べる', () => {
    const taberu = {
      id: 'taberu',
      writing: '食べる',
      kana: 'たべる',
      meaning: 'есть',
      group: 'ichidan' as const,
    }
    assert.equal(conjugateVerb(taberu, 'te').writing, '食べて')
    assert.equal(conjugateVerb(taberu, 'nai').writing, '食べない')
    assert.equal(conjugateVerb(taberu, 'masu').writing, '食べます')
    assert.equal(conjugateVerb(taberu, 'potential').writing, '食べられる')
  })

  it('する и 来る', () => {
    const suru = {
      id: 'suru',
      writing: 'する',
      kana: 'する',
      meaning: 'делать',
      group: 'irregular' as const,
    }
    const kuru = {
      id: 'kuru',
      writing: '来る',
      kana: 'くる',
      meaning: 'приходить',
      group: 'irregular' as const,
    }
    assert.equal(conjugateVerb(suru, 'te').writing, 'して')
    assert.equal(conjugateVerb(suru, 'potential').writing, 'できる')
    assert.equal(conjugateVerb(kuru, 'te').kana, 'きて')
    assert.equal(conjugateVerb(kuru, 'nai').kana, 'こない')
    assert.equal(conjugateVerb(kuru, 'masu').writing, '来ます')
  })

  it('набор карточек и варианты ответа', () => {
    assert.ok(VERB_CARDS.length >= 100)
    const tePool = buildVerbPool('te')
    assert.ok(tePool.length >= 20)
    assert.ok(tePool.every((card) => card.form === 'te'))
    const card = getVerbCard('kaku:te')
    assert.ok(card)
    const options = verbChoiceOptions(card!, 6)
    assert.ok(options.some((item) => item.writing === '書いて'))
    assert.equal(new Set(options.map((item) => item.writing)).size, options.length)
  })
})
