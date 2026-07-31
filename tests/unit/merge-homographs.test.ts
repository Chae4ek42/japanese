import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getWordById, getWordsByWriting } from '../../src/data/words/bank'
import { mergeWordsByWriting, wordVariantIds } from '../../src/features/vocab/mergeHomographs'
import { wordToVocabCard } from '../../src/features/vocab/pool'

describe('merge homographs', () => {
  it('объединяет 私 с разными чтениями в один объект', () => {
    const entries = getWordsByWriting('私')
    assert.ok(entries.length >= 2)
    const merged = mergeWordsByWriting(entries)
    assert.equal(merged.length, 1)
    const word = merged[0]!
    assert.equal(word.writing, '私')
    assert.ok((word.readings?.length ?? 0) >= 2)
    const romaji = new Set((word.readings ?? []).map((reading) => reading.romaji))
    assert.ok(romaji.has('watashi'))
    assert.ok(romaji.has('watakushi'))
    assert.ok(wordVariantIds(word).length >= 2)
  })

  it('принимает любой ромадзи варианта в VocabCard.answers', () => {
    const watashi = getWordById('1311110')
    const watakushi = getWordById('2842390')
    assert.ok(watashi && watakushi)
    const card = wordToVocabCard(mergeWordsByWriting([watashi, watakushi])[0]!)
    assert.ok(card)
    assert.ok(card.answers.includes('watashi'))
    assert.ok(card.answers.includes('watakushi'))
    assert.ok((card.readings?.length ?? 0) >= 2)
  })

  it('не сливает разные написания', () => {
    const a = getWordById('1311110')
    const b = getWordById('1582920') // 日 or something different - use family word
    assert.ok(a)
    // pick a clearly different writing from bank
    const other = getWordsByWriting('父')[0]
    assert.ok(other)
    const merged = mergeWordsByWriting([a, other])
    assert.equal(merged.length, 2)
  })
})
