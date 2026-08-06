import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateStatsMap,
  buildActivitySeries,
  buildSectionLifetime,
  sumLastDays,
} from '../../src/features/analytics/analyticsAggregates.ts'
import { createStatsRecord } from '../../src/shared/lib/trainer.ts'
import { getDayKey } from '../../src/shared/lib/trainer.ts'
import { emptySectionMap } from '../../src/shared/state/slices/analytics.ts'

describe('analyticsAggregates', () => {
  it('sumLastDays суммирует окно', () => {
    const now = Date.parse('2026-08-06T12:00:00')
    const days = [
      { dayKey: getDayKey(now), totalActiveMs: 1000, bySection: {} },
      { dayKey: getDayKey(now - 86_400_000), totalActiveMs: 2000, bySection: {} },
      { dayKey: getDayKey(now - 10 * 86_400_000), totalActiveMs: 9999, bySection: {} },
    ]
    assert.equal(sumLastDays(days, 7, now), 3000)
  })

  it('buildActivitySeries всегда длины N', () => {
    const series = buildActivitySeries([], 10, Date.parse('2026-08-06T12:00:00'))
    assert.equal(series.length, 10)
  })

  it('buildSectionLifetime фильтрует нули', () => {
    const map = emptySectionMap()
    map.train = 120_000
    map.kana = 60_000
    const rows = buildSectionLifetime(map)
    assert.deepEqual(
      rows.map((row) => row.section),
      ['kana', 'train'],
    )
  })

  it('aggregateStatsMap считает mastery buckets', () => {
    const stats = {
      a: { ...createStatsRecord(), exposures: 2, clears: 4, errors: 1, mastery: 0.2, eventAccuracy: 80 },
      b: { ...createStatsRecord(), exposures: 2, clears: 5, errors: 0, mastery: 0.8, eventAccuracy: 100 },
      c: createStatsRecord(),
    }
    const agg = aggregateStatsMap(stats)
    assert.equal(agg.mastery.weak, 1)
    assert.equal(agg.mastery.strong, 1)
    assert.equal(agg.mastery.untouched, 1)
    assert.equal(agg.accuracy, 90)
  })
})
