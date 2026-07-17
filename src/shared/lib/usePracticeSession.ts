import { useEffect, useRef, useState } from 'react'
import { createInitialSession, createNextRoundState } from './trainer'
import type { FeedbackState, PracticeSession, PracticeView, RoundState, SessionStats } from './types'

export const EMPTY_SESSION_STATS: SessionStats = { answered: 0, clean: 0, streak: 0 }

export function sessionAccuracy(sessionStats: SessionStats): number {
  return sessionStats.answered
    ? Math.round((sessionStats.clean / sessionStats.answered) * 100)
    : 100
}

export function usePracticeSession({ initialView = 'setup' }: { initialView?: PracticeView } = {}) {
  const [view, setView] = useState<PracticeView>(initialView)
  const [session, setSession] = useState<PracticeSession>(() => createInitialSession())
  const [round, setRound] = useState<RoundState>(() => createNextRoundState())
  const [sessionStats, setSessionStats] = useState<SessionStats>(EMPTY_SESSION_STATS)
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle', text: '' })

  const sessionRef = useRef(session)
  const roundRef = useRef(round)
  const viewRef = useRef(view)
  const pendingAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    return () => {
      if (pendingAdvanceRef.current) {
        clearTimeout(pendingAdvanceRef.current)
      }
    }
  }, [])

  function queueAdvance(callback: () => void, delay = 220) {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
    }
    pendingAdvanceRef.current = setTimeout(() => {
      pendingAdvanceRef.current = null
      callback()
    }, delay)
  }

  function clearPendingAdvance() {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
      pendingAdvanceRef.current = null
    }
  }

  function resetRound(now = Date.now()) {
    const nextRound = createNextRoundState(now)
    roundRef.current = nextRound
    setRound(nextRound)
    return nextRound
  }

  function patchRound(patch: Partial<RoundState>) {
    const nextRound = { ...roundRef.current, ...patch }
    roundRef.current = nextRound
    setRound(nextRound)
    return nextRound
  }

  function beginPractice(sessionOptions?: Partial<PracticeSession>) {
    const nextSession = createInitialSession(sessionOptions)
    setView('practice')
    setSessionStats(EMPTY_SESSION_STATS)
    setFeedback({ type: 'idle', text: '' })
    setSession(nextSession)
    sessionRef.current = nextSession
    return nextSession
  }

  function endPractice() {
    clearPendingAdvance()
    setView('setup')
    setFeedback({ type: 'idle', text: '' })
    resetRound()
  }

  function recordCleanAnswer(clean: boolean) {
    setSessionStats((prev) => ({
      answered: prev.answered + 1,
      clean: prev.clean + (clean ? 1 : 0),
      streak: clean ? prev.streak + 1 : 0,
    }))
  }

  function recordAnswered(cleanDelta = 0) {
    setSessionStats((prev) => ({
      answered: prev.answered + 1,
      clean: prev.clean + cleanDelta,
      streak: cleanDelta > 0 ? prev.streak + 1 : 0,
    }))
  }

  return {
    view,
    setView,
    viewRef,
    session,
    setSession,
    sessionRef,
    round,
    setRound,
    roundRef,
    resetRound,
    patchRound,
    sessionStats,
    setSessionStats,
    feedback,
    setFeedback,
    pendingAdvanceRef,
    queueAdvance,
    clearPendingAdvance,
    beginPractice,
    endPractice,
    recordCleanAnswer,
    recordAnswered,
    sessionAccuracy: sessionAccuracy(sessionStats),
  }
}
