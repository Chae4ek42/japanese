import { useEffect, useMemo, useRef, useState } from 'react'
import type { PracticeSession, StatsRecord, VocabCard, VocabPreferences } from '../../shared/lib/types'
import {
  DEFAULT_HYPERPARAMS,
  createStatsRecord,
  evaluateInput,
  evaluateSubmission,
  pickNextCardId,
} from '../../shared/lib/trainer'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import { buildChoiceOptions, buildVocabPool, normalizeRomajiAnswer } from './pool'
import { VocabPractice } from './VocabPractice'
import { VocabSetup } from './VocabSetup'

export interface VocabTrainerProps {
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
  myWords: string[]
  onPatchPreferences: (patch: Partial<VocabPreferences>) => void
  onUpdateStats: (
    cardId: string,
    outcome: 'correct' | 'wrong' | 'hint' | 'seen',
    context: {
      now: number
      latencyMs?: number
      mistakesOnCard?: number
      hintUsed?: boolean
      inputMode?: VocabPreferences['inputMode']
    },
  ) => void
}

export function VocabTrainer({
  preferences,
  stats,
  myWords,
  onPatchPreferences,
  onUpdateStats,
}: VocabTrainerProps) {
  const {
    view,
    setView,
    viewRef,
    setSession,
    sessionRef,
    round,
    roundRef,
    resetRound,
    patchRound,
    sessionStats,
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

  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [choiceOptions, setChoiceOptions] = useState<string[]>([])
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const preferencesRef = useRef(preferences)
  const statsRef = useRef(stats)
  const myWordsRef = useRef(myWords)
  const activeCardRef = useRef<VocabCard | null>(null)

  const activePool = useMemo(() => buildVocabPool(preferences, myWords), [preferences, myWords])
  const activeCard = currentCardId ? (activePool.find((card) => card.id === currentCardId) ?? null) : null

  useEffect(() => {
    preferencesRef.current = preferences
    statsRef.current = stats
    myWordsRef.current = myWords
  }, [preferences, stats, myWords])

  useEffect(() => {
    activeCardRef.current = activeCard
  }, [activeCard])

  useEffect(() => {
    if (view === 'practice' && preferences.drillMode === 'romaji') {
      inputRef.current?.focus()
    }
  }, [view, currentCardId, preferences.drillMode])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === 'Space' &&
        viewRef.current === 'practice' &&
        preferencesRef.current.drillMode === 'romaji' &&
        activeCardRef.current
      ) {
        event.preventDefault()
        revealHint()
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [])

  function showCard(cardId: string, nextSession: PracticeSession, pool: VocabCard[]) {
    const now = Date.now()
    const card = pool.find((item) => item.id === cardId) ?? null
    resetRound(now)
    setCurrentCardId(cardId)
    setInputValue('')
    setSelectedChoice(null)
    setFeedback({ type: 'idle', text: '' })
    setSession(nextSession)
    if (preferencesRef.current.drillMode === 'choice' && card) {
      setChoiceOptions(buildChoiceOptions(card, pool))
    } else {
      setChoiceOptions([])
    }
    onUpdateStats(cardId, 'seen', { now })
  }

  function statsWithDefaults(pool: VocabCard[]) {
    const map = { ...statsRef.current }
    for (const card of pool) {
      map[card.id] = map[card.id] ?? createStatsRecord()
    }
    return map
  }

  function advanceToNextCard(nextSessionOverride?: PracticeSession) {
    const pool = buildVocabPool(preferencesRef.current, myWordsRef.current)
    if (!pool.length) {
      setView('setup')
      setCurrentCardId(null)
      return
    }

    const nextSession = nextSessionOverride ?? sessionRef.current
    const nextId = pickNextCardId(
      pool,
      statsWithDefaults(pool),
      nextSession,
      preferencesRef.current.pickMode,
      DEFAULT_HYPERPARAMS,
    )
    if (!nextId) {
      setView('setup')
      setCurrentCardId(null)
      return
    }

    const pickedFromQueue = nextSession.mistakeQueue.includes(nextId)
    showCard(
      nextId,
      {
        ...nextSession,
        sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
      },
      pool,
    )
  }

  function startPractice() {
    if (!activePool.length) {
      setFeedback({
        type: 'error',
        text:
          preferences.source === 'mine'
            ? 'В «Моих словах» пока пусто. Добавьте слова из каталога.'
            : 'В этом наборе нет слов для тренировки.',
      })
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
    setInputValue('')
    setChoiceOptions([])
    setSelectedChoice(null)
  }

  function finalizeCorrect(kind: 'correct' | 'hint', delay = 280) {
    if (!activeCard) return

    const now = Date.now()
    const activeRound = roundRef.current
    const currentSession = sessionRef.current
    const nextSession: PracticeSession = {
      ...currentSession,
      recentHistory: [...currentSession.recentHistory, activeCard.id].slice(-3),
      lastCardId: activeCard.id,
      mistakeQueue: currentSession.mistakeQueue.filter((id) => id !== activeCard.id),
    }

    if (kind === 'hint') {
      nextSession.mistakeQueue = [activeCard.id, ...nextSession.mistakeQueue].slice(
        0,
        DEFAULT_HYPERPARAMS.queueSize,
      )
    }

    const clean = kind === 'correct' && activeRound.mistakes === 0 && !activeRound.hintUsed
    recordCleanAnswer(clean)
    setSession(nextSession)
    onUpdateStats(activeCard.id, kind === 'hint' ? 'hint' : 'correct', {
      now,
      latencyMs: now - activeRound.shownAt,
      mistakesOnCard: activeRound.mistakes,
      hintUsed: activeRound.hintUsed || kind === 'hint',
      inputMode: preferencesRef.current.inputMode,
    })
    setFeedback({ type: 'success', text: kind === 'hint' ? 'С подсказкой' : '' })
    queueAdvance(() => advanceToNextCard(nextSession), delay)
  }

  function registerWrongAttempt() {
    if (!activeCard) return
    const now = Date.now()
    patchRound({ mistakes: roundRef.current.mistakes + 1 })
    setSession((prev) => ({
      ...prev,
      mistakeQueue: [activeCard.id, ...prev.mistakeQueue.filter((id) => id !== activeCard.id)].slice(
        0,
        DEFAULT_HYPERPARAMS.queueSize,
      ),
    }))
    onUpdateStats(activeCard.id, 'wrong', {
      now,
      inputMode: preferencesRef.current.inputMode,
    })
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!activeCard || view !== 'practice' || preferences.drillMode !== 'romaji') return

    const value = normalizeRomajiAnswer(event.target.value)

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
      return
    }

    if (feedback.type === 'wrong') {
      setFeedback(
        round.hintUsed
          ? { type: 'hint', text: `Подсказка: ${activeCard.romaji}` }
          : { type: 'idle', text: '' },
      )
    }

    if (result === 'correct') {
      finalizeCorrect(round.hintUsed ? 'hint' : 'correct', 220)
    }
  }

  function handleSubmitAnswer() {
    if (!activeCard || view !== 'practice' || pendingAdvanceRef.current) return
    const result = evaluateSubmission(activeCard.answers, inputValue)
    if (result === 'empty') return

    if (result === 'correct') {
      finalizeCorrect(roundRef.current.hintUsed ? 'hint' : 'correct', 220)
      return
    }

    registerWrongAttempt()
    patchRound({ hintUsed: true })
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: `Правильно: ${activeCard.romaji}. Введите верный ответ.`,
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
    if (viewRef.current !== 'practice' || !activeCardRef.current) return
    if (preferencesRef.current.drillMode !== 'romaji') return
    patchRound({ hintUsed: true })
    setFeedback({
      type: 'hint',
      text: `Подсказка: ${activeCardRef.current.romaji}`,
    })
    inputRef.current?.focus()
  }

  function handleChoose(meaning: string) {
    if (!activeCard || selectedChoice || pendingAdvanceRef.current) return
    setSelectedChoice(meaning)

    if (meaning === activeCard.meaning) {
      setFeedback({ type: 'success', text: '' })
      finalizeCorrect(roundRef.current.hintUsed ? 'hint' : 'correct', 700)
      return
    }

    registerWrongAttempt()
    patchRound({ hintUsed: true })
    setFeedback({
      type: 'wrong',
      text: `Верно: ${activeCard.meaning}`,
    })
    const currentSession = sessionRef.current
    const nextSession: PracticeSession = {
      ...currentSession,
      recentHistory: [...currentSession.recentHistory, activeCard.id].slice(-3),
      lastCardId: activeCard.id,
      mistakeQueue: [activeCard.id, ...currentSession.mistakeQueue.filter((id) => id !== activeCard.id)].slice(
        0,
        DEFAULT_HYPERPARAMS.queueSize,
      ),
    }
    setSession(nextSession)
    recordCleanAnswer(false)
    queueAdvance(() => advanceToNextCard(nextSession), 1100)
  }

  if (view === 'setup') {
    return (
      <VocabSetup
        preferences={preferences}
        poolCount={activePool.length}
        myWordsCount={myWords.length}
        errorText={feedback.type === 'error' ? feedback.text : ''}
        onPatchPreferences={onPatchPreferences}
        onStart={startPractice}
      />
    )
  }

  return (
    <VocabPractice
      activeCard={activeCard}
      drillMode={preferences.drillMode}
      inputMode={preferences.inputMode}
      inputRef={inputRef}
      inputValue={inputValue}
      choiceOptions={choiceOptions}
      selectedChoice={selectedChoice}
      feedback={feedback}
      round={round}
      sessionStats={{ ...sessionStats, accuracy: sessionAccuracy }}
      onInputChange={handleInputChange}
      onInputKeyDown={handleInputKeyDown}
      onRevealHint={revealHint}
      onChoose={handleChoose}
      onStop={stopPractice}
    />
  )
}
