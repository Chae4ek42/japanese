import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getWordLearningEvidence, summarizeWordLearning } from '../../src/shared/lib/learningProgress.ts'
import { createStatsRecord } from '../../src/shared/lib/trainer.ts'

test('legacy mastery and saved/manual words do not establish recall', () => {
  const stats = { ...createStatsRecord(), clears: 100, mastery: 1 }
  assert.equal(getWordLearningEvidence(stats).status, 'unpracticed')
  assert.deepEqual(summarizeWordLearning(['saved', 'saved'], { saved: stats }), {
    total: 1, practiced: 0, confirmed: 0, attempts: 0, estimatedStrength: null,
  })
})

test('recall requires repeated successes and retains sample size', () => {
  const record = (attempts: number, streak: number, strength: number) => ({
    ...createStatsRecord(), wordPractice: { attempts, streak, strength, lapses: 0, lastAnsweredAt: 1 },
  })
  assert.equal(getWordLearningEvidence(record(1, 1, 1)).confirmed, false)
  assert.equal(getWordLearningEvidence(record(8, 0, 0.9)).confirmed, false)
  const summary = summarizeWordLearning(['a', 'b', 'a', 'c'], { a: record(3, 3, 0.8), b: record(1, 1, 0.2) })
  assert.equal(summary.total, 3)
  assert.equal(summary.confirmed, 1)
  assert.equal(summary.practiced, 2)
  assert.equal(summary.attempts, 4)
  assert.equal(summary.estimatedStrength, 0.5)
})
