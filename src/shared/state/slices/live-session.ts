import type {
  CardTrainerLiveSession,
  PracticeSession,
  PracticeView,
  ReviewSessionState,
  SessionStats,
  AdaptiveWindowState,
} from '../../lib/types'
import { createInitialSession } from '../../lib/trainer'

function sanitizeSessionStats(raw: unknown, fallback: SessionStats): SessionStats {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    answered:
      typeof source.answered === 'number' && Number.isFinite(source.answered)
        ? Math.max(0, Math.round(source.answered))
        : fallback.answered,
    clean:
      typeof source.clean === 'number' && Number.isFinite(source.clean)
        ? Math.max(0, Math.round(source.clean))
        : fallback.clean,
    streak:
      typeof source.streak === 'number' && Number.isFinite(source.streak)
        ? Math.max(0, Math.round(source.streak))
        : fallback.streak,
  }
}

function sanitizeReviewSession(raw: unknown): ReviewSessionState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const planIds = Array.isArray(source.planIds)
    ? source.planIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  if (!planIds.length) return undefined
  const dueTurns =
    source.dueTurns && typeof source.dueTurns === 'object'
      ? Object.fromEntries(
          Object.entries(source.dueTurns as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
          ),
        )
      : {}
  const goodStreaks =
    source.goodStreaks && typeof source.goodStreaks === 'object'
      ? Object.fromEntries(
          Object.entries(source.goodStreaks as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
          ),
        )
      : {}
  const weightMultipliers =
    source.weightMultipliers && typeof source.weightMultipliers === 'object'
      ? Object.fromEntries(
          Object.entries(source.weightMultipliers as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
          ),
        )
      : {}
  return {
    turn: typeof source.turn === 'number' && Number.isFinite(source.turn) ? Math.max(0, source.turn) : 0,
    planIds,
    planIndex:
      typeof source.planIndex === 'number' && Number.isFinite(source.planIndex)
        ? Math.max(0, Math.round(source.planIndex))
        : 0,
    dueTurns,
    inFlight: Array.isArray(source.inFlight)
      ? source.inFlight.filter((id): id is string => typeof id === 'string')
      : [],
    goodStreaks,
    graduatedIds: Array.isArray(source.graduatedIds)
      ? source.graduatedIds.filter((id): id is string => typeof id === 'string')
      : [],
    seed: typeof source.seed === 'number' && Number.isFinite(source.seed) ? source.seed >>> 0 : 1,
    mode: source.mode === 'even' ? 'even' : 'adaptive',
    weightMultipliers,
    answersInSession:
      typeof source.answersInSession === 'number' && Number.isFinite(source.answersInSession)
        ? Math.max(0, Math.round(source.answersInSession))
        : 0,
    targetAnswers:
      typeof source.targetAnswers === 'number' && Number.isFinite(source.targetAnswers)
        ? Math.max(0, Math.round(source.targetAnswers))
        : 0,
    done: Boolean(source.done),
    inFlightLimit:
      typeof source.inFlightLimit === 'number' && Number.isFinite(source.inFlightLimit)
        ? Math.max(1, Math.round(source.inFlightLimit))
        : undefined,
    passesToGraduate:
      typeof source.passesToGraduate === 'number' && Number.isFinite(source.passesToGraduate)
        ? Math.min(3, Math.max(1, Math.round(source.passesToGraduate)))
        : undefined,
  }
}

