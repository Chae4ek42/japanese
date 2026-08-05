import type {
  InputMode,
  NumberCard,
  NumberMode,
  NumbersPickMode,
  NumbersPreferences,
  PracticeSession,
  PracticeView,
  StatsRecord,
} from '../../shared/lib/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import {
  NUMBER_HYPERPARAMS,
  NUMBER_MODES,
  NUMBER_RANGES,
  buildNumberPool,
  ensureNumberStats,
} from '../../data/numbers'
import { bumpSessionShow, pickNextCardId, pushRecentCard, setCardCooldown, successCooldownTurns } from '../../shared/lib/trainer'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import { useNumbersState } from '../../shared/state/AppStateContext'
import { PracticeShell } from '../../shared/ui/PracticeShell'
import { ShortcutNote } from '../../shared/ui/ShortcutNote'
import { NumbersCheatSheet } from './NumbersCheatSheet'

export function NumbersTrainer() {
  const numbers = useNumbersState()
  if (!numbers) return null
  return (
    <NumbersTrainerView
      numbersState={{ preferences: numbers.preferences, stats: numbers.stats }}
      onPatchPreferences={numbers.patchPreferences}
      onUpdateStats={numbers.updateStats}
    />
  )
}

interface NumbersTrainerViewProps {
  numbersState: { preferences: NumbersPreferences; stats: Record<string, StatsRecord> }
  onPatchPreferences: (patch: Partial<NumbersPreferences>) => void
  onUpdateStats: (
    cardId: string,
    outcome: 'correct' | 'wrong' | 'hint' | 'seen',
    context: { now: number; latencyMs?: number; mistakesOnCard?: number; hintUsed?: boolean; inputMode?: InputMode },
  ) => void
}

