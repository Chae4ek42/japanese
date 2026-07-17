import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/app-state'
import {
  buildChoiceOptions,
  buildVocabPool,
  normalizeRomajiAnswer,
  wordToVocabCard,
} from '../../src/features/vocab/pool'
import { getJlptWords } from '../../src/features/kanji/data/bank'

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

  it('строит 6 вариантов перевода с одним верным', () => {
    const words = getJlptWords(5).slice(0, 20)
    const cards = words.map(wordToVocabCard).filter((card): card is NonNullable<typeof card> => Boolean(card))
    const target = cards[0]
    const options = buildChoiceOptions(target, cards, { rng: () => 0.1 })
    assert.equal(options.length, 6)
    assert.equal(options.filter((item) => item === target.meaning).length, 1)
  })
})
