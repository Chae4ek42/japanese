import { useRef, useState } from 'react'
import { pickNextCardId, pushRecentCard } from './trainer'
import { afterSuccessfulCard, enqueueMistake, prepareShownCard } from './trainerCore'
import { useLiveTrainerSession } from './useLiveTrainerSession'
import { usePracticeSession } from './usePracticeSession'
import type { ChoiceFlash } from './choiceDrill'
import type {
  CardTrainerLiveSession,
  Hyperparams,
  PracticeSession,
  StatsOutcome,
  StatsRecord,
  UpdateStatsContext,
} from './types'

/**
 * Shared multiple-choice drill session: live restore, nav history, mistake queue.
 * Domain prompts (cloze vs conjugation) stay in each trainer.
 */
export function useChoiceDrill<TCard extends { id: string }>({
  pool,
  statsMap,
  pickMode,
  hyperparams,
  liveSession,
  onSaveLiveSession,
  onClearLiveSession,
  onUpdateStats,
  recordAnswer,
  emptyPoolMessage = 'В этом наборе нет карточек.',
  onShowCard,
}: {
  pool: TCard[]
  statsMap: Record<string, StatsRecord>
  pickMode: 'adaptive' | 'even'
  hyperparams: Hyperparams
  liveSession?: CardTrainerLiveSession | null
  onSaveLiveSession?: (session: CardTrainerLiveSession | null) => void
  onClearLiveSession?: () => void
  onUpdateStats: (cardId: string, outcome: StatsOutcome, context: UpdateStatsContext) => void
  recordAnswer: (clean: boolean) => void
  emptyPoolMessage?: string
  onShowCard?: (cardId: string) => void
}) {
  const {
    view,
    session,
    setSession,
    sessionRef,
    roundRef,
    sessionStats,
    setSessionStats,
    feedback,
    setFeedback,
    pendingAdvanceRef,
    queueAdvance,
    clearPendingAdvance,
    beginPractice,
    endPractice,
    recordAnswered,
    patchRound,
    resetRound,
    setView,
    sessionAccuracy,
  } = usePracticeSession()

  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [choiceFlash, setChoiceFlash] = useState<ChoiceFlash | null>(null)
  const [canGoPrev, setCanGoPrev] = useState(false)

  const navHistoryRef = useRef<string[]>([])
  const navIndexRef = useRef(-1)
  const skipToAdjacentRef = useRef<(direction: 'prev' | 'next') => void>(() => {})
  const poolRef = useRef(pool)
  const statsMapRef = useRef(statsMap)
  const pickModeRef = useRef(pickMode)
  const hyperparamsRef = useRef(hyperparams)
  const emptyPoolMessageRef = useRef(emptyPoolMessage)
  const onShowCardRef = useRef(onShowCard)
  const currentCardIdRef = useRef(currentCardId)

  poolRef.current = pool
  statsMapRef.current = statsMap
  pickModeRef.current = pickMode
  hyperparamsRef.current = hyperparams
  emptyPoolMessageRef.current = emptyPoolMessage
  onShowCardRef.current = onShowCard
  currentCardIdRef.current = currentCardId

  useLiveTrainerSession({
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
    extra: {
      navHistory: navHistoryRef.current,
      navIndex: navIndexRef.current,
    },
    onRestore: (live) => {
      setLocked(false)
      setChoiceFlash(null)
      if (live.navHistory) navHistoryRef.current = live.navHistory
      if (typeof live.navIndex === 'number') {
        navIndexRef.current = live.navIndex
        setCanGoPrev(live.navIndex > 0)
      }
      if (live.currentCardId) onShowCardRef.current?.(live.currentCardId)
    },
  })

  function showCard(
    cardId: string,
    baseSession?: PracticeSession,
    { countPresentation = true }: { countPresentation?: boolean } = {},
  ) {
    const now = Date.now()
    const base = baseSession ?? sessionRef.current
    const shownSession = countPresentation ? prepareShownCard(base, cardId) : base
    sessionRef.current = shownSession
    setSession(shownSession)
    resetRound(now)
    setCurrentCardId(cardId)
    setLocked(false)
    setChoiceFlash(null)
    setFeedback({ type: 'idle', text: '' })
    onShowCardRef.current?.(cardId)
    if (countPresentation) {
      onUpdateStats(cardId, 'seen', { now })
    }
  }

  function rememberNavCard(cardId: string) {
    const trimmed = navHistoryRef.current.slice(0, navIndexRef.current + 1)
    trimmed.push(cardId)
    navHistoryRef.current = trimmed
    navIndexRef.current = trimmed.length - 1
    setCanGoPrev(navIndexRef.current > 0)
  }

  function advanceToNextCard(nextSessionOverride?: PracticeSession) {
    const nextSession = nextSessionOverride ?? sessionRef.current
    const nextPool = poolRef.current
    if (!nextPool.length) {
      stopPractice()
      return
    }

    const nextId = pickNextCardId(
      nextPool,
      statsMapRef.current,
      nextSession,
      pickModeRef.current,
      hyperparamsRef.current,
    )
    if (!nextId) {
      setFeedback({ type: 'error', text: 'Нет карточек для тренировки.' })
      return
    }

    const pickedFromQueue = nextSession.mistakeQueue.includes(nextId)
    rememberNavCard(nextId)
    showCard(nextId, {
      ...nextSession,
      sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
    })
  }

  function startPractice() {
    const nextPool = poolRef.current
    if (!nextPool.length) {
      setFeedback({ type: 'error', text: emptyPoolMessageRef.current })
      return
    }
    clearPendingAdvance()
    navHistoryRef.current = []
    navIndexRef.current = -1
    setCanGoPrev(false)
    const nextSession = beginPractice({
      poolIds: nextPool.map((card) => card.id),
      mode: pickModeRef.current,
    })
    advanceToNextCard(nextSession)
  }

  function stopPractice() {
    clearPendingAdvance()
    endPractice()
    setCurrentCardId(null)
    setLocked(false)
    setChoiceFlash(null)
    onClearLiveSession?.()
  }

  function handlePick({
    pick,
    cardId,
    correct,
    successText,
    errorText,
    onCorrect,
    onWrong,
    onWrongUnlock,
    wrongDelay = 1100,
    correctDelay = 850,
  }: {
    pick: string
    cardId: string
    correct: boolean
    successText: string
    errorText: string
    onCorrect?: () => void
    onWrong?: () => void
    onWrongUnlock?: () => void
    wrongDelay?: number
    correctDelay?: number
  }) {
    if (view !== 'practice' || locked || pendingAdvanceRef.current) return
    const now = Date.now()
    const activeRound = roundRef.current
    setLocked(true)
    setChoiceFlash({ pick, correct })

    if (!correct) {
      const withMistake = enqueueMistake(sessionRef.current, cardId, hyperparamsRef.current.queueSize)
      sessionRef.current = withMistake
      setSession(withMistake)
      roundRef.current = {
        ...activeRound,
        mistakes: activeRound.mistakes + 1,
      }
      onWrong?.()
      setFeedback({ type: 'error', text: errorText })
      onUpdateStats(cardId, 'wrong', {
        now,
        latencyMs: now - activeRound.shownAt,
        mistakesOnCard: activeRound.mistakes + 1,
        inputMode: 'instant',
      })
      recordAnswer(false)
      queueAdvance(() => {
        setLocked(false)
        setChoiceFlash(null)
        setFeedback({ type: 'idle', text: '' })
        onWrongUnlock?.()
      }, wrongDelay)
      return
    }

    const poolSize = poolRef.current.length || 1
    const clean = activeRound.mistakes === 0 && !activeRound.hintUsed
    const nextSession = afterSuccessfulCard(sessionRef.current, cardId, {
      kind: 'correct',
      poolSize,
      clean,
      queueSize: hyperparamsRef.current.queueSize,
    })
    sessionRef.current = nextSession
    setSession(nextSession)
    onCorrect?.()
    recordAnswered(clean ? 1 : 0)
    recordAnswer(clean)
    onUpdateStats(cardId, 'correct', {
      now,
      latencyMs: now - activeRound.shownAt,
      mistakesOnCard: activeRound.mistakes,
      hintUsed: activeRound.hintUsed,
      inputMode: 'instant',
    })
    setFeedback({ type: 'success', text: successText })
    queueAdvance(() => advanceToNextCard(nextSession), correctDelay)
  }

  function skipToAdjacent(direction: 'prev' | 'next') {
    if (view !== 'practice') return
    clearPendingAdvance()
    setLocked(false)
    setChoiceFlash(null)

    if (direction === 'prev') {
      if (navIndexRef.current <= 0) return
      navIndexRef.current -= 1
      setCanGoPrev(navIndexRef.current > 0)
      const prevId = navHistoryRef.current[navIndexRef.current]
      if (!prevId) return
      showCard(prevId, sessionRef.current, { countPresentation: false })
      return
    }

    if (navIndexRef.current >= 0 && navIndexRef.current < navHistoryRef.current.length - 1) {
      navIndexRef.current += 1
      setCanGoPrev(navIndexRef.current > 0)
      const nextId = navHistoryRef.current[navIndexRef.current]
      if (!nextId) return
      showCard(nextId, sessionRef.current, { countPresentation: false })
      return
    }

    const currentId = currentCardIdRef.current
    const baseSession = currentId
      ? pushRecentCard(sessionRef.current, currentId)
      : sessionRef.current
    sessionRef.current = baseSession
    setSession(baseSession)
    advanceToNextCard(baseSession)
  }

  skipToAdjacentRef.current = skipToAdjacent

  return {
    view,
    sessionStats,
    feedback,
    setFeedback,
    sessionAccuracy,
    currentCardId,
    locked,
    choiceFlash,
    canGoPrev,
    pendingAdvanceRef,
    patchRound,
    startPractice,
    stopPractice,
    skipToAdjacent,
    handlePick,
    skipToAdjacentRef,
  }
}
