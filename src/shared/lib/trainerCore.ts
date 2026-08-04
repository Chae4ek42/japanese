import {
  bumpSessionShow,
  createInitialSession,
  DEFAULT_HYPERPARAMS,
  pushRecentCard,
  setCardCooldown,
  successCooldownTurns,
} from './trainer'
import type { PracticeSession } from './types'

/**
 * Shared session mutations for card trainers (kana / vocab / numbers).
 * Domain pickers and UI stay in each trainer; this owns mistake-queue and cooldown.
 */
export function enqueueMistake(
  session: PracticeSession,
  cardId: string,
  queueSize = DEFAULT_HYPERPARAMS.queueSize,
): PracticeSession {
  return {
    ...session,
    mistakeQueue: [cardId, ...session.mistakeQueue.filter((id) => id !== cardId)].slice(0, queueSize),
  }
}

export function afterSuccessfulCard(
  session: PracticeSession,
  cardId: string,
  {
    kind,
    poolSize,
    clean,
    queueSize = DEFAULT_HYPERPARAMS.queueSize,
    enqueueOnHint = true,
  }: {
    kind: 'correct' | 'hint'
    poolSize: number
    clean: boolean
    queueSize?: number
    /** When false, hints do not re-queue the card (kana with retryQueue off). */
    enqueueOnHint?: boolean
  },
): PracticeSession {
  let next: PracticeSession = {
    ...pushRecentCard(session, cardId),
    mistakeQueue: session.mistakeQueue.filter((id) => id !== cardId),
  }

  if (kind === 'hint' && enqueueOnHint) {
    next = enqueueMistake(next, cardId, queueSize)
  } else if (kind === 'correct') {
    next = setCardCooldown(next, cardId, successCooldownTurns(poolSize, clean))
  }
  return next
}

export function prepareShownCard(session: PracticeSession, cardId: string): PracticeSession {
  return bumpSessionShow(session, cardId)
}

export function startFreshSession(options?: Partial<PracticeSession>): PracticeSession {
  return createInitialSession(options)
}
