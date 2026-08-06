import type { AnalyticsSection } from './types'

export const ACTIVE_IDLE_MS = 60_000
export const ACTIVE_TICK_MS = 1_000
export const ACTIVE_FLUSH_EVERY_MS = 10_000

export interface ActiveTimeEngineState {
  isActive: boolean
  section: AnalyticsSection
  /** Wall clock when the current active segment started (or last tick). */
  segmentStartedAt: number | null
  pendingBySection: Partial<Record<AnalyticsSection, number>>
  lastInputAt: number
  msSinceFlush: number
}

export function createActiveTimeEngine(section: AnalyticsSection, now = Date.now()): ActiveTimeEngineState {
  return {
    isActive: false,
    section,
    segmentStartedAt: null,
    pendingBySection: {},
    lastInputAt: now,
    msSinceFlush: 0,
  }
}

function addPending(
  pending: Partial<Record<AnalyticsSection, number>>,
  section: AnalyticsSection,
  ms: number,
): Partial<Record<AnalyticsSection, number>> {
  if (ms <= 0) return pending
  return { ...pending, [section]: (pending[section] ?? 0) + ms }
}

/** Close open segment into pending without changing activity flag. */
export function harvestSegment(state: ActiveTimeEngineState, now: number): ActiveTimeEngineState {
  if (!state.isActive || state.segmentStartedAt == null) return state
  const elapsed = Math.max(0, now - state.segmentStartedAt)
  if (elapsed <= 0) {
    return { ...state, segmentStartedAt: now }
  }
  return {
    ...state,
    pendingBySection: addPending(state.pendingBySection, state.section, elapsed),
    segmentStartedAt: now,
    msSinceFlush: state.msSinceFlush + elapsed,
  }
}

export function noteInput(state: ActiveTimeEngineState, now: number): ActiveTimeEngineState {
  let next = state
  if (!state.isActive) {
    next = {
      ...state,
      isActive: true,
      segmentStartedAt: now,
      lastInputAt: now,
    }
    return next
  }
  next = harvestSegment(state, now)
  return { ...next, lastInputAt: now }
}

export function setSection(state: ActiveTimeEngineState, section: AnalyticsSection, now: number): ActiveTimeEngineState {
  if (state.section === section) return state
  const harvested = harvestSegment(state, now)
  return {
    ...harvested,
    section,
    segmentStartedAt: harvested.isActive ? now : null,
  }
}

export function tickActive(state: ActiveTimeEngineState, now: number): ActiveTimeEngineState {
  if (!state.isActive) return state
  if (now - state.lastInputAt >= ACTIVE_IDLE_MS) {
    return pauseActive(state, now)
  }
  return harvestSegment(state, now)
}

export function pauseActive(state: ActiveTimeEngineState, now: number): ActiveTimeEngineState {
  const harvested = harvestSegment(state, now)
  return {
    ...harvested,
    isActive: false,
    segmentStartedAt: null,
  }
}

export function takePendingFlush(
  state: ActiveTimeEngineState,
  { force = false }: { force?: boolean } = {},
): { state: ActiveTimeEngineState; deltas: Array<{ section: AnalyticsSection; deltaMs: number }> } {
  if (!force && state.msSinceFlush < ACTIVE_FLUSH_EVERY_MS) {
    return { state, deltas: [] }
  }
  const deltas: Array<{ section: AnalyticsSection; deltaMs: number }> = []
  for (const [section, ms] of Object.entries(state.pendingBySection) as Array<
    [AnalyticsSection, number]
  >) {
    if (ms > 0) deltas.push({ section, deltaMs: ms })
  }
  if (!deltas.length) {
    return { state: { ...state, msSinceFlush: 0 }, deltas: [] }
  }
  return {
    state: {
      ...state,
      pendingBySection: {},
      msSinceFlush: 0,
    },
    deltas,
  }
}
