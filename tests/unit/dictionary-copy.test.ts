import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatWritingsForClipboard } from '../../src/features/vocab/copyWritings.ts'
import type { KanjiWord } from '../../src/shared/lib/types'

function word(writing: string): KanjiWord {
  return {
    id: writing,
    writing,
    kana: writing,
    romaji: writing,
    meanings: [writing],
  }
}

describe('formatWritingsForClipboard', () => {
  it('склеивает написания через пробел', () => {
    assert.equal(formatWritingsForClipboard([word('猫'), word('犬'), word('鳥')]), '猫 犬 鳥')
  })

  it('пропускает пустые написания', () => {
    assert.equal(formatWritingsForClipboard([word('  '), word('猫'), word('')]), '猫')
  })
})
