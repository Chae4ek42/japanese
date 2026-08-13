import type {
  CardTrainerLiveSession,
  PracticeSession,
  SessionStats,
  VocabSessionMode,
} from '../../shared/lib/types'
import { isRestorableLiveSession } from '../../shared/lib/useLiveTrainerSession'
import { defaultInFlightLimit } from './reviewSession'

export function widenLegacyVocabInFlight(
  session: PracticeSession,
  sessionMode: VocabSessionMode,
): PracticeSession {
  if (session.review && session.review.inFlightLimit == null && sessionMode !== 'srs') {
    return {
      ...session,
      review: {
        ...session.review,
        inFlightLimit: defaultInFlightLimit(session.poolIds.length, false),
      },
    }
  }
  return session
}

export function restoreVocabLiveFields(liveSession: CardTrainerLiveSession | null | undefined): {
  session: PracticeSession
  currentCardId: string
  sessionStats: SessionStats
  weightMultipliers: Record<string, number>
  poolAddedAt: Record<string, number> | undefined
  navHistory: string[]
  navIndex: number
} | null {
  if (!isRestorableLiveSession(liveSession)) return null
  return {
    session: liveSession.session,
    currentCardId: liveSession.currentCardId as string,
    sessionStats: liveSession.sessionStats,
    weightMultipliers: liveSession.weightMultipliers ?? {},
    poolAddedAt: liveSession.poolAddedAt,
    navHistory: liveSession.navHistory ?? [],
    navIndex: liveSession.navIndex ?? -1,
  }
}

export function buildVocabLiveSnapshot(input: {
  session: PracticeSession
  currentCardId: string
  view: 'practice'
  sessionStats: SessionStats
  weightMultipliers: Record<string, number>
  poolAddedAt: Record<string, number>
  navHistory: string[]
  navIndex: number
}): CardTrainerLiveSession {
  return {
    session: input.session,
    currentCardId: input.currentCardId,
    view: input.view,
    sessionStats: input.sessionStats,
    weightMultipliers: input.weightMultipliers,
    poolAddedAt: input.poolAddedAt,
    navHistory: input.navHistory,
    navIndex: input.navIndex,
  }
}
