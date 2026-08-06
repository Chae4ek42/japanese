import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ACTIVE_FLUSH_EVERY_MS,
  ACTIVE_IDLE_MS,
  createActiveTimeEngine,
  noteInput,
  pauseActive,
  setSection,
  takePendingFlush,
  tickActive,
} from '../../src/shared/lib/active-time.ts'
import {
  applyActiveTimeDelta,
  bumpAnalyticsAnswers,
  computeActiveDayStreak,
  createDefaultAnalyticsState,
  sanitizeAnalyticsState,
  trimAnalyticsDays,
} from '../../src/shared/state/slices/analytics.ts'

describe('active-time engine', () => {
  it('копит время только после input и до idle', () => {
    const t0 = 1_000_000
    let state = createActiveTimeEngine('train', t0)
    state = noteInput(state, t0)
    state = tickActive(state, t0 + 5_000)
    const flushed = takePendingFlush(state, { force: true })
    assert.equal(flushed.deltas.length, 1)
    assert.equal(flushed.deltas[0]?.section, 'train')
    assert.equal(flushed.deltas[0]?.deltaMs, 5_000)
  })

  it('останавливается после idle timeout', () => {
    const t0 = 2_000_000
    let state = createActiveTimeEngine('kana', t0)
    state = noteInput(state, t0)
    state = tickActive(state, t0 + ACTIVE_IDLE_MS + 100)
    assert.equal(state.isActive, false)
    const flushed = takePendingFlush(state, { force: true })
    assert.ok((flushed.deltas[0]?.deltaMs ?? 0) >= ACTIVE_IDLE_MS)
  })

  it('меняет секцию и flush-ит предыдущую', () => {
    const t0 = 3_000_000
    let state = createActiveTimeEngine('vocab', t0)
    state = noteInput(state, t0)
    state = setSection(state, 'mine', t0 + 2_000)
    const flushed = takePendingFlush(state, { force: true })
    assert.deepEqual(
      flushed.deltas.map((d) => d.section).sort(),
      ['vocab'],
    )
    assert.equal(flushed.deltas[0]?.deltaMs, 2_000)
  })

  it('debounce flush без force', () => {
    const t0 = 4_000_000
    let state = createActiveTimeEngine('home', t0)
    state = noteInput(state, t0)
    state = tickActive(state, t0 + 1_000)
    const soft = takePendingFlush(state, { force: false })
    assert.equal(soft.deltas.length, 0)
    state = soft.state
    state = tickActive(state, t0 + ACTIVE_FLUSH_EVERY_MS + 500)
    const hard = takePendingFlush(state, { force: false })
    assert.ok(hard.deltas.length >= 1)
  })

  it('pauseActive закрывает сегмент', () => {
    const t0 = 5_000_000
    let state = createActiveTimeEngine('kanji', t0)
    state = noteInput(state, t0)
    state = pauseActive(state, t0 + 3_000)
    assert.equal(state.isActive, false)
    const flushed = takePendingFlush(state, { force: true })
    assert.equal(flushed.deltas[0]?.deltaMs, 3_000)
  })
})

describe('analytics sanitize / deltas', () => {
  it('sanitize даёт default при мусоре', () => {
    const fallback = createDefaultAnalyticsState(0)
    const state = sanitizeAnalyticsState({ lifetimeActiveMs: -5, days: 'nope' }, fallback)
    assert.equal(state.lifetimeActiveMs, 0)
    assert.deepEqual(state.days, [])
  })

  it('applyActiveTimeDelta пишет day bucket и streak', () => {
    const now = Date.parse('2026-08-06T12:00:00')
    let state = createDefaultAnalyticsState(now)
    state = applyActiveTimeDelta(state, { section: 'train', deltaMs: 60_000, now })
    assert.equal(state.lifetimeActiveMs, 60_000)
    assert.equal(state.bySection.train, 60_000)
    assert.equal(state.days.length, 1)
    assert.equal(state.days[0]?.totalActiveMs, 60_000)
    assert.equal(state.activeDayStreak, 1)
  })

  it('trimAnalyticsDays режет до лимита', () => {
    const days = Array.from({ length: 95 }, (_, i) => ({
      dayKey: `2026-01-${String(i + 1).padStart(2, '0')}`.slice(0, 10),
      totalActiveMs: 1,
      bySection: { home: 1 },
    }))
    // Fix invalid day keys for months
    const fixed = Array.from({ length: 95 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i))
      const key = d.toISOString().slice(0, 10)
      return { dayKey: key, totalActiveMs: 1, bySection: { home: 1 as number } }
    })
    assert.equal(trimAnalyticsDays(fixed, 90).length, 90)
  })

  it('bumpAnalyticsAnswers не требует активного времени', () => {
    const now = Date.parse('2026-08-06T15:00:00')
    const state = bumpAnalyticsAnswers(createDefaultAnalyticsState(now), { clean: true, now })
    assert.equal(state.days[0]?.answers, 1)
    assert.equal(state.days[0]?.cleanAnswers, 1)
  })

  it('computeActiveDayStreak считает подряд', () => {
    const days = [
      { dayKey: '2026-08-04', totalActiveMs: 1000, bySection: {} },
      { dayKey: '2026-08-05', totalActiveMs: 1000, bySection: {} },
      { dayKey: '2026-08-06', totalActiveMs: 1000, bySection: {} },
    ]
    assert.equal(computeActiveDayStreak(days, '2026-08-06', '2026-08-06'), 3)
    assert.equal(computeActiveDayStreak(days, '2026-08-05', '2026-08-06'), 2)
  })
})
