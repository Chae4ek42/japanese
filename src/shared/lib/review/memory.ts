import type { MemoryState, ReviewAspect, ReviewGrade, StatsRecord } from '../types'
import { clamp, hoursBetween } from './math'

export const MEMORY_MODEL_VERSION = 1 as const

/** Stability growth coefficient. */
export const STABILITY_A = 36
/** Stability growth decay with S. */
export const STABILITY_B = 0.2

export const GRADE_MULT: Record<Exclude<ReviewGrade, 1>, number> = {
  2: 0.6,
  3: 1.0,
  4: 1.5,
}

export const INITIAL_S: Record<ReviewGrade, number> = {
  1: 0.3,
  2: 1,
  3: 8,
  4: 24,
}

/** First contact never jumps to the mature Easy interval (24h). */
export function initialStability(grade: ReviewGrade): number {
  return grade === 4 ? INITIAL_S[3] : INITIAL_S[grade]
}

export const LEECH_LAPSES = 6
export const LEECH_STABILITY_HOURS = 24
export const LEECH_DEFER_HOURS = 7 * 24

export function createNewMemoryState(now = Date.now()): MemoryState {
  return {
    s: 0,
    d: 0.3,
    lastAt: 0,
    lastPresentedAt: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    uncertain: false,
    modelVersion: MEMORY_MODEL_VERSION,
    createdAt: now,
  }
}

/** Retention probability given elapsed hours and stability hours. */
export function retention(elapsedHours: number, stabilityHours: number): number {
  if (stabilityHours <= 0) return 0
  if (elapsedHours <= 0) return 1
  return (1 + (19 / 81) * (elapsedHours / stabilityHours)) ** -0.5
}

export function retentionAt(state: MemoryState, now: number): number {
  if (state.state === 'new' || state.s <= 0 || !state.lastAt) return 0
  return retention(hoursBetween(state.lastAt, now), state.s)
}

/** Interval (hours) until retention falls to target r. */
export function intervalHours(stabilityHours: number, targetRetention: number): number {
  const r = clamp(targetRetention, 0.5, 0.99)
  if (stabilityHours <= 0) return 0
  return stabilityHours * (81 / 19) * (r ** -2 - 1)
}

/** Short Russian label for the next due interval. */
export function formatReviewInterval(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return 'скоро'
  const minutes = hours * 60
  if (minutes < 50) return `${Math.max(1, Math.round(minutes))} мин`
  if (hours < 20) return `${Math.max(1, Math.round(hours))} ч`
  const days = hours / 24
  if (days < 10.5) return `${Math.max(1, Math.round(days))} дн.`
  const weeks = days / 7
  if (weeks < 6.5) return `${Math.max(1, Math.round(weeks))} нед.`
  return `${Math.max(1, Math.round(days / 30))} мес.`
}

export function dueAt(state: MemoryState, targetRetention: number): number {
  if (state.state === 'new' || !state.lastAt || state.s <= 0) return 0
  if (state.state === 'leech' && state.leechUntil && state.leechUntil > Date.now()) {
    return state.leechUntil
  }
  const hours = intervalHours(state.s, targetRetention)
  const scale = state.uncertain && state.reps < 2 ? 0.6 : 1
  return state.lastAt + hours * scale * 3_600_000
}

export function isDue(state: MemoryState, now: number, targetRetention: number): boolean {
  if (state.state === 'leech' && state.leechUntil && state.leechUntil > now) return false
  if (state.state === 'new') return false
  if (state.state === 'learning' || state.state === 'relearning') return true
  return retentionAt(state, now) < targetRetention
}

export function memoryKey(cardId: string, aspect: ReviewAspect): string {
  return `${cardId}:${aspect}`
}

export function parseMemoryKey(key: string): { cardId: string; aspect: ReviewAspect } | null {
  const idx = key.lastIndexOf(':')
  if (idx <= 0) return null
  const aspectRaw = key.slice(idx + 1)
  const aspect = Number(aspectRaw)
  if (aspect !== 0 && aspect !== 1) return null
  return { cardId: key.slice(0, idx), aspect: aspect as ReviewAspect }
}

export interface PriorDifficultyHints {
  jlpt?: number
  readingsCount?: number
  /** 0…1, higher = more common / easier. */
  popularity?: number
}

export function initialDifficulty(hints: PriorDifficultyHints = {}, firstGrade: ReviewGrade = 3): number {
  const jlptDifficulty =
    typeof hints.jlpt === 'number' && hints.jlpt >= 1 && hints.jlpt <= 5
      ? (5 - hints.jlpt) / 4
      : 0.5
  const readingsCount = Math.max(1, hints.readingsCount ?? 1)
  const popularity = clamp(hints.popularity ?? 0.5, 0, 1)
  return clamp(
    0.3 +
      0.1 * jlptDifficulty +
      0.06 * (readingsCount - 1) -
      0.05 * popularity +
      0.12 * (3 - firstGrade),
    0.05,
    0.95,
  )
}

function updateDifficulty(d: number, grade: ReviewGrade, uncertain: boolean): number {
  const step = uncertain ? 0.12 : 0.08
  const next = clamp(d - step * (grade - 3), 0.05, 0.95)
  return next + 0.02 * (0.3 - next)
}

