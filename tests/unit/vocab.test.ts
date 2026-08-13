import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getJlptWords, getKanaWords, getWordById, searchWords } from '../../src/data/words/bank'
import {
  VOCAB_GROUPS,
  collectGroupTrainingIds,
  getVocabGroup,
  getVocabGroupsByKind,
  getWordsForGroup,
  groupKind,
} from '../../src/features/vocab/groups'

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
    assert.ok(n5.some((word) => word.writing === 'これ'))
  })

  it('поиск находит слово по написанию', () => {
    const hits = searchWords('毎日', { limit: 10 })
    assert.ok(hits.some((word) => word.writing === '毎日'))
    const first = hits.find((word) => word.writing === '毎日')
    assert.ok(first?.id)
    assert.equal(getWordById(first!.id!)?.writing, '毎日')
  })

  it('поиск по ромадзи ставит точное чтение выше подстрок', () => {
    const hits = searchWords('sora', { limit: 10 })
    assert.ok(hits.length > 0)
    assert.equal(hits[0]?.writing, '空')
    assert.equal(hits[0]?.kana, 'そら')
    assert.ok(hits[0]?.romaji.toLowerCase() === 'sora')
  })

  it('группы чтения тематические и самостоятельные', () => {
    const reading = getVocabGroupsByKind('reading')
    assert.ok(reading.length >= 8, `reading groups ${reading.length}`)
    assert.ok(reading.every((group) => groupKind(group) === 'reading'))
    assert.ok(reading.every((group) => group.wordIds.length > 0))

    const demo = getWordsForGroup('reading-demo')
    assert.ok(demo.length >= 8, `demo size ${demo.length}`)
    assert.ok(demo.some((word) => word.writing === 'これ' || word.kana === 'これ'))

    const adverbs = getWordsForGroup('reading-adverbs')
    assert.ok(adverbs.length >= 20, `adverbs size ${adverbs.length}`)

    const particles = getWordsForGroup('reading-particles')
    assert.ok(particles.length >= 10, `particles size ${particles.length}`)

    assert.equal(getWordsForGroup('reading-foundation').length, 0)
    assert.equal(getWordsForGroup('reading-must').length, 0)
    assert.equal(getWordsForGroup('reading-n5').length, 0)

    const themes = getVocabGroupsByKind('theme')
    assert.ok(themes.length >= 20)
    assert.ok(themes.every((group) => groupKind(group) === 'theme'))
  })

  it('collectGroupTrainingIds собирает id группы для набора', () => {
    const group = getVocabGroup('reading-demo')
    assert.ok(group)
    const ids = collectGroupTrainingIds(group!)
    assert.ok(ids.length >= group!.wordIds.length)
    assert.ok(group!.wordIds.every((id) => ids.includes(id)))
  })

  it('каталог на кане содержит これ / です и заимствования', () => {
    const kana = getKanaWords()
    assert.ok(kana.length >= 400)
    assert.ok(kana.every((word) => word.writing && !/[\u4e00-\u9fff]/u.test(word.writing)))
    assert.ok(kana.some((word) => word.writing === 'これ'))
    assert.ok(kana.some((word) => word.writing === 'です'))
    const hira = getKanaWords('hiragana')
    const kata = getKanaWords('katakana')
    assert.ok(hira.some((word) => word.writing === 'これ'))
    assert.ok(kata.length >= 50)
    assert.ok(kana.some((word) => word.writing === 'バス' || word.writing === 'アルバイト'))
  })
})