function NumbersTrainerView({
  numbersState,
  onPatchPreferences,
  onUpdateStats,
}: NumbersTrainerViewProps) {
  const pickModeOptions = [
    { id: 'adaptive', label: 'Адаптивный' },
    { id: 'even', label: 'Равномерный' },
  ]

  const { preferences, stats } = numbersState
  const {
    view,
    session,
    setSession,
    sessionRef,
    roundRef,
    resetRound,
    sessionStats,
    feedback,
    setFeedback,
    pendingAdvanceRef,
    queueAdvance,
    clearPendingAdvance,
    beginPractice,
    endPractice,
    recordAnswered,
    sessionAccuracy,
  } = usePracticeSession()

  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const navHistoryRef = useRef<string[]>([])
  const navIndexRef = useRef(-1)
  const skipToAdjacentRef = useRef<(direction: 'prev' | 'next') => void>(() => {})
  const practiceRef = useRef<{
    view: PracticeView
    activeCard: NumberCard | null
    pendingAdvance: ReturnType<typeof setTimeout> | null
    handleSpace: () => void
  }>({
    view: 'setup',
    activeCard: null,
    pendingAdvance: null,
    handleSpace: () => {},
  })

  const activeRange = useMemo(
    () => NUMBER_RANGES.find((range) => range.id === preferences.rangeId) ?? NUMBER_RANGES[1],
    [preferences.rangeId],
  )

  const activePool = useMemo(
    () =>
      buildNumberPool({
        mode: preferences.mode,
        rangeMin: activeRange.min,
        rangeMax: activeRange.max,
      }),
    [activeRange.max, activeRange.min, preferences.mode],
  )

  const activeCard = useMemo(() => {
    if (!currentCardId) {
      return null
    }
    return activePool.find((card) => card.id === currentCardId) ?? null
  }, [activePool, currentCardId])

  const statsWithDefaults = useMemo(() => {
    const map = { ...stats }
    for (const card of activePool) {
      map[card.id] = ensureNumberStats(map, card.id)
    }
    return map
  }, [activePool, stats])

  const modeLabel = NUMBER_MODES.find((mode) => mode.id === preferences.mode)?.label ?? 'Числа'

  function rememberNavCard(cardId: string) {
    const trimmed = navHistoryRef.current.slice(0, navIndexRef.current + 1)
    trimmed.push(cardId)
    navHistoryRef.current = trimmed
    navIndexRef.current = trimmed.length - 1
  }

  function showCard(
    cardId: string,
    baseSession?: PracticeSession,
    { countPresentation = true }: { countPresentation?: boolean } = {},
  ) {
    const now = Date.now()
    const base = baseSession ?? sessionRef.current
    const shownSession = countPresentation ? bumpSessionShow(base, cardId) : base
    sessionRef.current = shownSession
    setSession(shownSession)
    resetRound(now)
    setCurrentCardId(cardId)
    setRevealed(false)
    setFeedback({ type: 'idle', text: '' })
    if (countPresentation) {
      onUpdateStats(cardId, 'seen', { now })
    }
  }

  function advanceToNextCard(nextSessionOverride?: PracticeSession) {
    const nextSession = nextSessionOverride ?? sessionRef.current
    if (!activePool.length) {
      stopPractice()
      return
    }

    const nextId = pickNextCardId(activePool, statsWithDefaults, nextSession, preferences.pickMode, NUMBER_HYPERPARAMS)
    if (!nextId) {
      stopPractice()
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
    if (!activePool.length) {
      setFeedback({ type: 'error', text: 'В этом диапазоне нет заданий.' })
      return
    }

    navHistoryRef.current = []
    navIndexRef.current = -1
    const nextSession = beginPractice({
      poolIds: activePool.map((card) => card.id),
      mode: preferences.pickMode,
    })
    advanceToNextCard(nextSession)
  }

  function stopPractice() {
    clearPendingAdvance()
    endPractice()
    navHistoryRef.current = []
    navIndexRef.current = -1
    setCurrentCardId(null)
    setRevealed(false)
  }

  function revealAnswer() {
    if (!activeCard || view !== 'practice' || revealed) {
      return
    }

    roundRef.current = { ...roundRef.current, hintUsed: true }
    setRevealed(true)
    setFeedback({
      type: 'hint',
      text: `${activeCard.kanji} · ${activeCard.kana}`,
    })
  }

  /** Apply hint/cooldown bookkeeping for the current revealed card. Returns next session. */
  function settleRevealedCard(): PracticeSession | null {
    if (!activeCard || !revealed) {
      return null
    }

    const now = Date.now()
    const activeRound = roundRef.current
    const poolSize = activePool.length || session.poolIds.length || 1
    let nextSession = {
      ...pushRecentCard(session, activeCard.id),
      mistakeQueue: session.mistakeQueue.filter((id) => id !== activeCard.id),
    }

    if (activeRound.hintUsed) {
      nextSession.mistakeQueue = [activeCard.id, ...nextSession.mistakeQueue].slice(0, NUMBER_HYPERPARAMS.queueSize)
    } else {
      nextSession = setCardCooldown(nextSession, activeCard.id, successCooldownTurns(poolSize, true))
    }

    recordAnswered(0)
    sessionRef.current = nextSession
    setSession(nextSession)
    setFeedback({ type: 'success', text: '' })
    onUpdateStats(activeCard.id, 'hint', {
      now,
      latencyMs: now - activeRound.shownAt,
      mistakesOnCard: 0,
      hintUsed: true,
      inputMode: 'submit',
    })
    return nextSession
  }

  function finalizeAndAdvance() {
    const nextSession = settleRevealedCard()
    if (!nextSession) {
      return
    }
    queueAdvance(() => advanceToNextCard(nextSession), 700)
  }

  function skipToAdjacent(direction: 'prev' | 'next') {
    if (view !== 'practice') {
      return
    }
    clearPendingAdvance()

    if (direction === 'prev') {
      if (navIndexRef.current <= 0) return
      navIndexRef.current -= 1
      const prevId = navHistoryRef.current[navIndexRef.current]
      if (!prevId) return
      showCard(prevId, sessionRef.current, { countPresentation: false })
      return
    }

    if (navIndexRef.current >= 0 && navIndexRef.current < navHistoryRef.current.length - 1) {
      navIndexRef.current += 1
      const nextId = navHistoryRef.current[navIndexRef.current]
      if (!nextId) return
      showCard(nextId, sessionRef.current, { countPresentation: false })
      return
    }

    if (currentCardId && revealed) {
      const nextSession = settleRevealedCard()
      advanceToNextCard(nextSession ?? sessionRef.current)
      return
    }

    const currentId = currentCardId
    const baseSession = currentId
      ? pushRecentCard(sessionRef.current, currentId)
      : sessionRef.current
    sessionRef.current = baseSession
    setSession(baseSession)
    advanceToNextCard(baseSession)
  }

  skipToAdjacentRef.current = skipToAdjacent

  function handleSpace() {
    if (!activeCard || view !== 'practice' || pendingAdvanceRef.current) {
      return
    }

    if (!revealed) {
      revealAnswer()
      return
    }

    finalizeAndAdvance()
  }

  function handlePracticeKeyDown(event: KeyboardEvent) {
    const ctx = practiceRef.current
    if (ctx.view !== 'practice' || !ctx.activeCard) {
      return
    }

    if (event.code === 'ArrowLeft' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      skipToAdjacentRef.current('prev')
      return
    }
    if (event.code === 'ArrowRight' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      skipToAdjacentRef.current('next')
      return
    }

    if (ctx.pendingAdvance) {
      return
    }

    if (event.code === 'Space') {
      event.preventDefault()
      ctx.handleSpace()
    }
  }

  practiceRef.current = {
    view,
    activeCard,
    pendingAdvance: pendingAdvanceRef.current,
    handleSpace,
  }

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => handlePracticeKeyDown(event)
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [])

  if (view === 'setup') {
    return (
      <div className="numbers-setup-shell">
        <section className="setup-surface controls-panel numbers-controls-panel">
          <div className="control-group">
            <span className="group-label">Режим</span>
            <div className="segmented">
              {NUMBER_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  data-testid={`numbers-mode-${mode.id}`}
                  className={preferences.mode === mode.id ? 'segmented-button is-active' : 'segmented-button'}
                  onClick={() => onPatchPreferences({ mode: mode.id as NumberMode })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <span className="group-label">Диапазон</span>
            <div className="segmented">
              {NUMBER_RANGES.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  data-testid={`numbers-range-${range.id}`}
                  className={preferences.rangeId === range.id ? 'segmented-button is-active' : 'segmented-button'}
                  onClick={() => onPatchPreferences({ rangeId: range.id })}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <p className="control-hint" data-testid="numbers-pool-count">
              {activePool.length} чисел в наборе
            </p>
          </div>

          <div className="control-group">
            <span className="group-label">Подбор</span>
            <div className="segmented">
              {pickModeOptions.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  data-testid={`numbers-pick-${mode.id}`}
                  className={preferences.pickMode === mode.id ? 'segmented-button is-active' : 'segmented-button'}
                  onClick={() => onPatchPreferences({ pickMode: mode.id as NumbersPickMode })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="primary-actions">
            <button type="button" className="primary-button" onClick={startPractice}>
              <span data-testid="start-numbers">Начать</span>
            </button>
          </div>

          {feedback.type === 'error' ? <p className="feedback is-error">{feedback.text}</p> : null}
        </section>

        <NumbersCheatSheet />
      </div>
    )
  }

  return (
    <PracticeShell
      className="numbers-practice-panel"
      stageClassName="numbers-practice-layout"
      onStop={stopPractice}
      sessionStats={{ ...sessionStats, accuracy: sessionAccuracy }}
      feedbackType={feedback.type}
      swipes={{
        onSwipeLeft: () => skipToAdjacent('prev'),
        onSwipeRight: () => skipToAdjacent('next'),
        onSwipeDown: handleSpace,
        onSwipeUp: handleSpace,
      }}
    >
      {activeCard ? (
        <>
          <div className="question-block">
            <p className="question-script">{modeLabel}</p>
            <div className="question-symbol numbers-question" aria-live="polite">
              <span data-testid="current-number">{activeCard.symbol}</span>
            </div>
          </div>

          <div className="answer-block numbers-answer-block">
            {revealed ? (
              <div className="numbers-reveal" data-testid="number-answer">
                <p className="numbers-kanji" data-testid="number-kanji">
                  {activeCard.kanji}
                </p>
                <p className="numbers-kana" data-testid="number-kana">
                  {activeCard.kana}
                </p>
                <p className="numbers-romaji">{activeCard.romaji}</p>
              </div>
            ) : (
              <p className="numbers-prompt">Вспомните чтение и свайпните вниз или нажмите «Показать»</p>
            )}

            <div className="feedback-row">
              <p className={`feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>
                {feedback.type === 'success' ? 'Дальше…' : feedback.text || ' '}
              </p>
            </div>

            <div className="answer-actions">
              <button
                type="button"
                className="hint-button"
                data-testid="numbers-hint-button"
                onClick={() => (revealed ? finalizeAndAdvance() : revealAnswer())}
              >
                {revealed ? 'Дальше' : 'Показать'}
              </button>
              <ShortcutNote
                keyboard={
                  <>
                    <kbd>←</kbd>/<kbd>→</kbd> — назад/дальше · <kbd>Space</kbd> —{' '}
                    {revealed ? 'следующее' : 'показать'}
                  </>
                }
                swipe={
                  <>
                    Свайп ←/→ — назад/дальше · вниз/вверх — {revealed ? 'следующее' : 'показать'}
                  </>
                }
              />
            </div>
          </div>
        </>
      ) : null}
    </PracticeShell>
  )
}
