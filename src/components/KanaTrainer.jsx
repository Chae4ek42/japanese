import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { KANA_STATS_CARDS, buildPool } from '../data/kana'
import {
  createInitialSession,
  createNextRoundState,
  createStatsRecord,
  evaluateInput,
  evaluateSubmission,
  pickNextCardId,
  recordConfusion,
  recordHistoryEvent,
  updateCardStats,
} from '../lib/trainer'
import { SetupPanel } from './SetupPanel'
import { PracticePanel } from './PracticePanel'

const emptySessionStats = { answered: 0, clean: 0, streak: 0 }

export function KanaTrainer({
  preferences,
  stats,
  history,
  onPatchPreferences,
  onPatchHyperparam,
  onPracticeUpdate,
}) {
  const [practiceState, setPracticeState] = useState('setup')
  const [currentCardId, setCurrentCardId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [session, setSession] = useState(() => createInitialSession())
  const [round, setRound] = useState(() => createNextRoundState())
  const [feedback, setFeedback] = useState({ type: 'idle', text: '' })
  const [showFineTuning, setShowFineTuning] = useState(false)
  const [sessionStats, setSessionStats] = useState(emptySessionStats)
  const inputRef = useRef(null)
  const pendingAdvanceRef = useRef(null)
  const roundRef = useRef(createNextRoundState())
  const practiceStateRef = useRef(practiceState)
  const activeCardRef = useRef(null)
  const sessionRef = useRef(session)
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
    sessionRef.current = session
    preferencesRef.current = preferences
    statsRef.current = stats
  }, [session, preferences, stats])

  useEffect(() => {
    if (practiceState === 'practice') {
      inputRef.current?.focus()
    }
  }, [practiceState, currentCardId])

  useEffect(() => {
    practiceStateRef.current = practiceState
    activeCardRef.current = activeCard
  }, [practiceState, activeCard])

  useEffect(() => {
    const handleWindowKeyDown = (event) => {
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

  useEffect(() => {
    return () => {
      if (pendingAdvanceRef.current) {
        clearTimeout(pendingAdvanceRef.current)
      }
    }
  }, [])

  function getCardStats(cardId) {
    return statsRef.current[cardId] ?? createStatsRecord()
  }

  function queueAdvance(callback, delay = 220) {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
    }
    pendingAdvanceRef.current = setTimeout(() => {
      pendingAdvanceRef.current = null
      callback()
    }, delay)
  }

  function revealNextCard(nextId, nextSession) {
    const now = Date.now()
    startTransition(() => {
      const nextRound = createNextRoundState(now)
      roundRef.current = nextRound
      setCurrentCardId(nextId)
      setInputValue('')
      setRound(nextRound)
      setFeedback({ type: 'idle', text: '' })
      setSession(nextSession)
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

  function advanceToNextCard(nextSessionOverride) {
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

  function startPractice() {
    if (!activePool.length) {
      setFeedback({ type: 'error', text: 'Нужно выбрать хотя бы один столбец.' })
      return
    }

    const nextSession = createInitialSession({
      poolIds: activePool.map((card) => card.id),
      mode: preferences.mode,
    })

    setPracticeState('practice')
    setSessionStats(emptySessionStats)
    advanceToNextCard(nextSession)
  }

  function stopPractice() {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
      pendingAdvanceRef.current = null
    }
    setPracticeState('setup')
    setCurrentCardId(null)
    setInputValue('')
    const nextRound = createNextRoundState()
    roundRef.current = nextRound
    setRound(nextRound)
    setFeedback({ type: 'idle', text: '' })
  }

  function finalizeOutcome(kind) {
    if (!activeCard) {
      return
    }

    const now = Date.now()
    const activeRound = roundRef.current
    const latencyMs = now - activeRound.shownAt
    const currentSession = sessionRef.current
    const nextSession = {
      ...currentSession,
      recentHistory: [...currentSession.recentHistory, activeCard.id].slice(-3),
      lastCardId: activeCard.id,
      mistakeQueue: currentSession.mistakeQueue.filter((id) => id !== activeCard.id),
    }

    if (kind === 'hint' && preferencesRef.current.retryQueueEnabled) {
      nextSession.mistakeQueue = [activeCard.id, ...nextSession.mistakeQueue].slice(
        0,
        preferencesRef.current.hyperparams.queueSize,
      )
    }

    const clean = kind === 'correct' && activeRound.mistakes === 0
    setSessionStats((prevStats) => ({
      answered: prevStats.answered + 1,
      clean: prevStats.clean + (clean ? 1 : 0),
      streak: clean ? prevStats.streak + 1 : 0,
    }))

    setSession(nextSession)
    onPracticeUpdate((prev) => ({
      stats: {
        ...prev.stats,
        [activeCard.id]: updateCardStats(
          getCardStats(activeCard.id),
          kind,
          {
            now,
            latencyMs,
            mistakesOnCard: activeRound.mistakes,
            hintUsed: activeRound.hintUsed,
            inputMode: prev.preferences.inputMode,
          },
          prev.preferences.hyperparams,
        ),
      },
      history: recordHistoryEvent(prev.history, kind, { now, latencyMs }),
    }))

    setFeedback({ type: 'success', text: '' })

    queueAdvance(() => {
      advanceToNextCard(nextSession)
    }, kind === 'correct' ? 220 : 280)
  }

  function detectConfusion(value) {
    if (!activeCard || !value || roundRef.current.confusionLogged) {
      return
    }

    const confusedWith = activePool.find(
      (card) => card.id !== activeCard.id && card.answers.includes(value),
    )
    if (!confusedWith) {
      return
    }

    roundRef.current = { ...roundRef.current, confusionLogged: true }
    onPracticeUpdate((prev) => ({
      history: recordConfusion(prev.history, activeCard.id, confusedWith.id),
    }))
  }

  function registerWrongAttempt() {
    if (!activeCard) {
      return
    }

    const now = Date.now()
    setRound((prevRound) => ({
      ...prevRound,
      mistakes: prevRound.mistakes + 1,
    }))
    roundRef.current = {
      ...roundRef.current,
      mistakes: roundRef.current.mistakes + 1,
    }
    setSession((prevSession) => {
      if (!preferencesRef.current.retryQueueEnabled) {
        return prevSession
      }

      return {
        ...prevSession,
        mistakeQueue: [activeCard.id, ...prevSession.mistakeQueue.filter((id) => id !== activeCard.id)].slice(
          0,
          preferencesRef.current.hyperparams.queueSize,
        ),
      }
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

  function handleInputChange(event) {
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
    roundRef.current = { ...roundRef.current, hintUsed: true }
    setRound((prevRound) => ({ ...prevRound, hintUsed: true }))
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: `Правильно: ${activeCard.answers.join(' / ')}. Введите верный ответ.`,
    })
  }

  function handleInputKeyDown(event) {
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

    roundRef.current = {
      ...roundRef.current,
      hintUsed: true,
    }
    setRound((prevRound) => ({
      ...prevRound,
      hintUsed: true,
    }))
    setFeedback({
      type: 'hint',
      text: `Подсказка: ${currentCard.answers.join(' / ')}`,
    })
    inputRef.current?.focus()
  }

  function toggleGroup(groupId) {
    const selected = new Set(preferences.selectedGroups)
    if (selected.has(groupId)) {
      selected.delete(groupId)
    } else {
      selected.add(groupId)
    }
    onPatchPreferences({ selectedGroups: [...selected] })
  }

  const sessionAccuracy = sessionStats.answered
    ? Math.round((sessionStats.clean / sessionStats.answered) * 100)
    : 100

  if (practiceState === 'setup') {
    return (
      <SetupPanel
        errorText={feedback.type === 'error' ? feedback.text : ''}
        onApplyGroups={(groups) => onPatchPreferences({ selectedGroups: [...groups] })}
        onPatchHyperparam={onPatchHyperparam}
        onPatchPreferences={onPatchPreferences}
        onStart={startPractice}
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
      onStop={stopPractice}
      round={round}
      sessionStats={{ ...sessionStats, accuracy: sessionAccuracy }}
      showScriptLabel={preferences.scriptMode === 'both'}
    />
  )
}
