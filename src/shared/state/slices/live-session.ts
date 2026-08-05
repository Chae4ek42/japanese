import type {
  CardTrainerLiveSession,
  PracticeSession,
  PracticeView,
  ReviewSessionState,
  SessionStats,
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
  }
}
