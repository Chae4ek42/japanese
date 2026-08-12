import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isColloquialWord } from '../../src/shared/lib/colloquial'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/slices/vocab'
import { buildVocabPool } from '../../src/features/vocab/pool'
import { getColloquialWords } from '../../src/data/words/bank'

describe('colloquial words', () => {
  it('детектит пометы (разг.) и (прост.)', () => {
    assert.equal(
      isColloquialWord({
        meanings: ['(разг.) круто'],
        readings: [],
      }),
      true,
    )
    assert.equal(
      isColloquialWord({
        meanings: ['обычное значение'],
        readings: [{ kana: 'あ', romaji: 'a', meanings: ['(прост.) да'] }],
      }),
      true,
    )
    assert.equal(
      isColloquialWord({
        meanings: ['нейтрально'],
        readings: [],
      }),
      false,
    )
  })

  it('getColloquialWords возвращает непустой список', () => {
    const list = getColloquialWords()
    assert.ok(list.length > 100)
    assert.ok(list.every((word) => isColloquialWord(word)))
  })

  it('includeColloquial=false убирает разговорные из пула уровня', () => {
    const withColloq = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, includeColloquial: true },
      [],
    )
    const without = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'level', level: 5, includeColloquial: false },
      [],
    )
    assert.ok(without.length < withColloq.length)
    const withoutIds = new Set(without.map((card) => card.id))
    const removed = withColloq.filter((card) => !withoutIds.has(card.id))
    assert.ok(removed.length > 0)
  })
})
