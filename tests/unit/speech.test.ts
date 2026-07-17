import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeReadingForSpeech, readingsForSpeech } from '../../src/shared/lib/speech'

describe('readingsForSpeech', () => {
  it('чистит точки и дефисы, убирает дубли', () => {
    assert.equal(normalizeReadingForSpeech('た.べる'), 'たべる')
    assert.equal(normalizeReadingForSpeech('-び'), 'び')
    assert.deepEqual(readingsForSpeech(['ニチ', 'ジツ'], ['ひ', '-び', 'ひ']), ['ニチ', 'ジツ', 'ひ', 'び'])
  })
})
