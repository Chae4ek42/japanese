import type { AdaptiveWindowState, StatsOutcome, StatsRecord, WordPracticeStats } from '../../shared/lib/types'

// The default is independent of deck size; users can choose a bounded workload.
export const WINDOW_SIZE = 5
export const READY_STRENGTH = 0.72
export const MAX_ACTIVE_ATTEMPTS = 8
export const REVIEW_GAP = 4
const MAX_REVIEW_INTERVAL = 160
const DAY = 86_400_000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function wordPracticeStats(stats: StatsRecord | undefined): WordPracticeStats {
  if (stats?.wordPractice) return stats.wordPractice
  const total = (stats?.clears ?? 0) + (stats?.errors ?? 0) + (stats?.hints ?? 0)
  return {
    // Legacy progress is evidence, but needs confirmation in the new trainer.
    strength: total ? clamp(stats?.mastery ?? 0.15, 0, 0.7) : 0.15,
    attempts: total,
    streak: stats?.streak ?? 0,
    lapses: (stats?.errors ?? 0) + (stats?.hints ?? 0),
    lastAnsweredAt: Math.max(stats?.lastClearAt ?? 0, stats?.lastErrorAt ?? 0, stats?.lastHintAt ?? 0),
  }
}

export function effectiveWordStrength(progress: WordPracticeStats, now: number): number {
  const days = progress.lastAnsweredAt ? Math.max(0, now - progress.lastAnsweredAt) / DAY : 0
  return progress.strength * 2 ** (-days / 30)
}

/** One settled round = one update. Looking at or navigating a card is not recall. */
export function updateWordPractice(
  stats: StatsRecord | undefined,
  outcome: StatsOutcome,
  now: number,
): WordPracticeStats {
  const prev = wordPracticeStats(stats)
  if (outcome === 'seen') return prev
  const strength = effectiveWordStrength(prev, now)
  const correct = outcome === 'correct'
  return {
    ...prev,
    strength: correct
      ? strength + 0.3 * (1 - strength)
      : Math.max(0, strength - (0.18 + 0.38 * strength)),
    attempts: prev.attempts + 1,
    streak: correct ? prev.streak + 1 : 0,
    lapses: prev.lapses + (correct ? 0 : 1),
    lastAnsweredAt: now,
  }
}

export function createAdaptiveWindow(
  ids: string[],
  stats: Record<string, StatsRecord>,
  now = Date.now(),
  options: { windowSize?: number; seed?: number } = {},
): AdaptiveWindowState {
  const order = [...new Set(ids)].sort((a, b) =>
    effectiveWordStrength(wordPracticeStats(stats[a]), now) -
    effectiveWordStrength(wordPracticeStats(stats[b]), now),
  )
  return {
    version: 1, turn: 0, order, cursor: 0, active: [], introduced: [],
    windowSize: clamp(Math.round(options.windowSize ?? WINDOW_SIZE), 3, 20),
    rngState: (options.seed ?? now) >>> 0 || 1,
    due: {}, lastShown: {}, attempts: {}, streaks: {}, intervals: {},
    lastReviewTurn: -REVIEW_GAP, lastCardId: null,
  }
}

