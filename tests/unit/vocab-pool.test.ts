import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getJlptWords } from '../../src/data/words/bank'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/app-state'
import { getWordsByWriting } from '../../src/data/words/bank'
import {
  buildChoiceOptions,
  buildEvenModeWeightMultipliers,
  pickEvenVocabCardId,
  buildKanjiPracticeVocabPool,
  buildVocabPool,
  evaluateRomajiReadings,
  normalizeRomajiAnswer,
  pickNextSourceCard,
  pickWeightedVocabCardId,
  pickUniformVocabCardId,
  wordToVocabCard,
} from '../../src/features/vocab/pool'
import { mergeWordsByWriting } from '../../src/features/vocab/mergeHomographs'

describe('vocab pool', () => {
  it('нормализует ромадзи для ответа', () => {
    assert.equal(normalizeRomajiAnswer('Mai-nichi'), 'mainichi')
    assert.equal(normalizeRomajiAnswer('  o cha '), 'ocha')
  })

  it('evaluateRomajiReadings принимает любое одно чтение', () => {
    const required = ['watashi', 'watakushi']
    assert.equal(evaluateRomajiReadings(required, '', 'instant'), 'empty')
    assert.equal(evaluateRomajiReadings(required, 'wata', 'instant'), 'pending')
    assert.equal(evaluateRomajiReadings(required, 'watashi', 'instant'), 'correct')
    assert.equal(evaluateRomajiReadings(required, 'watakushi', 'submit'), 'correct')
    assert.equal(evaluateRomajiReadings(required, 'watashi/watakushi', 'instant'), 'correct')
    assert.equal(evaluateRomajiReadings(required, 'watakushi / watashi', 'instant'), 'correct')
    assert.equal(evaluateRomajiReadings(required, 'watashi watakushi', 'instant'), 'correct')
    assert.equal(evaluateRomajiReadings(required, 'watashi/foo', 'instant'), 'wrong')
    assert.equal(evaluateRomajiReadings(required, 'watashi', 'submit'), 'correct')
    assert.equal(evaluateRomajiReadings(['neko'], 'neko', 'instant'), 'correct')
    assert.equal(evaluateRomajiReadings(['neko'], 'ne', 'instant'), 'pending')
  })

  it('пул кандзи мержит омографы в одну карточку', () => {
    const raw = getWordsByWriting('私')
    assert.ok(raw.length > 1, 'ожидаются несколько словарных статей для 私')
    const pool = buildKanjiPracticeVocabPool('私', {
      limit: 1000,
    })
    const card = pool.find((item) => item.writing === '私')
    assert.ok(card)
    assert.ok((card!.readings?.length ?? 0) > 1)
    assert.ok(card!.answers.length > 1)
    assert.equal(pool.filter((item) => item.writing === '私').length, 1)

    const merged = mergeWordsByWriting(raw)
    assert.equal(merged.length, 1)
    assert.ok((merged[0]!.readings?.length ?? 0) > 1)
  })

  it('source=kanji сохраняет порядок выбранных знаков', () => {
    const pool = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'kanji',
        selectedKanji: ['日', '一'],
        trainFullGroup: true,
        newWordLimit: -1,
      },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(pool.length > 1)
    const firstWriting = pool[0]!.writing
    assert.ok(firstWriting.includes('日'), `ожидали слово с 日 первым, получили ${firstWriting}`)
  })

  it('source=list берёт слова из trainingWordIds', () => {
    const n5 = buildVocabPool({ ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5 }, [])
    const ids = n5.slice(0, 3).map((card) => card.id)
    const pool = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'list',
        trainFullGroup: true,
        newWordLimit: -1,
      },
      [],
      {},
      { applyNewWordLimit: false, trainingWordIds: ids },
    )
    assert.equal(pool.length, 3)
    assert.deepEqual(
      pool.map((card) => card.id),
      ids,
    )
  })

  it('source=list оставляет слова из «Моих слов» без trainFullGroup', () => {
    const n5 = buildVocabPool({ ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5 }, [])
    const ids = n5.slice(0, 3).map((card) => card.id)
    const mineId = ids[0]!
    const pool = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'list',
        trainFullGroup: false,
        newWordLimit: -1,
      },
      [mineId],
      {},
      { applyNewWordLimit: false, trainingWordIds: ids },
    )
    assert.equal(pool.length, 3)
    assert.ok(pool.some((card) => card.id === mineId))
  })

  it('source=list не режет набор фильтром JLPT', () => {
    const n5 = buildVocabPool({ ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5 }, [])
    const ids = n5.slice(0, 4).map((card) => card.id)
    const pool = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'list',
        wordJlptLevels: [1],
        newWordLimit: -1,
      },
      [],
      {},
      { applyNewWordLimit: false, trainingWordIds: ids },
    )
    assert.equal(pool.length, 4)
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

  it('trainFullGroup игнорирует лимит слов', () => {
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
      { applyNewWordLimit: true },
    )
    assert.equal(limited.length, all.length)
  })

  it('лимит слов режет пул целиком', () => {
    const base = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: -1 },
      [],
      {},
      { applyNewWordLimit: false },
    )
    assert.ok(base.length > 10)
    const limited = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: 6 },
      [],
      {},
      { applyNewWordLimit: true },
    )
    assert.equal(limited.length, 6)
    assert.deepEqual(
      limited.map((card) => card.id),
      base.slice(0, 6).map((card) => card.id),
    )
  })

  it('лимит 0 дает пустой пул', () => {
    const limited = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, newWordLimit: 0 },
      [],
      {},
      { applyNewWordLimit: true },
    )
    assert.equal(limited.length, 0)
  })

  it('для группы держит стабильный порядок N5→N1 и одинаковый набор', () => {
    const prefs = {
      ...DEFAULT_VOCAB_PREFERENCES,
      source: 'group' as const,
      groupId: 'family',
      newWordLimit: 3,
      trainFullGroup: true,
    }
    const a = buildVocabPool(prefs, [], {}, { applyNewWordLimit: true })
    const b = buildVocabPool(prefs, [], {}, { applyNewWordLimit: true })
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

  it('uniform picker chooses from the full pool without bias to the first card', () => {
    const pool = [{ id: 'word:1' }, { id: 'word:2' }, { id: 'word:3' }]
    assert.equal(pickUniformVocabCardId(pool, { rng: () => 0 }), 'word:1')
    assert.equal(pickUniformVocabCardId(pool, { rng: () => 0.51 }), 'word:2')
    assert.equal(pickUniformVocabCardId(pool, { rng: () => 0.99 }), 'word:3')
  })

  it('uniform picker honors the current-card exclusion', () => {
    const pool = [{ id: 'word:1' }, { id: 'word:2' }, { id: 'word:3' }]
    assert.equal(pickUniformVocabCardId(pool, { excludeIds: ['word:1'], rng: () => 0 }), 'word:2')
    assert.equal(pickUniformVocabCardId(pool, { excludeIds: ['word:1', 'word:2'], rng: () => 0 }), 'word:3')
    assert.equal(pickUniformVocabCardId([{ id: 'word:1' }], { excludeIds: ['word:1'], rng: () => 0 }), 'word:1')
  })

  it('weighted picker respects per-word multipliers', () => {
    const pool = [{ id: 'word:1' }, { id: 'word:2' }, { id: 'word:3' }]
    assert.equal(
      pickWeightedVocabCardId(pool, { weightMultipliers: { 'word:2': 2 }, rng: () => 0.6 }),
      'word:2',
    )
    assert.equal(
      pickWeightedVocabCardId(pool, { weightMultipliers: { 'word:1': 0, 'word:2': 0, 'word:3': 0 }, rng: () => 0.1 }),
      'word:1',
    )
    assert.equal(
      pickWeightedVocabCardId(pool, { excludeIds: ['word:2'], weightMultipliers: { 'word:2': 3 }, rng: () => 0.1 }),
      'word:1',
    )
  })

  it('even mode: вес 1/(1+shows)²', () => {
    const ids = ['a', 'b', 'excluded']
    const weights = buildEvenModeWeightMultipliers(ids, {
      weightMultipliers: { excluded: 0 },
      showCounts: { a: 0, b: 3 },
    })
    assert.equal(weights.a, 1)
    assert.equal(weights.b, 1 / 16)
    assert.equal(weights.excluded, 0)
  })

  it('even mode: мягко предпочитает менее показанные, без 100% детерминизма', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    // Low rng → front of weighted list (a has highest weight when all equal / a unseen).
    assert.equal(
      pickEvenVocabCardId(pool, {
        showCounts: { a: 0, b: 4, c: 4 },
        rng: () => 0,
      }),
      'a',
    )
    // High rng can still pick a more-shown card.
    assert.equal(
      pickEvenVocabCardId(pool, {
        showCounts: { a: 0, b: 1, c: 1 },
        rng: () => 0.999,
      }),
      'c',
    )
    // New card is not forced every other turn when excluded current is the only lagging one
    // — others still have positive weight.
    const counts = { new: 0 as number, other: 0 as number }
    for (let i = 0; i < 200; i += 1) {
      const id = pickEvenVocabCardId(pool, {
        showCounts: { a: 0, b: 3, c: 3 },
        excludeIds: [],
        rng: () => (i + 0.5) / 200,
      })
      if (id === 'a') counts.new += 1
      else counts.other += 1
    }
    assert.ok(counts.new > counts.other, 'unseen should win more often')
    assert.ok(counts.other > 0, 'shown cards must still be pickable')
    assert.ok(counts.new < 200, 'unseen must not win every time')
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

  it('источник problem берёт слова из problemWordIds без лимита новых', () => {
    const custom = {
      id: 'custom:problem',
      writing: '犬',
      kana: 'いぬ',
      romaji: 'inu',
      meanings: ['собака'],
      kanji: ['犬'],
    }
    const pool = buildVocabPool(
      {
        ...DEFAULT_VOCAB_PREFERENCES,
        source: 'problem',
        newWordLimit: 0,
      },
      [],
      { [custom.id]: custom },
      { problemWordIds: [custom.id], applyNewWordLimit: true },
    )
    assert.equal(pool.length, 1)
    assert.equal(pool[0]!.id, custom.id)
  })

  it('строит 6 вариантов перевода с одним верным', () => {
    const words = getJlptWords(5).slice(0, 20)
    const cards = words.map(wordToVocabCard).filter((card): card is NonNullable<typeof card> => Boolean(card))
    const target = cards[0]!
    const options = buildChoiceOptions(target, cards, { rng: () => 0.1 })
    assert.equal(options.length, 6)
    assert.equal(options.filter((item) => item === target.meaning).length, 1)
  })

  it('не тащит в варианты отсылки и нумерацию словаря', () => {
    const cards = [
      wordToVocabCard({
        id: 'a',
        writing: 'あなた',
        kana: 'あなた',
        romaji: 'anata',
        meanings: ['вы (обращение между посторонними, женщинами-подругами и жены к мужу)'],
        jlpt: 5,
        kanji: [],
      }),
      wordToVocabCard({
        id: 'b',
        writing: 'こちら',
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

  it('создает карточку из слова', () => {
    const card = wordToVocabCard({
      id: 'test',
      writing: '猫',
      kana: 'ねこ',
      romaji: 'neko',
      meanings: ['кошка'],
      kanji: ['猫'],
    })
    assert.equal(card?.id, 'test')
  })

  it('не меняет порядок при одинаковом лимите', () => {
    const prefs = {
      ...DEFAULT_VOCAB_PREFERENCES,
      source: 'level' as const,
      level: 5 as const,
      newWordLimit: 3,
    }
    const a = buildVocabPool(prefs, [], {}, { applyNewWordLimit: true })
    const b = buildVocabPool(prefs, [], {}, { applyNewWordLimit: true })
    assert.deepEqual(
      a.map((card) => card.id),
      b.map((card) => card.id),
    )
  })
})
