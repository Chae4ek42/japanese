import type {
  CardTrainerLiveSession,
  Hyperparams,
  KanaCard,
  KanaPreferences,
  PracticeSession,
  StatsOutcome,
  StatsRecord,
} from '../../shared/lib/types'
import type { KanaPracticePatch, KanaPracticeSlice } from '../../shared/state/AppStateContext'
import { useAnalyticsState, useKanaState } from '../../shared/state/AppStateContext'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import { KANA_STATS_CARDS, buildPool } from '../../data/kana'
import {
  createStatsRecord,
  evaluateInput,
  evaluateSubmission,
  pickNextCardId,
  recordConfusion,
  recordHistoryEvent,
  updateCardStats,
} from '../../shared/lib/trainer'
import { afterSuccessfulCard, enqueueMistake, prepareShownCard } from '../../shared/lib/trainerCore'
import { useLiveTrainerSession } from '../../shared/lib/useLiveTrainerSession'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import { SetupPanel } from './SetupPanel'
import { PracticePanel } from './PracticePanel'

export function KanaTrainer() {
  const kana = useKanaState()
  if (!kana) return null
  return (
    <KanaTrainerView
      preferences={kana.preferences}
      stats={kana.stats}
      liveSession={kana.liveSession}
      onSaveLiveSession={kana.saveLiveSession}
      onClearLiveSession={kana.clearLiveSession}
      onPatchPreferences={kana.patchPreferences}
      onPatchHyperparam={kana.patchHyperparam}
      onPracticeUpdate={kana.updatePractice}
    />
  )
}

interface KanaTrainerViewProps {
  preferences: KanaPreferences
  stats: Record<string, StatsRecord>
  liveSession?: CardTrainerLiveSession | null
  onSaveLiveSession?: (session: CardTrainerLiveSession | null) => void
  onClearLiveSession?: () => void
  onPatchPreferences: (patch: Partial<KanaPreferences>) => void
  onPatchHyperparam: (key: keyof Hyperparams, value: number) => void
  onPracticeUpdate: (recipe: (slice: KanaPracticeSlice) => KanaPracticePatch) => void
}

