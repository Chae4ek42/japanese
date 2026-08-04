import type { ReviewGrade, ReviewSessionState } from '../types'
import { createSeededRng } from './rng'

export const IN_FLIGHT_LIMIT = 5
export const GOOD_LAGS = [6, 14, 30] as const

export function createReviewSessionState(
  planIds: string[],
  {
    mode = 'adaptive',
    seed = 1,
    weightMultipliers = {},
  }: {
    mode?: 'adaptive' | 'even'
    seed?: number
    weightMultipliers?: Record<string, number>
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
  }
}

function jitter(rng: () => number, span = 0.35): number {
  return (rng() - 0.5) * 2 * span
}

/** Introduce next plan card if under the in-flight gate. */
export function introduceNext(
  state: ReviewSessionState,
  urgencyById: Record<string, number> = {},
): ReviewSessionState {
  if (state.done) return state
  if (state.inFlight.length >= IN_FLIGHT_LIMIT) return state
  if (state.planIndex >= state.planIds.length) return state

  let next = { ...state, dueTurns: { ...state.dueTurns }, inFlight: [...state.inFlight] }
  while (next.inFlight.length < IN_FLIGHT_LIMIT && next.planIndex < next.planIds.length) {
    const id = next.planIds[next.planIndex]!
    next.planIndex += 1
    if (next.graduatedIds.includes(id) || next.inFlight.includes(id)) continue
    const mult = next.weightMultipliers[id] ?? 1
    if (mult <= 0) continue
    next.inFlight.push(id)
    next.dueTurns[id] = next.turn + jitter(createSeededRng(next.seed + next.planIndex), 0.2)
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

/**
 * Pick the due in-flight card with lowest dueTurn.
 * If none are due, try introducing; if plan exhausted and queue empty → done.
 */
export function pickNextCard(
  state: ReviewSessionState,
  urgencyById: Record<string, number> = {},
): SequencerPick {
  let next = introduceNext(state, urgencyById)
  const rng = createSeededRng(next.seed + next.turn * 17 + next.answersInSession)

  const due = next.inFlight
    .filter((id) => (next.weightMultipliers[id] ?? 1) > 0)
    .filter((id) => (next.dueTurns[id] ?? Infinity) <= next.turn + 1e-9)

  if (due.length) {
    due.sort((a, b) => {
      const da = next.dueTurns[a] ?? 0
      const db = next.dueTurns[b] ?? 0
      if (da !== db) return da - db
      const ua = (urgencyById[a] ?? 0) * (next.weightMultipliers[a] ?? 1)
      const ub = (urgencyById[b] ?? 0) * (next.weightMultipliers[b] ?? 1)
      if (ua !== ub) return ub - ua
      return rng() - 0.5
    })
    return { kind: 'card', cardId: due[0]!, state: next }
  }

  // Nothing due yet — introduce more if possible, else wait / finish.
  if (next.planIndex < next.planIds.length && next.inFlight.length < IN_FLIGHT_LIMIT) {
    next = introduceNext(next, urgencyById)
    const introduced = next.inFlight.find((id) => (next.dueTurns[id] ?? Infinity) <= next.turn + 1e-9)
    if (introduced) return { kind: 'card', cardId: introduced, state: next }
  }

  if (!next.inFlight.length && next.planIndex >= next.planIds.length) {
    return { kind: 'done', state: { ...next, done: true } }
  }

  if (
    next.targetAnswers > 0 &&
    next.answersInSession >= next.targetAnswers &&
    !next.inFlight.some((id) => (next.goodStreaks[id] ?? 0) === 0)
  ) {
    // Soft finish: only force done when nothing struggling.
    const struggling = next.inFlight.some((id) => (next.goodStreaks[id] ?? 0) < 1)
    if (!struggling) return { kind: 'done', state: { ...next, done: true } }
  }

  // Advance virtual time to nearest due card so the session never stalls.
  if (next.inFlight.length) {
    const nearest = Math.min(...next.inFlight.map((id) => next.dueTurns[id] ?? next.turn))
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

  if (grade === 1) {
    next.goodStreaks[cardId] = 0
    next.dueTurns[cardId] = next.turn + 2
    return next
  }

  if (grade === 2) {
    next.goodStreaks[cardId] = 0
    next.dueTurns[cardId] = next.turn + 4
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

  const lag = GOOD_LAGS[Math.min(streak - 1, GOOD_LAGS.length - 1)] ?? 30
  next.dueTurns[cardId] = next.turn + lag
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
