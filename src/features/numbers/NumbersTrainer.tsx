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
import { pickNextCardId } from '../../shared/lib/trainer'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import { useNumbersState } from '../../shared/state/AppStateContext'
import { PracticeShell } from '../../shared/ui/PracticeShell'
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
    { id: 'adaptive', label: 'Адаптивный', hint: 'Чаще слабые и ещё не встречавшиеся числа.' },
    { id: 'even', label: 'Равномерный', hint: 'Все числа из диапазона с равной частотой.' },
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

  function showCard(cardId: string) {
    const now = Date.now()
    resetRound(now)
    setCurrentCardId(cardId)
    setRevealed(false)
    setFeedback({ type: 'idle', text: '' })
    onUpdateStats(cardId, 'seen', { now })
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
    showCard(nextId)
    setSession({
      ...nextSession,
      sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
    })
  }

  function startPractice() {
    if (!activePool.length) {
      setFeedback({ type: 'error', text: 'В этом диапазоне нет заданий.' })
      return
    }

    const nextSession = beginPractice({
      poolIds: activePool.map((card) => card.id),
      mode: preferences.pickMode,
    })
    advanceToNextCard(nextSession)
  }

  function stopPractice() {
    clearPendingAdvance()
    endPractice()
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

  function finalizeAndAdvance() {
    if (!activeCard || !revealed) {
      return
    }

    const now = Date.now()
    const activeRound = roundRef.current
    const nextSession = {
      ...session,
      recentHistory: [...session.recentHistory, activeCard.id].slice(-3),
      lastCardId: activeCard.id,
      mistakeQueue: session.mistakeQueue.filter((id) => id !== activeCard.id),
    }

    if (activeRound.hintUsed) {
      nextSession.mistakeQueue = [activeCard.id, ...nextSession.mistakeQueue].slice(0, NUMBER_HYPERPARAMS.queueSize)
    }

    recordAnswered(0)
    setSession(nextSession)
    setFeedback({ type: 'success', text: '' })
    onUpdateStats(activeCard.id, 'hint', {
      now,
      latencyMs: now - activeRound.shownAt,
      mistakesOnCard: 0,
      hintUsed: true,
      inputMode: 'submit',
    })

    queueAdvance(() => advanceToNextCard(nextSession), 700)
  }

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
    if (ctx.view !== 'practice' || !ctx.activeCard || ctx.pendingAdvance) {
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
            <p className="control-hint">
              {NUMBER_MODES.find((mode) => mode.id === preferences.mode)?.hint}
            </p>
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
            <p className="control-hint">
              {pickModeOptions.find((mode) => mode.id === preferences.pickMode)?.hint}
            </p>
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
              <p className="numbers-prompt">Вспомните чтение и нажмите пробел</p>
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
              <p className="question-note">
                <kbd>Space</kbd> — {revealed ? 'следующее' : 'показать'}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </PracticeShell>
  )
}
