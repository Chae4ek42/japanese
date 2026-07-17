import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getJlptWords, getWordById, searchWords } from '../../src/features/kanji/data/bank'
import { VOCAB_GROUPS, getWordsForGroup } from '../../src/features/vocab/groups'

describe('vocab catalog', () => {
  it('группы содержат реальные слова', () => {
    assert.ok(VOCAB_GROUPS.length >= 20)
    const family = getWordsForGroup('family')
    assert.ok(family.length >= 10)
    assert.ok(family.every((word) => word.writing && word.kana && word.meanings.length))
  })

  it('слова JLPT N5 доступны по уровню', () => {
    const n5 = getJlptWords(5)
    assert.ok(n5.length >= 400)
    assert.ok(n5.every((word) => word.jlpt === 5))
  })

  it('поиск находит слово по написанию', () => {
    const hits = searchWords('毎日', { limit: 10 })
    assert.ok(hits.some((word) => word.writing === '毎日'))
    const first = hits.find((word) => word.writing === '毎日')
    assert.ok(first?.id)
    assert.equal(getWordById(first!.id!)?.writing, '毎日')
  })
})