function KanaTrainerView({
  preferences,
  stats,
  liveSession = null,
  onSaveLiveSession,
  onClearLiveSession,
  onPatchPreferences,
  onPatchHyperparam,
  onPracticeUpdate,
}: KanaTrainerViewProps) {
  const {
    view: practiceState,
    setView: setPracticeState,
    viewRef: practiceStateRef,
    session,
    setSession,
    sessionRef,
    round,
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
    sessionAccuracy,
  } = usePracticeSession()
  const { recordAnswer } = useAnalyticsState()

  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showFineTuning, setShowFineTuning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeCardRef = useRef<KanaCard | null>(null)
  const preferencesRef = useRef(preferences)
  const statsRef = useRef(stats)

  const activePool = useMemo(
    () => buildPool(preferences.scriptMode, preferences.selectedGroups),
    [preferences.scriptMode, preferences.selectedGroups],
  )
  const activeCard = currentCardId
    ? activePool.find((card) => card.id === currentCardId) ??
      KANA_STATS_CARDS.find((card) => card.id === currentCardId) ??
      null
    : null

  useEffect(() => {
    preferencesRef.current = preferences
    statsRef.current = stats
  }, [preferences, stats])

  useLiveTrainerSession({
    liveSession,
    view: practiceState,
    currentCardId,
    session,
    sessionStats,
    setView: setPracticeState,
    setSession,
    sessionRef,
    setSessionStats,
    resetRound,
    setFeedback,
    setCurrentCardId,
    onSaveLiveSession,
    onRestore: () => setInputValue(''),
  })

  useEffect(() => {
    if (practiceState === 'practice') {
      inputRef.current?.focus()
    }
  }, [practiceState, currentCardId])

  useEffect(() => {
    activeCardRef.current = activeCard
  }, [activeCard])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && practiceStateRef.current === 'practice' && activeCardRef.current) {
        event.preventDefault()
        revealHint()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [])

  function getCardStats(cardId: string) {
    return statsRef.current[cardId] ?? createStatsRecord()
  }

  function revealNextCard(nextId: string, nextSession: PracticeSession) {
    const now = Date.now()
    const shownSession = prepareShownCard(nextSession, nextId)
    sessionRef.current = shownSession
    startTransition(() => {
      resetRound(now)
      setCurrentCardId(nextId)
      setInputValue('')
      setFeedback({ type: 'idle', text: '' })
      setSession(shownSession)
      onPracticeUpdate((prev) => ({
        stats: {
          ...prev.stats,
          [nextId]: updateCardStats(
            getCardStats(nextId),
            'seen',
            { now },
            preferencesRef.current.hyperparams,
          ),
        },
      }))
    })
  }

  function advanceToNextCard(nextSessionOverride?: PracticeSession) {
    const currentPreferences = preferencesRef.current
    const pool = buildPool(currentPreferences.scriptMode, currentPreferences.selectedGroups)
    if (!pool.length) {
      setPracticeState('setup')
      setCurrentCardId(null)
      return
    }

    const nextSession = nextSessionOverride ?? sessionRef.current
    const nextId = pickNextCardId(
      pool,
      statsRef.current,
      nextSession,
      currentPreferences.mode,
      currentPreferences.hyperparams,
    )
    if (!nextId) {
      setPracticeState('setup')
      setCurrentCardId(null)
      return
    }

    const pickedFromQueue = nextSession.mistakeQueue.includes(nextId)
    revealNextCard(nextId, {
      ...nextSession,
      sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
    })
  }

  function stopPractice() {
    clearPendingAdvance()
    endPractice()
    setCurrentCardId(null)
    setInputValue('')
    if (onClearLiveSession) {
      onClearLiveSession()
    } else {
      onSaveLiveSession?.(null)
    }
  }

  function finalizeOutcome(kind: StatsOutcome) {
    if (!activeCard) {
      return
    }

    const now = Date.now()
    const activeRound = roundRef.current
    const currentSession = sessionRef.current
    const poolSize = activePool.length || currentSession.poolIds.length || 1
    const clean = kind === 'correct' && activeRound.mistakes === 0

    const nextSession = afterSuccessfulCard(currentSession, activeCard.id, {
      kind: kind === 'hint' ? 'hint' : 'correct',
      poolSize,
      clean,
      queueSize: preferencesRef.current.hyperparams.queueSize,
      enqueueOnHint: preferencesRef.current.retryQueueEnabled,
    })

    recordCleanAnswer(clean)
    recordAnswer(clean)

    sessionRef.current = nextSession
    setSession(nextSession)
    onPracticeUpdate((prev) => ({
      stats: {
        ...prev.stats,
        [activeCard.id]: updateCardStats(
          getCardStats(activeCard.id),
          kind,
          {
            now,
            latencyMs: now - activeRound.shownAt,
            mistakesOnCard: activeRound.mistakes,
            hintUsed: activeRound.hintUsed,
            inputMode: prev.preferences.inputMode,
          },
          prev.preferences.hyperparams,
        ),
      },
      history: recordHistoryEvent(prev.history, kind, { now, latencyMs: now - activeRound.shownAt }),
    }))

    setFeedback({ type: 'success', text: '' })

    queueAdvance(() => {
      advanceToNextCard(nextSession)
    }, kind === 'correct' ? 220 : 280)
  }

  function detectConfusion(value: string) {
    if (!activeCard || !value || roundRef.current.confusionLogged) {
      return
    }

    const confusedWith = activePool.find(
      (card) => card.id !== activeCard.id && card.answers.includes(value),
    )
    if (!confusedWith) {
      return
    }

    patchRound({ confusionLogged: true })
    onPracticeUpdate((prev) => ({
      history: recordConfusion(prev.history, activeCard.id, confusedWith.id),
    }))
  }

  function registerWrongAttempt() {
    if (!activeCard) {
      return
    }

    const now = Date.now()
    patchRound({ mistakes: roundRef.current.mistakes + 1 })
    setSession((prevSession) => {
      if (!preferencesRef.current.retryQueueEnabled) {
        return prevSession
      }
      return enqueueMistake(prevSession, activeCard.id, preferencesRef.current.hyperparams.queueSize)
    })
    onPracticeUpdate((prev) => ({
      stats: {
        ...prev.stats,
        [activeCard.id]: updateCardStats(
          getCardStats(activeCard.id),
          'wrong',
          { now, inputMode: prev.preferences.inputMode },
          prev.preferences.hyperparams,
        ),
      },
      history: recordHistoryEvent(prev.history, 'wrong', { now }),
    }))
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!activeCard || practiceState !== 'practice') {
      return
    }

    const value = event.target.value.toLowerCase().replace(/\s+/g, '')

    if (preferences.inputMode === 'submit') {
      setInputValue(value)
      return
    }

    const previousResult = evaluateInput(activeCard.answers, inputValue)
    setInputValue(value)

    const result = evaluateInput(activeCard.answers, value)
    if (result === 'wrong') {
      if (previousResult !== 'wrong') {
        registerWrongAttempt()
        setFeedback({ type: 'wrong', text: '' })
      }
      detectConfusion(value)
      return
    }

    if (feedback.type === 'wrong') {
      setFeedback(
        round.hintUsed
          ? {
              type: 'hint',
              text: `Подсказка: ${activeCard.answers.join(' / ')}`,
            }
          : { type: 'idle', text: '' },
      )
    }

    if (result === 'correct') {
      finalizeOutcome(round.hintUsed ? 'hint' : 'correct')
    }
  }

  function handleSubmitAnswer() {
    if (!activeCard || practiceState !== 'practice' || pendingAdvanceRef.current) {
      return
    }

    const result = evaluateSubmission(activeCard.answers, inputValue)
    if (result === 'empty') {
      return
    }

    if (result === 'correct') {
      finalizeOutcome(roundRef.current.hintUsed ? 'hint' : 'correct')
      return
    }

    registerWrongAttempt()
    detectConfusion(inputValue)
    patchRound({ hintUsed: true })
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: `Правильно: ${activeCard.answers.join(' / ')}. Введите верный ответ.`,
    })
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.code === 'Space') {
      event.preventDefault()
      revealHint()
      return
    }

    if (event.key === 'Enter' && preferences.inputMode === 'submit') {
      event.preventDefault()
      handleSubmitAnswer()
    }
  }

  function revealHint() {
    const currentPracticeState = practiceStateRef.current
    const currentCard = activeCardRef.current
    if (currentPracticeState !== 'practice' || !currentCard) {
      return
    }

    patchRound({ hintUsed: true })
    setFeedback({
      type: 'hint',
      text: `Подсказка: ${currentCard.answers.join(' / ')}`,
    })
    inputRef.current?.focus()
  }

  function toggleGroup(groupId: string) {
    const selected = new Set(preferences.selectedGroups)
    if (selected.has(groupId)) {
      selected.delete(groupId)
    } else {
      selected.add(groupId)
    }
    onPatchPreferences({ selectedGroups: [...selected] })
  }

  if (practiceState === 'setup') {
    return (
      <SetupPanel
        errorText={feedback.type === 'error' ? feedback.text : ''}
        onApplyGroups={(groups) => onPatchPreferences({ selectedGroups: [...groups] })}
        onPatchHyperparam={onPatchHyperparam}
        onPatchPreferences={onPatchPreferences}
        onStart={() => {
          if (!activePool.length) {
            setFeedback({ type: 'error', text: 'Нужно выбрать хотя бы один столбец.' })
            return
          }
          const nextSession = beginPractice({
            poolIds: activePool.map((card) => card.id),
            mode: preferences.mode,
          })
          advanceToNextCard(nextSession)
        }}
        onToggleFineTuning={() => setShowFineTuning((value) => !value)}
        onToggleGroup={toggleGroup}
        preferences={preferences}
        showFineTuning={showFineTuning}
      />
    )
  }

  return (
    <PracticePanel
      activeCard={activeCard}
      feedback={feedback}
      inputMode={preferences.inputMode}
      inputRef={inputRef}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onInputKeyDown={handleInputKeyDown}
      onRevealHint={revealHint}
      onSubmitAnswer={handleSubmitAnswer}
      onStop={stopPractice}
      round={round}
      sessionStats={{ ...sessionStats, accuracy: sessionAccuracy }}
      showScriptLabel={preferences.scriptMode === 'both'}
    />
  )
}
