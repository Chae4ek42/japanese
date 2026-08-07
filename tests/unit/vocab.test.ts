import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getJlptWords, getWordById, searchWords } from '../../src/data/words/bank'
import { VOCAB_GROUPS, getWordsForGroup } from '../../src/features/vocab/groups'

describe('vocab catalog', () => {
  it('группы содержат реальные слова', () => {
    assert.ok(VOCAB_GROUPS.length >= 30)
    const family = getWordsForGroup('family')
    assert.ok(family.length >= 10)
    assert.ok(family.every((word) => word.writing && word.kana && word.meanings.length))
  })

  it('группа местоимений доступна для тренировки', () => {
    const pronouns = getWordsForGroup('pronouns')
    assert.ok(pronouns.length >= 20)
    assert.ok(pronouns.some((word) => word.writing === '私'))
    assert.ok(pronouns.some((word) => word.writing === '誰' || word.kana === 'だれ'))
    assert.ok(pronouns.every((word) => word.writing && word.kana && word.meanings.length))
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

  it('группы чтения: мастхев и уровни N5–N1', () => {
    const must = getWordsForGroup('reading-must')
    assert.ok(must.length >= 40 && must.length <= 200, `must size ${must.length}`)
    assert.ok(must.some((word) => word.writing === 'これ' || word.kana === 'これ'))
    assert.ok(must.some((word) => word.writing === 'です' || word.kana === 'です'))

    const n5 = getWordsForGroup('reading-n5')
    assert.ok(n5.length >= 20, `n5 size ${n5.length}`)

    const giant = getWordsForGroup('reading-foundation')
    assert.equal(giant.length, 0, 'старая монолитная группа удалена')

    for (const id of ['reading-must', 'reading-n5', 'reading-n4', 'reading-n3', 'reading-n2', 'reading-n1']) {
      const group = getWordsForGroup(id)
      assert.ok(group.length > 0, id)
      assert.ok(group.every((word) => word.writing && word.kana && word.meanings.length))
    }
  })
})
