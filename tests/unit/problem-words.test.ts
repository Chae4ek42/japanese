import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rankProblemWords, rankedProblemWordIds, scoreProblemWord } from '../../src/features/vocab/problemWords.ts'
import { createStatsRecord } from '../../src/shared/lib/trainer.ts'

const evidence = (pattern: string) => ({ ...createStatsRecord(), recentAnswers: [...pattern].map((value) => value === 'x' ? 'wrong' as const : 'correct' as const) })

describe('recent problem-word evidence', () => {
  it('requires five settled answers and ignores lifetime-only errors', () => {
    assert.equal(scoreProblemWord(evidence('xxxx')), null)
    assert.equal(scoreProblemWord({ ...createStatsRecord(), errors: 200, hints: 30 }), null)
    assert.equal(scoreProblemWord(evidence('xxxxx'))?.eligible, true)
    assert.equal(scoreProblemWord(evidence('ooooo'))?.eligible, false)
  })

  it('recency reverses ranking for equal lifetime error counts', () => {
    const recovered = scoreProblemWord(evidence('xxxxxoooooooooo'))!
    const failing = scoreProblemWord(evidence('ooooooooooxxxxx'))!
    assert.equal(recovered.eligible, false)
    assert.equal(failing.eligible, true)
    assert.ok(failing.score > recovered.score * 2)
    assert.equal(scoreProblemWord(evidence('oooox'))?.eligible, false, 'one slip must not label a word difficult')
    assert.equal(scoreProblemWord(evidence('oooxx'))?.eligible, true, 'two fresh consecutive failures warrant attention')
  })

  it('shrinks sparse evidence, deduplicates IDs, and applies a top-N cap after ranking', () => {
    const sparse = scoreProblemWord(evidence('xxxxx'))!
    const dense = scoreProblemWord(evidence('xxxxxxxxxxxxxxx'))!
    assert.ok(dense.score > sparse.score)
    const stats = { a: evidence('oooxx'), b: evidence('xxxxx'), c: evidence('ooooo') }
    assert.deepEqual(rankedProblemWordIds(['a', 'a', 'c', 'b'], stats), ['b', 'a'])
    assert.deepEqual(rankedProblemWordIds(['a', 'b'], stats, { limit: 1 }), ['b'])
    assert.equal(rankProblemWords(['a'], stats)[0].recentCount, 5)
  })
})
