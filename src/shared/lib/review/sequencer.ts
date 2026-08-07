import type { ReviewGrade, ReviewSessionState } from '../types'
import { createSeededRng } from './rng'

/** Default / SRS working-set size. Drill uses a larger limit via `inFlightLimit`. */
export const IN_FLIGHT_LIMIT = 5
/** Base lags after 1st / 2nd good before graduation; scaled up by working-set size. */
export const GOOD_LAGS = [8, 16, 30] as const

/**
 * Working-set size for a session.
 * SRS stays tight (leitner-style). Drill scales with the pool so «адаптивный»
 * covers more than five words before anything graduates.
 */
export function defaultInFlightLimit(planSize: number, spaced = false): number {
  if (spaced) return IN_FLIGHT_LIMIT
  if (planSize <= 0) return IN_FLIGHT_LIMIT
  return Math.min(planSize, Math.max(12, Math.ceil(planSize * 0.4)))
}

export function resolveInFlightLimit(state: ReviewSessionState): number {
  const raw = state.inFlightLimit
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return Math.max(1, Math.round(raw))
  }
  return IN_FLIGHT_LIMIT
}

export function createReviewSessionState(
  planIds: string[],
  {
    mode = 'adaptive',
    seed = 1,
    weightMultipliers = {},
    inFlightLimit,
  }: {
    mode?: 'adaptive' | 'even'
    seed?: number
    weightMultipliers?: Record<string, number>
    inFlightLimit?: number
  } = {},
): ReviewSessionState {
  return {
    turn: 0,
    planIds: [...planIds],
    planIndex: 0,
    dueTurns: {},
    inFlight: [],
    goodStreaks: {},
    graduatedIds: [],
    seed,
    mode,
    weightMultipliers: { ...weightMultipliers },
    answersInSession: 0,
    targetAnswers: 0,
    done: false,
    inFlightLimit,
  }
}

function activeInFlight(state: ReviewSessionState): string[] {
  return state.inFlight.filter((id) => (state.weightMultipliers[id] ?? 1) > 0)
}

function dueInFlight(state: ReviewSessionState): string[] {
  return activeInFlight(state).filter(
    (id) => (state.dueTurns[id] ?? Infinity) <= state.turn + 1e-9,
  )
}

function nearestDueTurn(state: ReviewSessionState): number {
  const active = activeInFlight(state)
  if (!active.length) return state.turn
  return Math.min(...active.map((id) => state.dueTurns[id] ?? state.turn))
}

/** Lag that rotates through the current working set before the card returns. */
export function learningLag(inFlightCount: number, base: number): number {
  return Math.max(base, inFlightCount)
}

/**
 * Introduce a new plan card when the working set has a free slot.
 * Prefer showing due learners first (caller checks due before calling this);
 * do not block refill with a large gap gate — that trapped small sets in a loop.
 */
export function shouldIntroduce(state: ReviewSessionState): boolean {
  if (state.done) return false
  if (state.planIndex >= state.planIds.length) return false
  return activeInFlight(state).length < resolveInFlightLimit(state)
}

/** Introduce next plan card if under the in-flight gate. */
export function introduceNext(
  state: ReviewSessionState,
  urgencyById: Record<string, number> = {},
): ReviewSessionState {
  if (!shouldIntroduce(state)) return state

  const limit = resolveInFlightLimit(state)
  let next = { ...state, dueTurns: { ...state.dueTurns }, inFlight: [...state.inFlight] }
  while (activeInFlight(next).length < limit && next.planIndex < next.planIds.length) {
    const id = next.planIds[next.planIndex]!
    next.planIndex += 1
    if (next.graduatedIds.includes(id) || next.inFlight.includes(id)) continue
    const mult = next.weightMultipliers[id] ?? 1
    if (mult <= 0) continue
    next.inFlight.push(id)
    // Immediately due so the newcomer can be shown this pick (no future jitter).
    next.dueTurns[id] = next.turn
    // Bias introduction order already encoded in plan; urgency reserved for ties.
    void urgencyById
    break
  }
  return next
}

export type SequencerPick =
  | { kind: 'card'; cardId: string; state: ReviewSessionState }
  | { kind: 'done'; state: ReviewSessionState }
  | { kind: 'waiting'; state: ReviewSessionState }

function selectDueCard(
  state: ReviewSessionState,
  due: string[],
  urgencyById: Record<string, number>,
): SequencerPick {
  const rng = createSeededRng(state.seed + state.turn * 17 + state.answersInSession)
  const ranked = [...due].sort((a, b) => {
    const da = state.dueTurns[a] ?? 0
    const db = state.dueTurns[b] ?? 0
    if (da !== db) return da - db
    const ua = (urgencyById[a] ?? 0) * (state.weightMultipliers[a] ?? 1)
    const ub = (urgencyById[b] ?? 0) * (state.weightMultipliers[b] ?? 1)
    if (ua !== ub) return ub - ua
    return rng() - 0.5
  })
  return { kind: 'card', cardId: ranked[0]!, state }
}

/**
 * Pick next card.
 * While the working set has free slots, introduce and show the newcomer first —
 * otherwise short again-lags recycle the first handful and never fill K.
 * Once full, prefer the earliest-due in-flight card.
 */