function markLeech(state: MemoryState, now: number): MemoryState {
  if (state.lapses < LEECH_LAPSES || state.s >= LEECH_STABILITY_HOURS) return state
  return {
    ...state,
    state: 'leech',
    leechUntil: now + LEECH_DEFER_HOURS * 3_600_000,
  }
}

/** Pure memory update from a graded review. */
export function applyReview(
  existing: MemoryState,
  grade: ReviewGrade,
  now: number,
  hints: PriorDifficultyHints = {},
): MemoryState {
  const prev = { ...existing }
  const elapsed = prev.lastAt ? hoursBetween(prev.lastAt, now) : 0
  const R = prev.state === 'new' || prev.s <= 0 ? 0 : retention(elapsed, prev.s)

  if (prev.state === 'new' || prev.reps === 0) {
    const d = initialDifficulty(hints, grade)
    const s = initialStability(grade)
    let next: MemoryState = {
      ...prev,
      s,
      d,
      lastAt: now,
      reps: 1,
      lapses: grade === 1 ? 1 : 0,
      state: grade === 1 ? 'relearning' : grade <= 2 ? 'learning' : 'review',
      uncertain: false,
      modelVersion: MEMORY_MODEL_VERSION,
    }
    return markLeech(next, now)
  }

  let s = prev.s
  let d = updateDifficulty(prev.d, grade, prev.uncertain)
  let lapses = prev.lapses
  let state = prev.state

  if (grade === 1) {
    lapses += 1
    s = clamp(1.6 * s ** 0.35 * (1 - 0.5 * d), 0.2, 0.6 * s)
    state = 'relearning'
  } else {
    const mult = GRADE_MULT[grade]
    const inc = 1 + STABILITY_A * (1 - R) * (1 - d) * s ** -STABILITY_B * mult
    s = s * clamp(inc, 1.05, 12)
    state = grade === 2 && (prev.state === 'learning' || prev.state === 'relearning') ? 'learning' : 'review'
  }

  let next: MemoryState = {
    ...prev,
    s,
    d,
    lastAt: now,
    reps: prev.reps + 1,
    lapses,
    state,
    uncertain: prev.uncertain && prev.reps + 1 < 2,
    modelVersion: MEMORY_MODEL_VERSION,
  }

  if (next.state === 'leech' && next.leechUntil && next.leechUntil <= now && grade >= 3) {
    next = { ...next, state: 'review', leechUntil: undefined }
  }

  return markLeech(next, now)
}

export function markPresented(state: MemoryState, now: number): MemoryState {
  return { ...state, lastPresentedAt: now }
}

/** Migrate legacy mastery stats into a MemoryState (uncertain). */
export function migrateFromMastery(stats: StatsRecord, now = Date.now()): MemoryState {
  const total = stats.clears + stats.errors + stats.hints
  const errorRate = total ? stats.errors / total : 0
  const hintRate = total ? stats.hints / total : 0
  const lapses = stats.errors + stats.hints
  const mastery = clamp(stats.mastery || 0.12, 0.02, 1)
  const s = clamp(
    Math.exp(1.2 + 3.6 * mastery) * (1 + 0.15 * stats.clears) / (1 + 0.8 * lapses),
    0.5,
    1440,
  )
  const d = clamp(0.3 + 0.35 * errorRate + 0.1 * hintRate, 0.05, 0.95)
  const lastAt = stats.lastClearAt || stats.lastSeenAt || now
  const hadContact = total > 0 || stats.exposures > 0

  return {
    s: hadContact ? s : 0,
    d,
    lastAt: hadContact ? lastAt : 0,
    lastPresentedAt: stats.lastSeenAt || 0,
    reps: stats.clears + stats.hints,
    lapses,
    state: !hadContact
      ? 'new'
      : lapses >= LEECH_LAPSES && s < LEECH_STABILITY_HOURS
        ? 'leech'
        : stats.mastery < 0.45
          ? 'learning'
          : 'review',
    uncertain: true,
    modelVersion: MEMORY_MODEL_VERSION,
    createdAt: now,
    leechUntil:
      lapses >= LEECH_LAPSES && s < LEECH_STABILITY_HOURS
        ? now + LEECH_DEFER_HOURS * 3_600_000
        : undefined,
  }
}

export function urgency(
  state: MemoryState,
  now: number,
  targetRetention: number,
  itemValue = 1,
): number {
  if (state.state === 'leech' && state.leechUntil && state.leechUntil > now) return -1
  if (state.state === 'new') return 0
  if (state.state === 'learning' || state.state === 'relearning') {
    return (targetRetention + 0.15) * itemValue
  }
  const R = retentionAt(state, now)
  return Math.max(0, targetRetention - R) * itemValue
}

export function itemValueFromHints(hints: PriorDifficultyHints = {}): number {
  const jlpt =
    typeof hints.jlpt === 'number' && hints.jlpt >= 1 && hints.jlpt <= 5
      ? 0.55 + ((5 - hints.jlpt) / 4) * 0.45
      : 0.7
  const popularity = clamp(hints.popularity ?? 0.5, 0, 1)
  return clamp(jlpt * (0.7 + 0.3 * popularity), 0.2, 1.5)
}
