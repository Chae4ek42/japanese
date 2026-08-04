import type { ReviewEvent } from '../types'
import { applyReview, createNewMemoryState, retention } from './memory'
import type { MemoryState, ReviewGrade } from '../types'
import { hoursBetween } from './math'

export interface CalibrationBucket {
  /** Midpoint of predicted R. */
  predicted: number
  /** Empirical success rate (grade >= 3). */
  actual: number
  count: number
}

export interface CalibrationReport {
  buckets: CalibrationBucket[]
  logLoss: number
  rmse: number
  trueRetention: number
  reviewCount: number
}

function gradeSuccess(grade: ReviewGrade): boolean {
  return grade >= 3
}

export function computeCalibration(events: ReviewEvent[], bucketCount = 5): CalibrationReport {
  const reviews = events.filter((event) => event.g >= 1)
  if (!reviews.length) {
    return { buckets: [], logLoss: 0, rmse: 0, trueRetention: 0, reviewCount: 0 }
  }

  const buckets: Array<{ sumPred: number; sumAct: number; count: number }> = Array.from(
    { length: bucketCount },
    () => ({ sumPred: 0, sumAct: 0, count: 0 }),
  )

  let logLossSum = 0
  let sqErr = 0
  let success = 0

  for (const event of reviews) {
    const predicted = clamp01(event.r / 1000)
    const actual = gradeSuccess(event.g as ReviewGrade) ? 1 : 0
    success += actual
    const p = clamp01(predicted, 1e-6, 1 - 1e-6)
    logLossSum += -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p))
    sqErr += (predicted - actual) ** 2
    const idx = Math.min(bucketCount - 1, Math.floor(predicted * bucketCount))
    const bucket = buckets[idx]!
    bucket.sumPred += predicted
    bucket.sumAct += actual
    bucket.count += 1
  }

  const n = reviews.length
  return {
    buckets: buckets
      .map((bucket, index) => ({
        predicted: bucket.count ? bucket.sumPred / bucket.count : (index + 0.5) / bucketCount,
        actual: bucket.count ? bucket.sumAct / bucket.count : 0,
        count: bucket.count,
      }))
      .filter((bucket) => bucket.count > 0),
    logLoss: logLossSum / n,
    rmse: Math.sqrt(sqErr / n),
    trueRetention: success / n,
    reviewCount: n,
  }
}

/** Replay journal into memory map (pure, for modelVersion migrations). */
export function replayEvents(
  events: ReviewEvent[],
  initial: Record<string, MemoryState> = {},
): Record<string, MemoryState> {
  const out: Record<string, MemoryState> = { ...initial }
  const sorted = [...events].sort((a, b) => a.t - b.t)
  for (const event of sorted) {
    const key = `${event.c}:${event.a}`
    const prev = out[key] ?? createNewMemoryState(event.t)
    out[key] = applyReview(prev, event.g as ReviewGrade, event.t)
  }
  return out
}

/** Property helper: later review (lower R) should grow S more, ceteris paribus. */
export function intervalEffectHolds(
  s: number,
  d: number,
  earlyHours: number,
  lateHours: number,
): boolean {
  const base: MemoryState = {
    s,
    d,
    lastAt: 1,
    lastPresentedAt: 1,
    reps: 3,
    lapses: 0,
    state: 'review',
    uncertain: false,
    modelVersion: 1,
    createdAt: 1,
  }
  const early = applyReview(base, 3, 1 + earlyHours * 3_600_000)
  const late = applyReview(base, 3, 1 + lateHours * 3_600_000)
  return late.s > early.s
}

export function forecastDueCount(
  memory: Record<string, MemoryState>,
  targetRetention: number,
  days: number,
  now = Date.now(),
): number[] {
  const out: number[] = []
  for (let day = 0; day < days; day += 1) {
    const t = now + day * 86_400_000
    let count = 0
    for (const state of Object.values(memory)) {
      if (state.state === 'new' || state.s <= 0 || !state.lastAt) continue
      if (state.state === 'leech' && state.leechUntil && state.leechUntil > t) continue
      const R = retention(hoursBetween(state.lastAt, t), state.s)
      if (R < targetRetention) count += 1
    }
    out.push(count)
  }
  return out
}

function clamp01(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}