export function pickNextCard(
  state: ReviewSessionState,
  urgencyById: Record<string, number> = {},
): SequencerPick {
  let next = state

  // Fill free slots: introduce one and show it immediately (don't let older dues steal the pick).
  if (shouldIntroduce(next)) {
    const before = new Set(next.inFlight)
    next = introduceNext(next, urgencyById)
    const added = next.inFlight.find((id) => !before.has(id))
    if (added) {
      return { kind: 'card', cardId: added, state: next }
    }
  }

  const dueNow = dueInFlight(next)
  if (dueNow.length) {
    return selectDueCard(next, dueNow, urgencyById)
  }

  if (!activeInFlight(next).length && next.planIndex >= next.planIds.length) {
    return { kind: 'done', state: { ...next, done: true } }
  }

  // Do not soft-stop on targetAnswers — that felt like a random «На сегодня всё»
  // while words were still left. Session ends only when the plan is exhausted.

  // Advance virtual time to nearest due learner instead of stuffing more new cards.
  if (activeInFlight(next).length) {
    const nearest = nearestDueTurn(next)
    if (nearest > next.turn) {
      next = { ...next, turn: nearest }
      return pickNextCard(next, urgencyById)
    }
  }

  return { kind: 'waiting', state: next }
}

export function applyGradeToSequencer(
  state: ReviewSessionState,
  cardId: string,
  grade: ReviewGrade,
): ReviewSessionState {
  const next: ReviewSessionState = {
    ...state,
    turn: state.turn + 1,
    answersInSession: state.answersInSession + 1,
    dueTurns: { ...state.dueTurns },
    goodStreaks: { ...state.goodStreaks },
    inFlight: [...state.inFlight],
    graduatedIds: [...state.graduatedIds],
  }

  if (!next.inFlight.includes(cardId)) {
    next.inFlight.push(cardId)
  }

  const working = Math.max(1, activeInFlight(next).length)

  if (grade === 1) {
    next.goodStreaks[cardId] = 0
    // Rotate through the whole working set before the same new/failing card returns.
    next.dueTurns[cardId] = next.turn + learningLag(working, 3)
    return next
  }

  if (grade === 2) {
    // Slow / soft typo: delay return, but keep graduation progress so a run of
    // "correct but slow" answers cannot freeze the same small working set forever.
    next.dueTurns[cardId] = next.turn + learningLag(working, 5)
    return next
  }

  // good / easy
  const streak = (next.goodStreaks[cardId] ?? 0) + 1
  next.goodStreaks[cardId] = streak

  if (grade === 4 || streak >= 2) {
    next.inFlight = next.inFlight.filter((id) => id !== cardId)
    if (!next.graduatedIds.includes(cardId)) next.graduatedIds.push(cardId)
    delete next.dueTurns[cardId]
    return next
  }

  const baseLag = GOOD_LAGS[Math.min(streak - 1, GOOD_LAGS.length - 1)] ?? 30
  next.dueTurns[cardId] = next.turn + learningLag(working, baseLag)
  return next
}

/** Pull similar cards' dueTurns closer for contrastive review. */
export function attractConfusedPair(
  state: ReviewSessionState,
  cardId: string,
  otherId: string,
  gap = 1,
): ReviewSessionState {
  if (!state.inFlight.includes(cardId) || !state.inFlight.includes(otherId)) return state
  const base = state.dueTurns[cardId] ?? state.turn
  return {
    ...state,
    dueTurns: {
      ...state.dueTurns,
      [otherId]: Math.min(state.dueTurns[otherId] ?? base + gap, base + gap),
    },
  }
}

export function setReviewWeight(
  state: ReviewSessionState,
  cardId: string,
  multiplier: number,
): ReviewSessionState {
  const weightMultipliers = { ...state.weightMultipliers }
  if (Math.abs(multiplier - 1) < 0.01) delete weightMultipliers[cardId]
  else weightMultipliers[cardId] = Math.max(0, multiplier)

  let next: ReviewSessionState = { ...state, weightMultipliers }
  if ((weightMultipliers[cardId] ?? 1) <= 0) {
    next = {
      ...next,
      inFlight: next.inFlight.filter((id) => id !== cardId),
    }
    delete next.dueTurns[cardId]
  }
  return next
}

export function dropFromReview(state: ReviewSessionState, cardId: string): ReviewSessionState {
  const dueTurns = { ...state.dueTurns }
  delete dueTurns[cardId]
  const goodStreaks = { ...state.goodStreaks }
  delete goodStreaks[cardId]
  return {
    ...state,
    planIds: state.planIds.filter((id) => id !== cardId),
    inFlight: state.inFlight.filter((id) => id !== cardId),
    graduatedIds: state.graduatedIds.filter((id) => id !== cardId),
    dueTurns,
    goodStreaks,
  }
}

/** Mid-session expand: append a source word so the sequencer can introduce it. */
export function appendToReviewPlan(state: ReviewSessionState, cardId: string): ReviewSessionState {
  if (
    state.planIds.includes(cardId) ||
    state.inFlight.includes(cardId) ||
    state.graduatedIds.includes(cardId)
  ) {
    return state
  }
  return {
    ...state,
    planIds: [...state.planIds, cardId],
    done: false,
  }
}
