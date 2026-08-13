import { useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  CardTrainerLiveSession,
  FeedbackState,
  PracticeSession,
  PracticeView,
  SessionStats,
} from './types'

export function isRestorableLiveSession(
  liveSession: CardTrainerLiveSession | null | undefined,
): liveSession is CardTrainerLiveSession {
  return Boolean(
    liveSession &&
      liveSession.view === 'practice' &&
      liveSession.currentCardId &&
      liveSession.session.poolIds.includes(liveSession.currentCardId),
  )
}

/**
 * Restore an in-progress drill on mount and persist it while practising.
 * Used by kana / numbers / particles (vocab has extra fields and stays local).
 */
export function useLiveTrainerSession({
  liveSession,
  view,
  currentCardId,
  session,
  sessionStats,
  setView,
  setSession,
  sessionRef,
  setSessionStats,
  resetRound,
  setFeedback,
  setCurrentCardId,
  onSaveLiveSession,
  extra,
  onRestore,
}: {
  liveSession?: CardTrainerLiveSession | null
  view: PracticeView
  currentCardId: string | null
  session: PracticeSession
  sessionStats: SessionStats
  setView: (view: PracticeView) => void
  setSession: Dispatch<SetStateAction<PracticeSession>>
  sessionRef: MutableRefObject<PracticeSession>
  setSessionStats: Dispatch<SetStateAction<SessionStats>>
  resetRound: (now?: number) => void
  setFeedback: Dispatch<SetStateAction<FeedbackState>>
  setCurrentCardId: (id: string | null) => void
  onSaveLiveSession?: (session: CardTrainerLiveSession | null) => void
  extra?: Partial<Pick<CardTrainerLiveSession, 'navHistory' | 'navIndex'>>
  onRestore?: (live: CardTrainerLiveSession) => void
}) {
  const didRestoreRef = useRef(false)
  const extraRef = useRef(extra)
  extraRef.current = extra
  const onRestoreRef = useRef(onRestore)
  onRestoreRef.current = onRestore

  useEffect(() => {
    if (didRestoreRef.current) return
    didRestoreRef.current = true
    if (!isRestorableLiveSession(liveSession)) return

    sessionRef.current = liveSession.session
    setSession(liveSession.session)
    setSessionStats(liveSession.sessionStats)
    setCurrentCardId(liveSession.currentCardId)
    setView('practice')
    resetRound(Date.now())
    setFeedback({ type: 'idle', text: '' })
    onRestoreRef.current?.(liveSession)
  }, [
    liveSession,
    resetRound,
    sessionRef,
    setCurrentCardId,
    setFeedback,
    setSession,
    setSessionStats,
    setView,
  ])

  useEffect(() => {
    if (!onSaveLiveSession) return
    if (view !== 'practice' || !currentCardId) return
    onSaveLiveSession({
      session,
      currentCardId,
      view,
      sessionStats,
      ...extraRef.current,
    })
  }, [view, currentCardId, session, sessionStats, onSaveLiveSession])
}