function sanitizePracticeSession(raw: unknown): PracticeSession | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const poolIds = Array.isArray(source.poolIds)
    ? source.poolIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  if (!poolIds.length) return null
  const base = createInitialSession({ poolIds })
  const review = sanitizeReviewSession(source.review)
  const adaptive = sanitizeAdaptiveWindow(source.adaptive, poolIds)
  return {
    ...base,
    recentHistory: Array.isArray(source.recentHistory)
      ? source.recentHistory.filter((id): id is string => typeof id === 'string')
      : [],
    lastCardId: typeof source.lastCardId === 'string' ? source.lastCardId : null,
    mistakeQueue: Array.isArray(source.mistakeQueue)
      ? source.mistakeQueue.filter((id): id is string => typeof id === 'string')
      : [],
    sinceQueuePick:
      typeof source.sinceQueuePick === 'number' && Number.isFinite(source.sinceQueuePick)
        ? Math.max(0, Math.round(source.sinceQueuePick))
        : 0,
    mode: source.mode === 'even' || source.mode === 'problem' || source.mode === 'adaptive' ? source.mode : base.mode,
    showCounts:
      source.showCounts && typeof source.showCounts === 'object'
        ? { ...(source.showCounts as Record<string, number>) }
        : {},
    cooldowns:
      source.cooldowns && typeof source.cooldowns === 'object'
        ? { ...(source.cooldowns as Record<string, number>) }
        : {},
    ...(review ? { review } : {}),
    ...(adaptive ? { adaptive } : {}),
    vocabMode: source.vocabMode === 'drill' || source.vocabMode === 'adaptive' || source.vocabMode === 'srs'
      ? source.vocabMode : undefined,
    targetedIds: Array.isArray(source.targetedIds)
      ? [...new Set(source.targetedIds.filter((id): id is string => typeof id === 'string' && poolIds.includes(id)))]
      : undefined,
  }
}

function sanitizeAdaptiveWindow(raw: unknown, poolIds: string[]): AdaptiveWindowState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  if (source.version !== 1) return undefined
  const allow = new Set(poolIds)
  const ids = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && allow.has(id)))] : []
  const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value)) : fallback
  const map = (value: unknown): Record<string, number> => value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([id, n]) => allow.has(id) && typeof n === 'number' && Number.isFinite(n))) : {}
  const order = ids(source.order)
  for (const id of poolIds) if (!order.includes(id)) order.push(id)
  const cursor = Math.min(order.length, number(source.cursor))
  const introduced = [...new Set([...order.slice(0, cursor), ...ids(source.introduced)])]
  return {
    version: 1, order, cursor, introduced,
    windowSize: Math.min(20, Math.max(3, number(source.windowSize, 5))),
    rngState: typeof source.rngState === 'number' && Number.isFinite(source.rngState) ? source.rngState >>> 0 : 1,
    turn: number(source.turn), active: ids(source.active).filter((id) => introduced.includes(id)).slice(0, Math.min(20, Math.max(3, number(source.windowSize, 5)))),
    due: map(source.due), lastShown: map(source.lastShown), attempts: map(source.attempts),
    streaks: map(source.streaks), intervals: map(source.intervals),
    lastReviewTurn: typeof source.lastReviewTurn === 'number' && Number.isFinite(source.lastReviewTurn) ? source.lastReviewTurn : -4,
    lastCardId: typeof source.lastCardId === 'string' && allow.has(source.lastCardId) ? source.lastCardId : null,
  }
}

export function sanitizeCardTrainerLiveSession(
  raw: unknown,
  fallback: CardTrainerLiveSession | null = null,
): CardTrainerLiveSession | null {
  if (!raw || typeof raw !== 'object') return fallback
  const source = raw as Record<string, unknown>
  const session = sanitizePracticeSession(source.session)
  if (!session) return fallback
  const view: PracticeView = source.view === 'practice' ? 'practice' : 'setup'
  if (view !== 'practice') return null
  const currentCardId = typeof source.currentCardId === 'string' ? source.currentCardId : null
  if (!currentCardId || !session.poolIds.includes(currentCardId)) return null

  const weightMultipliers =
    source.weightMultipliers && typeof source.weightMultipliers === 'object'
      ? Object.fromEntries(
          Object.entries(source.weightMultipliers as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
          ),
        )
      : undefined
  const poolAddedAt =
    source.poolAddedAt && typeof source.poolAddedAt === 'object'
      ? Object.fromEntries(
          Object.entries(source.poolAddedAt as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
          ),
        )
      : undefined
  const navHistory = Array.isArray(source.navHistory)
    ? source.navHistory.filter((id): id is string => typeof id === 'string')
    : undefined
  const navIndex =
    typeof source.navIndex === 'number' && Number.isFinite(source.navIndex)
      ? Math.max(0, Math.round(source.navIndex))
      : undefined

  return {
    session,
    currentCardId,
    view,
    sessionStats: sanitizeSessionStats(source.sessionStats, { answered: 0, clean: 0, streak: 0 }),
    weightMultipliers,
    poolAddedAt,
    navHistory,
    navIndex,
    ...(source.pendingAdvance === true ? { pendingAdvance: true } : {}),
  }
}
