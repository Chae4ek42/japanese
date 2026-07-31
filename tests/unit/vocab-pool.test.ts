import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/app-state'
import { createStatsRecord } from '../../src/shared/lib/trainer'
import {
  buildChoiceOptions,
  buildVocabPool,
  isStartedVocabCard,
  normalizeRomajiAnswer,
  pickNextSourceCard,
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

  it('в группе исключает слова из «Моих слов»', () => {
    const all = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'group', groupId: 'family', newWordLimit: -1 },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(all.length > 1)
    const mineId = all[0]!.id
    const filtered = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'group', groupId: 'family', newWordLimit: -1 },
      [mineId],
      {},
      { applyNewWordLimit: false },
    )
    assert.equal(filtered.length, all.length - 1)
    assert.ok(!filtered.some((card) => card.id === mineId))
  })

  it('trainFullGroup оставляет слова из «Моих слов»', () => {
    const all = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'group',
        groupId: 'family',
        newWordLimit: -1,
        trainFullGroup: true,
      },
      [],
      {},
      { applyNewWordLimit: false },
    )
    const mineId = all[0]!.id
    const full = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'group',
        groupId: 'family',
        newWordLimit: -1,
        trainFullGroup: true,
      },
      [mineId],
      {},
      { applyNewWordLimit: false },
    )
    assert.equal(full.length, all.length)
    assert.ok(full.some((card) => card.id === mineId))
  })

  it('trainFullGroup игнорирует лимит новых слов', () => {
    const all = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'group',
        groupId: 'family',
        newWordLimit: -1,
        trainFullGroup: true,
      },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(all.length > 3)
    const limited = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'group',
        groupId: 'family',
        newWordLimit: 2,
        trainFullGroup: true,
      },
      [],
      {},
      { stats: {}, applyNewWordLimit: true },
    )
    assert.equal(limited.length, all.length)
  })

  it('ограничивает число новых слов', () => {
    const base = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: -1 },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(base.length > 10)
    const startedId = base[0]!.id
    const stats = {
      [startedId]: { ...createStatsRecord(), exposures: 5, clears: 2, eventAccuracy: 100 },
      [base[1]!.id]: { ...createStatsRecord(), exposures: 4 },
    }
    const limited = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: 5 },
      [],
      {},
      { stats, applyNewWordLimit: true },
    )
    const startedInPool = limited.filter((card) => isStartedVocabCard(card, stats))
    const newInPool = limited.filter((card) => !isStartedVocabCard(card, stats))
    assert.equal(startedInPool.length, 1)
    assert.equal(newInPool.length, 5)
    assert.ok(limited.some((card) => card.id === startedId))
    assert.equal(limited.length, 6)
  })

  it('лимит 0 — только уже начатые слова, без новых', () => {
    const base = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: -1 },
      [],
      {},
      { applyNewWordLimit: false },
    )
    const startedId = base[0]!.id
    const stats = {
      [startedId]: { ...createStatsRecord(), clears: 1, eventAccuracy: 100 },
    }
    const limited = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: 0 },
      [],
      {},
      { stats, applyNewWordLimit: true },
    )
    assert.equal(limited.length, 1)
    assert.equal(limited[0]!.id, startedId)
  })

  it('не считает «начатыми» слова только с exposures без ответов', () => {
    const base = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'group',
        groupId: 'family',
        newWordLimit: -1,
        trainFullGroup: true,
      },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(base.length >= 4)
    const stats = Object.fromEntries(
      base.map((card) => [card.id, { ...createStatsRecord(), exposures: 3 }]),
    )
    const limited = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'group',
        groupId: 'family',
        newWordLimit: 2,
        trainFullGroup: false,
      },
      [],
      {},
      { stats, applyNewWordLimit: true },
    )
    assert.equal(limited.length, 2)
    assert.ok(limited.every((card) => !isStartedVocabCard(card, stats)))
  })

  it('для группы держит стабильный порядок N5→N1 и одинаковый набор новых', () => {
    const prefs = {
      ...DEFAULT_VOCAB_PREFERENCES,
      source: 'group' as const,
      groupId: 'family',
      newWordLimit: 3,
      trainFullGroup: true,
    }
    const a = buildVocabPool(prefs, [], {}, { stats: {}, applyNewWordLimit: true })
    const b = buildVocabPool(prefs, [], {}, { stats: {}, applyNewWordLimit: true })
    assert.deepEqual(
      a.map((card) => card.id),
      b.map((card) => card.id),
    )
    for (let i = 1; i < a.length; i += 1) {
      const prev = a[i - 1]!
      const next = a[i]!
      const rank = (jlpt?: number) => (typeof jlpt === 'number' && jlpt >= 1 && jlpt <= 5 ? jlpt : 0)
      const prevRank = rank(prev.jlpt)
      const nextRank = rank(next.jlpt)
      if (prevRank !== nextRank && prevRank !== 0 && nextRank !== 0) {
        assert.ok(prevRank >= nextRank)
      }
    }
  })

  it('pickNextSourceCard берёт следующее слово вне сессии в порядке набора', () => {
    const full = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'group',
        groupId: 'family',
        newWordLimit: -1,
        trainFullGroup: true,
      },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(full.length >= 3)
    const sessionIds = full.slice(0, 2).map((card) => card.id)
    const next = pickNextSourceCard(full, sessionIds)
    assert.equal(next?.id, full[2]!.id)
  })

  it('для mine можно исключить выученные', () => {
    const custom = {
      id: 'custom:a',
      writing: '猫',
      kana: 'ねこ',
      romaji: 'neko',
      meanings: ['кошка'],
      kanji: ['猫'],
    }
    const all = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'mine', mineIncludeLearned: true },
      [custom.id],
      { [custom.id]: custom },
    )
    assert.equal(all.length, 1)
    const unlearned = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'mine', mineIncludeLearned: false },
      [custom.id],
      { [custom.id]: custom },
      { learnedWordIds: [custom.id] },
    )
    assert.equal(unlearned.length, 0)
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