/** Seeded draws are persisted, so reloads preserve the next random choice. */
function random(state: AdaptiveWindowState): number {
  state.rngState = ((state.rngState ?? 1) + 0x6d2b79f5) >>> 0
  let value = state.rngState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

function pickLearner(state: AdaptiveWindowState, ids: string[]): string | undefined {
  if (!ids.length) return undefined
  const size = state.windowSize ?? WINDOW_SIZE
  const age = (id: string) => state.turn - (state.lastShown[id] ?? -size)
  // A hard age bound limits unlucky droughts; ordinary choices remain random.
  const oldest = [...ids].sort((a, b) => age(b) - age(a))[0]!
  if (age(oldest) >= size * 4) return oldest
  const weights = ids.map((id) => {
    const gap = age(id)
    const overdue = Math.max(0, state.turn - (state.due[id] ?? state.turn))
    return (0.5 + gap / size) ** 1.5 * (1 + Math.min(3, overdue / size))
      * (gap <= 2 ? 0.35 : 1)
  })
  let ticket = random(state) * weights.reduce((sum, weight) => sum + weight, 0)
  for (let index = 0; index < ids.length; index++) {
    ticket -= weights[index]!
    if (ticket <= 0) return ids[index]
  }
  return ids.at(-1)
}

/** Deadlines reserve reviews; weighted draws vary the order inside the active group. */
export function pickAdaptiveWord(
  state: AdaptiveWindowState,
  allowedIds: string[],
): { cardId: string | null; state: AdaptiveWindowState } {
  const allowed = new Set(allowedIds)
  const next: AdaptiveWindowState = {
    ...state,
    active: state.active.filter((id) => allowed.has(id)),
    introduced: [...state.introduced],
    due: { ...state.due }, lastShown: { ...state.lastShown },
  }
  const introduced = new Set(next.introduced)
  // Bounded by deck size, even if excluded entries occur at the end of the plan.
  while (next.active.length < (next.windowSize ?? WINDOW_SIZE) && next.cursor < next.order.length) {
    const id = next.order[next.cursor++]!
    if (!allowed.has(id) || introduced.has(id)) continue
    next.active.push(id)
    next.introduced.push(id)
    introduced.add(id)
    next.due[id] = next.turn
  }
  // A restored exclusion is eligible again, without resetting its history.
  for (const id of next.order.slice(0, next.cursor)) {
    if (allowed.has(id) && !introduced.has(id)) {
      next.introduced.push(id)
      introduced.add(id)
    }
  }
  const activeSet = new Set(next.active)
  const reviews = next.introduced.filter((id) => allowed.has(id) && !activeSet.has(id))
  const candidates = [...next.active, ...reviews]
  if (!candidates.length) return { cardId: null, state: next }
  const eligible = (ids: string[]) => ids.filter((id) => candidates.length === 1 || id !== next.lastCardId)
  const rank = (a: string, b: string) =>
    (next.due[a] ?? 0) - (next.due[b] ?? 0) ||
    (next.lastShown[a] ?? -1) - (next.lastShown[b] ?? -1) ||
    next.order.indexOf(a) - next.order.indexOf(b)
  const dueReviews = eligible(reviews).filter((id) => (next.due[id] ?? 0) <= next.turn).sort(rank)
  const learners = eligible(next.active)
  // At most one old word per four presentations while there are active learners.
  // Review deadlines age continuously, so even very old cards cannot starve.
  const takeReview = dueReviews.length > 0 && next.turn - next.lastReviewTurn >= REVIEW_GAP
  const cardId = (takeReview ? dueReviews[0] : pickLearner(next, learners)) ?? eligible(reviews).sort(rank)[0] ?? candidates[0]!
  if (!activeSet.has(cardId)) next.lastReviewTurn = next.turn
  next.lastShown[cardId] = next.turn
  next.lastCardId = cardId
  next.turn += 1
  return { cardId, state: next }
}

export function gradeAdaptiveWord(
  state: AdaptiveWindowState,
  cardId: string,
  outcome: StatsOutcome,
  progress: WordPracticeStats,
): AdaptiveWindowState {
  if (outcome === 'seen') return state
  const correct = outcome === 'correct'
  const active = state.active.includes(cardId)
  const attempts = (state.attempts[cardId] ?? 0) + 1
  const streak = correct ? (state.streaks[cardId] ?? 0) + 1 : 0
  const ready = correct && streak >= 3 && progress.strength >= READY_STRENGTH
  // A stubborn word takes a breather after eight attempts; it is not marked learned.
  // This keeps a completely failing window from blocking the rest of the dictionary.
  const leaveWindow = active && (ready || attempts >= MAX_ACTIVE_ATTEMPTS)
  const prevInterval = state.intervals[cardId] ?? 12
  const interval = !correct
    ? REVIEW_GAP
    : active
      ? (ready ? 12 : 16)
      : Math.min(MAX_REVIEW_INTERVAL, prevInterval * 2)
  return {
    ...state,
    active: leaveWindow ? state.active.filter((id) => id !== cardId) : state.active,
    attempts: { ...state.attempts, [cardId]: attempts },
    streaks: { ...state.streaks, [cardId]: streak },
    intervals: { ...state.intervals, [cardId]: interval },
    due: { ...state.due, [cardId]: state.turn + (active && !leaveWindow ? (correct ? 5 : 3) : interval) },
  }
}

export function dropAdaptiveWord(state: AdaptiveWindowState, cardId: string): AdaptiveWindowState {
  const order = state.order.filter((id) => id !== cardId)
  const removedBeforeCursor = state.order.slice(0, state.cursor).includes(cardId)
  return {
    ...state, order, cursor: state.cursor - (removedBeforeCursor ? 1 : 0),
    active: state.active.filter((id) => id !== cardId),
    introduced: state.introduced.filter((id) => id !== cardId),
  }
}
