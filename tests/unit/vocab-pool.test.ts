import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/app-state'
import { createStatsRecord } from '../../src/shared/lib/trainer'
import {
  buildChoiceOptions,
  buildVocabPool,
  normalizeRomajiAnswer,
  wordToVocabCard,
} from '../../src/features/vocab/pool'
import { getJlptWords } from '../../src/data/words/bank'

describe('vocab pool', () => {
  it('нормализует ромадзи для ответа', () => {
    assert.equal(normalizeRomajiAnswer('Mai-nichi'), 'mainichi')
    assert.equal(normalizeRomajiAnswer('  o cha '), 'ocha')
  })

  it('собирает пул N5', () => {
    const pool = buildVocabPool({ ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5 }, [])
    assert.ok(pool.length >= 100)
    assert.ok(pool.every((card) => card.id && card.answers.length && card.meaning))
  })

  it('собирает пул N1 и N2', () => {
    const n1 = buildVocabPool({ ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 1 }, [])
    const n2 = buildVocabPool({ ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 2 }, [])
    assert.ok(n1.length >= 100)
    assert.ok(n2.length >= 100)
    assert.ok(n1.every((card) => card.jlpt === 1))
    assert.ok(n2.every((card) => card.jlpt === 2))
  })

  it('фильтрует группу по JLPT', () => {
    const all = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'group', groupId: 'family', wordJlptLevels: [] },
      [],
    )
    const onlyN5 = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'group', groupId: 'family', wordJlptLevels: [5] },
      [],
    )
    assert.ok(onlyN5.length <= all.length)
    assert.ok(onlyN5.every((card) => card.jlpt === 5))
  })

  it('ограничивает число новых слов', () => {
    const base = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: 0 },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(base.length > 10)
    const seenId = base[0]!.id
    const stats = { [seenId]: { ...createStatsRecord(), exposures: 3 } }
    const limited = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: 5 },
      [],
      {},
      { stats, applyNewWordLimit: true },
    )
    const newCount = limited.filter((card) => (stats[card.id]?.exposures ?? 0) === 0).length
    assert.equal(newCount, 5)
    assert.ok(limited.some((card) => card.id === seenId))
  })

  it('строит 6 вариантов перевода с одним верным', () => {
    const words = getJlptWords(5).slice(0, 20)
    const cards = words.map(wordToVocabCard).filter((card): card is NonNullable<typeof card> => Boolean(card))
    const target = cards[0]
    const options = buildChoiceOptions(target, cards, { rng: () => 0.1 })
    assert.equal(options.length, 6)
    assert.equal(options.filter((item) => item === target.meaning).length, 1)
  })

  it('не тащит в варианты отсылки и нумерацию словаря', () => {
    const cards = [
      wordToVocabCard({
        id: 'a',
        writing: '貴方',
        kana: 'あなた',
        romaji: 'anata',
        meanings: ['вы (обращение между посторонними, женщинами-подругами и жены к мужу)'],
        jlpt: 5,
        kanji: [],
      }),
      wordToVocabCard({
        id: 'b',
        writing: '此方',
        kana: 'こちら',
        romaji: 'kochira',
        meanings: ['(см.) こちら'],
        jlpt: 5,
        kanji: [],
      }),
      wordToVocabCard({
        id: 'c',
        writing: '俺',
        kana: 'おれ',
        romaji: 'ore',
        meanings: ['(прост.) я'],
        jlpt: 5,
        kanji: [],
      }),
      wordToVocabCard({
        id: 'd',
        writing: '自分',
        kana: 'じぶん',
        romaji: 'jibun',
        meanings: ['1) сам'],
        jlpt: 5,
        kanji: [],
      }),
      wordToVocabCard({
        id: 'e',
        writing: '誰',
        kana: 'だれ',
        romaji: 'dare',
        meanings: ['кто'],
        jlpt: 5,
        kanji: [],
      }),
      wordToVocabCard({
        id: 'f',
        writing: '僕',
        kana: 'ぼく',
        romaji: 'boku',
        meanings: ['я (мужчина о себе)'],
        jlpt: 5,
        kanji: [],
      }),
      wordToVocabCard({
        id: 'g',
        writing: '彼',
        kana: 'かれ',
        romaji: 'kare',
        meanings: ['он'],
        jlpt: 5,
        kanji: [],
      }),
    ].filter((card): card is NonNullable<typeof card> => Boolean(card))

    assert.equal(cards.find((c) => c.id === 'b'), undefined)
    const target = cards.find((c) => c.id === 'a')!
    assert.equal(target.meaning, 'вы')
    assert.ok(cards.some((c) => c.id === 'c' && c.meaning === 'я'))
    assert.ok(cards.some((c) => c.id === 'd' && c.meaning === 'сам'))

    const options = buildChoiceOptions(target, cards, { rng: () => 0 })
    assert.ok(options.includes('вы'))
    assert.ok(!options.some((o) => /\(см\.\)/.test(o) || /^\d+\)/.test(o) || /\(прост\.\)/.test(o)))
  })
})
