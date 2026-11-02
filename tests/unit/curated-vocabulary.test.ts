import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  KANJI_WORDS,
  KANJI_BANK_META,
  getWordById,
  getWordsByKana,
  getWordsByWriting,
  getWordsForKanji,
  searchWords,
} from '../../src/data/words/bank'
import curated from '../../src/data/words/curated-vocabulary.json' with { type: 'json' }
import { VOCAB_GROUPS, getWordsForGroup } from '../../src/features/vocab/groups'

describe('manually curated vocabulary', () => {
  it('resolves every group membership and keeps group and word ids unique', () => {
    assert.equal(new Set(VOCAB_GROUPS.map((group) => group.id)).size, VOCAB_GROUPS.length)
    assert.equal(new Set(KANJI_WORDS.map((word) => word.id)).size, KANJI_WORDS.length)
    assert.equal(KANJI_BANK_META.counts.words, KANJI_WORDS.length)
    for (const group of VOCAB_GROUPS) {
      assert.equal(new Set(group.wordIds).size, group.wordIds.length, group.id)
      for (const id of group.wordIds) {
        assert.ok(getWordById(id), `${group.id}: unresolved ${id}`)
      }
    }
  })

  it('makes additions available in dictionary, reading and kanji lookups', () => {
    for (const word of curated.words) {
      assert.deepEqual(getWordById(word.id), word)
      assert.ok(getWordsByWriting(word.writing).some((candidate) => candidate.id === word.id), word.id)
      assert.ok(getWordsByKana(word.kana).some((candidate) => candidate.id === word.id), word.id)
      for (const kanji of word.kanji) {
        assert.ok(getWordsForKanji(kanji).some((candidate) => candidate.id === word.id), `${word.id}: ${kanji}`)
      }
    }
    assert.ok(searchWords('ちゅうしょく').some((word) => word.id === 'curated-chuushoku'))
    assert.ok(getWordsByWriting('昼食').some((word) => word.kana === 'ちゅうじき'))
  })

  it('covers practical themes with substantive independent selections', () => {
    const themes = [
      'daily-routine', 'kitchen-cooking', 'fruit-vegetables', 'digital-life',
      'sports', 'music-performance', 'occupations', 'housing-rental',
      'post-delivery', 'emergencies', 'environment', 'relationships',
      'personality', 'shapes-materials', 'schedule-calendar', 'travel-accommodation',
    ]
    for (const id of themes) {
      assert.ok(getWordsForGroup(id).length >= 20, id)
    }
    for (const id of ['colors', 'body', 'clothes', 'media', 'greetings', 'dining', 'tourism']) {
      assert.ok(getWordsForGroup(id).length >= 15, id)
    }
  })

  it('uses grammatical lexemes instead of unrelated homophones', () => {
    const writing = (id: string) => getWordsForGroup(id).map((word) => word.writing)
    assert.ok(writing('reading-copula').includes('だ'))
    assert.ok(!writing('reading-copula').includes('駄'))
    assert.ok(writing('reading-aux').includes('する'))
    assert.ok(!writing('reading-aux').includes('刷る'))
    assert.ok(!writing('reading-aux').includes('繰る'))
    for (const expected of ['事', '様', 'はず', '訳']) {
      assert.ok(writing('reading-frames').includes(expected), expected)
    }
    for (const unexpected of ['琴', '酔う', '巴豆', '分け']) {
      assert.ok(!writing('reading-frames').includes(unexpected), unexpected)
    }
    assert.ok(!writing('reading-pronouns').includes('黄身'))
    assert.ok(!writing('reading-adjectives').includes('感嘆'))
    assert.ok(!writing('reading-interjections').includes('由'))
  })

  it('keeps editorial provenance and does not invent JLPT levels', () => {
    assert.equal(curated.provenance.basis, 'editorial')
    assert.ok(curated.provenance.references.every((reference) => reference.url.startsWith('https://')))
    for (const word of curated.words) {
      assert.match(word.id, /^curated-/)
      assert.match(word.kana, /^[\u3040-\u30ffー]+$/u)
      assert.match(word.romaji, /^[a-z ']+$/)
      assert.ok(word.meanings.length > 0)
      assert.equal(getWordById(word.id)?.jlpt, undefined)
    }
    assert.ok(getWordById('1582920')?.meanings[0]?.includes('этот'))
    assert.ok(getWordById('1427430')?.meanings[0]?.includes('1 000 000 000 000'))
    assert.ok(getWordById('1392580')?.meanings[0]?.includes('перед'))
  })
})
