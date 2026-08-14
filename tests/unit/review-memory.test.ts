import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyReview,
  createNewMemoryState,
  formatReviewInterval,
  INITIAL_S,
  intervalEffectHolds,
  intervalHours,
  migrateFromMastery,
  retention,
  retentionAt,
} from '../../src/shared/lib/review'
import { createStatsRecord } from '../../src/shared/lib/trainer'

describe('review memory model', () => {
  it('R(t,S) is 0.9 when t = S', () => {
    assert.ok(Math.abs(retention(24, 24) - 0.9) < 1e-9)
  })

  it('R decreases in t and increases in S', () => {
    assert.ok(retention(48, 24) < retention(24, 24))
    assert.ok(retention(24, 48) > retention(24, 24))
  })

  it('interval inverse matches target retention', () => {
    const s = 30
    const hours = intervalHours(s, 0.9)
    assert.ok(Math.abs(hours - s) < 1e-6)
  })

  it('formats next-review intervals in Russian', () => {
    assert.equal(formatReviewInterval(0.2), '12 мин')
    assert.equal(formatReviewInterval(8), '8 ч')
    assert.equal(formatReviewInterval(48), '2 дн.')
    assert.equal(formatReviewInterval(21 * 24), '3 нед.')
    assert.equal(formatReviewInterval(90 * 24), '3 мес.')
  })

  it('first easy uses the good interval, not 24h', () => {
    const next = applyReview(createNewMemoryState(1000), 4, 1000)
    assert.equal(next.s, INITIAL_S[3])
    assert.ok(next.s < INITIAL_S[4])
    const later = applyReview(next, 4, 1000 + 10 * 3_600_000)
    assert.ok(later.s > next.s)
  })

  it('failure never increases stability', () => {
    const base = {
      ...createNewMemoryState(1),
      s: 100,
      d: 0.3,
      lastAt: 1,
      reps: 5,
      state: 'review' as const,
    }
    const next = applyReview(base, 1, 1 + 20 * 3_600_000)
    assert.ok(next.s < base.s)
  })

  it('later review grows S more (interval effect)', () => {
    assert.equal(intervalEffectHolds(24, 0.3, 4, 30), true)
  })

  it('replay-style successive applies are deterministic', () => {
    let state = createNewMemoryState(1000)
    state = applyReview(state, 3, 1000)
    const mid = { ...state }
    state = applyReview(state, 3, 1000 + 10 * 3_600_000)
    const again = applyReview(mid, 3, 1000 + 10 * 3_600_000)
    assert.equal(state.s, again.s)
    assert.equal(state.d, again.d)
  })

  it('migrates mastery into uncertain memory', () => {
    const stats = {
      ...createStatsRecord(),
      mastery: 0.85,
      clears: 10,
      errors: 1,
      lastClearAt: Date.parse('2026-08-01T00:00:00Z'),
    }
    const mem = migrateFromMastery(stats, Date.parse('2026-08-04T00:00:00Z'))
    assert.equal(mem.uncertain, true)
    assert.ok(mem.s > 24)
    assert.ok(retentionAt(mem, Date.parse('2026-08-04T00:00:00Z')) > 0)
  })
})
