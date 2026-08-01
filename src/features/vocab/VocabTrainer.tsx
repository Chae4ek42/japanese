import { useEffect, useMemo, useRef, useState } from 'react'
import type { KanjiWord, PracticeSession, StatsRecord, VocabCard, VocabPreferences } from '../../shared/lib/types'
import {
  DEFAULT_HYPERPARAMS,
  bumpSessionShow,
  createStatsRecord,
  evaluateInput,
  evaluateSubmission,
  pickNextCardId,
  pushRecentCard,
  setCardCooldown,
  successCooldownTurns,
} from '../../shared/lib/trainer'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import { getWordById, getWordsByWriting } from '../../data/words/bank'
import {
  buildVocabPool,
  normalizeRomajiAnswer,
  pickNextSourceCard,
  pickWeightedVocabCardId,
  wordToVocabCard,
} from './pool'
import { mergeWordsByWriting } from './mergeHomographs'
import { buildMeaningPrompt, buildMixedPrompt, type VocabMixedPrompt } from './mixed'
import { VocabPractice } from './VocabPractice'
import { VocabSetup } from './VocabSetup'

export interface VocabTrainerProps {
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
  myWords: string[]
  customWords?: Record<string, KanjiWord>
  hiddenWordIds?: string[]
  learnedWordIds?: string[]
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
  onAddMyWords?: (wordIds: string[]) => void
  onSaveWordEdit?: (word: KanjiWord) => void
  onHideWords?: (wordIds: string[]) => void
  onToggleLearnedWords?: (wordIds: string[]) => void
  onOpenKanjiInfo?: (character: string) => void
}

export function VocabTrainer({
  preferences,
  stats,
  myWords,
  customWords = {},
  hiddenWordIds = [],
  learnedWordIds = [],
  onPatchPreferences,
  onUpdateStats,
  onAddMyWords,
  onSaveWordEdit,
  onHideWords,
  onToggleLearnedWords,
  onOpenKanjiInfo,
}: VocabTrainerProps) {
  const {
    view,
    setView,
    viewRef,
    session,
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
  const [currentPrompt, setCurrentPrompt] = useState<VocabMixedPrompt | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [canGoPrev, setCanGoPrev] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const preferencesRef = useRef(preferences)
  const statsRef = useRef(stats)
  const myWordsRef = useRef(myWords)
  const customWordsRef = useRef(customWords)
  const hiddenWordIdsRef = useRef(hiddenWordIds)
  const learnedWordIdsRef = useRef(learnedWordIds)
  const activeCardRef = useRef<VocabCard | null>(null)
  const currentCardIdRef = useRef<string | null>(null)
  const navHistoryRef = useRef<string[]>([])
  const navIndexRef = useRef(-1)
  const [sessionWeightMultipliers, setSessionWeightMultipliers] = useState<Record<string, number>>({})
  const [selectedWeightCardId, setSelectedWeightCardId] = useState<string | null>(null)

  const poolOpts = { hiddenWordIds, learnedWordIds }
  const activePool = useMemo(
    () => buildVocabPool(preferences, myWords, customWords, { applyNewWordLimit: true, ...poolOpts }),
    [preferences, myWords, customWords, hiddenWordIds, learnedWordIds],
  )
  const sourcePool = useMemo(
    () => buildVocabPool(preferences, myWords, customWords, { applyNewWordLimit: false, ...poolOpts }),
    [preferences, myWords, customWords, hiddenWordIds, learnedWordIds],
  )
  const activeCard = useMemo(() => {
    if (!currentCardId) return null
    const fromPool =
      activePool.find((card) => card.id === currentCardId) ??
      sourcePool.find((card) => card.id === currentCardId)
    if (fromPool) return fromPool
    const custom = customWords[currentCardId]
    if (custom) return wordToVocabCard(custom.id ? custom : { ...custom, id: currentCardId })
    const word = getWordById(currentCardId)
    if (!word) return null
    const merged = mergeWordsByWriting(getWordsByWriting(word.writing))
    return wordToVocabCard(merged[0] ?? word)
  }, [currentCardId, activePool, sourcePool, customWords])

  const practicePool = useMemo(() => {
    if (view !== 'practice' || !session.poolIds.length) {
      return activePool
    }
    const allow = new Set(session.poolIds)
    const practice = sourcePool.filter((card) => allow.has(card.id))
    return practice.length ? practice : activePool
  }, [activePool, sourcePool, session.poolIds, view])

  useEffect(() => {
    preferencesRef.current = preferences
    statsRef.current = stats
    myWordsRef.current = myWords
    customWordsRef.current = customWords
    hiddenWordIdsRef.current = hiddenWordIds
    learnedWordIdsRef.current = learnedWordIds
  }, [preferences, stats, myWords, customWords, hiddenWordIds, learnedWordIds])

  useEffect(() => {
    activeCardRef.current = activeCard
  }, [activeCard])

  useEffect(() => {
    currentCardIdRef.current = currentCardId
  }, [currentCardId])

  useEffect(() => {
    if (view !== 'practice' || !practicePool.length) {
      return
    }
    setSelectedWeightCardId((prev) => {
      if (prev && practicePool.some((card) => card.id === prev)) {
        return prev
      }
      return currentCardIdRef.current && practicePool.some((card) => card.id === currentCardIdRef.current)
        ? currentCardIdRef.current
        : practicePool[0]?.id ?? null
    })
  }, [practicePool, view])

  useEffect(() => {
    if (view === 'practice' && preferences.drillMode === 'romaji') {
      inputRef.current?.focus()
    }
  }, [view, currentCardId, preferences.drillMode])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (viewRef.current !== 'practice' || !activeCardRef.current) return
      const typingInField =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement

      if (event.code === 'ArrowLeft' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        skipToAdjacent('prev')
        return
      }
      if (event.code === 'ArrowRight' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        skipToAdjacent('next')
        return
      }

      if (event.code === 'Space' && preferencesRef.current.drillMode === 'romaji') {
        // Input field handles Space via onKeyDown when focused.
        if (typingInField) return
        event.preventDefault()
        revealHint()
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown, true)
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true)
  }, [])

  function showCard(
    cardId: string,
    nextSession: PracticeSession,
    optionsPool: VocabCard[],
    { recordSeen = true }: { recordSeen?: boolean } = {},
  ) {
    const now = Date.now()
    const practicePool = getPracticePool()
    const card =
      practicePool.find((item) => item.id === cardId) ??
      optionsPool.find((item) => item.id === cardId) ??
      null
    resetRound(now)
    setCurrentCardId(cardId)
    setInputValue('')
    setSelectedChoice(null)
    setFeedback({ type: 'idle', text: '' })
    const shownSession = bumpSessionShow(nextSession, cardId)
    sessionRef.current = shownSession
    setSession(shownSession)

    const mode = preferencesRef.current.drillMode
    if (card && (mode === 'choice' || mode === 'mixed')) {
      const prompt =
        mode === 'mixed'
          ? buildMixedPrompt(card, optionsPool)
          : buildMeaningPrompt(card, optionsPool)
      setCurrentPrompt(prompt)
    } else {
      setCurrentPrompt(null)
    }

    if (recordSeen) {
      onUpdateStats(cardId, 'seen', { now })
    }
  }

  function statsWithDefaults(pool: VocabCard[]) {
    const map = { ...statsRef.current }
    for (const card of pool) {
      map[card.id] = map[card.id] ?? createStatsRecord()
    }
    return map
  }

  function rememberNavCard(cardId: string) {
    const trimmed = navHistoryRef.current.slice(0, navIndexRef.current + 1)
    trimmed.push(cardId)
    navHistoryRef.current = trimmed
    navIndexRef.current = trimmed.length - 1
    setCanGoPrev(navIndexRef.current > 0)
  }

  function getPracticePool() {
    const prefs = preferencesRef.current
    const full = buildVocabPool(prefs, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit: false,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
    })
    if (viewRef.current === 'practice' && sessionRef.current.poolIds.length) {
      const allow = new Set(sessionRef.current.poolIds)
      const excludeMine = prefs.source === 'group' && !prefs.trainFullGroup
      const mine = new Set(myWordsRef.current)
      const frozen = full.filter((card) => {
        if (!allow.has(card.id)) return false
        const ids = card.variantIds?.length ? card.variantIds : [card.id]
        if (excludeMine && ids.some((id) => mine.has(id))) return false
        return true
      })
      if (frozen.length) return frozen
    }
    return buildVocabPool(prefs, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit: true,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
    })
  }

  function resetSessionWeights() {
    setSessionWeightMultipliers({})
  }

  function setSessionWeight(cardId: string, multiplier: number) {
    const clamped = Math.min(3, Math.max(0, Math.round(multiplier * 100) / 100))
    setSessionWeightMultipliers((prev) => {
      const next = { ...prev }
      if (Math.abs(clamped - 1) < 0.01) {
        delete next[cardId]
      } else {
        next[cardId] = clamped
      }
      return next
    })
  }

  function pickNextVocabCardId(pool: VocabCard[], currentCardId: string | null, session: PracticeSession) {
    if (preferencesRef.current.pickMode === 'even') {
      return pickWeightedVocabCardId(pool, {
        excludeIds: currentCardId ? [currentCardId] : [],
        weightMultipliers: sessionWeightMultipliers,
      })
    }

    return pickNextCardId(
      pool,
      statsWithDefaults(pool),
      session,
      preferencesRef.current.pickMode,
      DEFAULT_HYPERPARAMS,
      Math.random,
      { weightMultipliers: sessionWeightMultipliers },
    )
  }

  function getDistractorPool() {
    return buildVocabPool(preferencesRef.current, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit: false,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
    })
  }

  function advanceToNextCard(nextSessionOverride?: PracticeSession) {
    const pool = getPracticePool()
    if (!pool.length) {
      setView('setup')
      setCurrentCardId(null)
      return
    }

    const distractorPool = getDistractorPool()
    const optionsPool = distractorPool.length >= 6 ? distractorPool : pool

    const nextSession = nextSessionOverride ?? sessionRef.current
    const nextId = pickNextVocabCardId(pool, currentCardIdRef.current, nextSession)
    if (!nextId) {
      setView('setup')
      setCurrentCardId(null)
      return
    }

    const pickedFromQueue = nextSession.mistakeQueue.includes(nextId)
    rememberNavCard(nextId)
    showCard(
      nextId,
      {
        ...nextSession,
        sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
      },
      optionsPool,
      { recordSeen: true },
    )
  }

  function skipToAdjacent(direction: 'prev' | 'next') {
    if (viewRef.current !== 'practice' || pendingAdvanceRef.current) return
    clearPendingAdvance()

    const pool = getPracticePool()
    if (!pool.length) return

    const distractorPool = getDistractorPool()
    const optionsPool = distractorPool.length >= 6 ? distractorPool : pool

    if (direction === 'prev') {
      if (navIndexRef.current <= 0) return
      navIndexRef.current -= 1
      setCanGoPrev(navIndexRef.current > 0)
      const prevId = navHistoryRef.current[navIndexRef.current]
      showCard(prevId, sessionRef.current, optionsPool, { recordSeen: false })
      return
    }

    if (navIndexRef.current >= 0 && navIndexRef.current < navHistoryRef.current.length - 1) {
      navIndexRef.current += 1
      setCanGoPrev(navIndexRef.current > 0)
      const nextId = navHistoryRef.current[navIndexRef.current]
      showCard(nextId, sessionRef.current, optionsPool, { recordSeen: false })
      return
    }

    const currentId = currentCardIdRef.current
    const session = sessionRef.current
    const pickSession: PracticeSession = currentId ? pushRecentCard(session, currentId) : session
    const nextId = pickNextVocabCardId(pool, currentId, pickSession)
    if (!nextId || nextId === currentId) {
      if (pool.length < 2) return
      const fallback = pool.find((card) => card.id !== currentId)
      if (!fallback) return
      rememberNavCard(fallback.id)
      showCard(fallback.id, pickSession, optionsPool, { recordSeen: false })
      return
    }

    rememberNavCard(nextId)
    showCard(nextId, pickSession, optionsPool, { recordSeen: false })
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

    resetSessionWeights()
    setSelectedWeightCardId(null)
    navHistoryRef.current = []
    navIndexRef.current = -1
    setCanGoPrev(false)
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
    setCurrentPrompt(null)
    setSelectedChoice(null)
    resetSessionWeights()
    setSelectedWeightCardId(null)
    navHistoryRef.current = []
    navIndexRef.current = -1
    setCanGoPrev(false)
  }

  function finalizeCorrect(kind: 'correct' | 'hint', delay = 280) {
    if (!activeCard) return

    const now = Date.now()
    const activeRound = roundRef.current
    const currentSession = sessionRef.current
    const poolSize = getPracticePool().length || currentSession.poolIds.length || 1
    const clean = kind === 'correct' && activeRound.mistakes === 0 && !activeRound.hintUsed

    let nextSession: PracticeSession = {
      ...pushRecentCard(currentSession, activeCard.id),
      mistakeQueue: currentSession.mistakeQueue.filter((id) => id !== activeCard.id),
    }

    if (kind === 'hint') {
      nextSession.mistakeQueue = [activeCard.id, ...nextSession.mistakeQueue].slice(
        0,
        DEFAULT_HYPERPARAMS.queueSize,
      )
    } else {
      nextSession = setCardCooldown(
        nextSession,
        activeCard.id,
        successCooldownTurns(poolSize, clean),
      )
    }

    recordCleanAnswer(clean)
    sessionRef.current = nextSession
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
          ? { type: 'hint', text: 'Подсказка открыта — введите ромадзи' }
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
      text: 'Неверно. Смотрите подсказку и введите ромадзи.',
    })
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Arrows are handled once on window (avoids double-skip when the input is focused).
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
      text: 'Подсказка открыта — введите ромадзи',
    })
    inputRef.current?.focus()
  }

  function handleChoose(answer: string) {
    if (!activeCard || !currentPrompt || selectedChoice || pendingAdvanceRef.current) return
    setSelectedChoice(answer)

    if (answer === currentPrompt.correctAnswer) {
      setFeedback({ type: 'success', text: '' })
      finalizeCorrect(roundRef.current.hintUsed ? 'hint' : 'correct', 700)
      return
    }

    registerWrongAttempt()
    patchRound({ hintUsed: true })
    setFeedback({
      type: 'wrong',
      text: `Верно: ${currentPrompt.correctAnswer}`,
    })
    const currentSession = sessionRef.current
    const nextSession: PracticeSession = {
      ...pushRecentCard(currentSession, activeCard.id),
      mistakeQueue: [activeCard.id, ...currentSession.mistakeQueue.filter((id) => id !== activeCard.id)].slice(
        0,
        DEFAULT_HYPERPARAMS.queueSize,
      ),
    }
    sessionRef.current = nextSession
    setSession(nextSession)
    recordCleanAnswer(false)
    queueAdvance(() => advanceToNextCard(nextSession), 1100)
  }

  function dropCardFromSession(cardId: string): PracticeSession {
    const currentSession = sessionRef.current
    const poolIds = (
      currentSession.poolIds.length
        ? currentSession.poolIds
        : getPracticePool().map((card) => card.id)
    ).filter((id) => id !== cardId)
    const nextSession: PracticeSession = {
      ...currentSession,
      poolIds,
      mistakeQueue: currentSession.mistakeQueue.filter((id) => id !== cardId),
      recentHistory: currentSession.recentHistory.filter((id) => id !== cardId),
      lastCardId: currentSession.lastCardId === cardId ? null : currentSession.lastCardId,
    }
    setSession(nextSession)
    sessionRef.current = nextSession
    setSessionWeightMultipliers((prev) => {
      if (!(cardId in prev)) return prev
      const next = { ...prev }
      delete next[cardId]
      return next
    })
    setSelectedWeightCardId((prev) => {
      if (prev !== cardId) return prev
      return nextSession.poolIds[0] ?? null
    })

    navHistoryRef.current = navHistoryRef.current.filter((id) => id !== cardId)
    if (navIndexRef.current >= navHistoryRef.current.length) {
      navIndexRef.current = navHistoryRef.current.length - 1
    }
    setCanGoPrev(navIndexRef.current > 0)
    return nextSession
  }

  function handleAddCurrentToMyWords() {
    const card = activeCardRef.current
    if (!onAddMyWords || !card?.id) return
    const variantIds = card.variantIds?.length ? card.variantIds : [card.id]
    if (variantIds.some((id) => myWordsRef.current.includes(id))) return

    clearPendingAdvance()
    const removeId = card.id
    const writing = card.writing

    myWordsRef.current = [...new Set([...myWordsRef.current, ...variantIds])]
    onAddMyWords(variantIds)

    const nextSession = dropCardFromSession(removeId)
    if (!nextSession.poolIds.length || !getPracticePool().length) {
      stopPractice()
      setFeedback({
        type: 'success',
        text: `«${writing}» добавлено в мои слова. Других слов в наборе не осталось.`,
      })
      return
    }

    advanceToNextCard(nextSession)
    setFeedback({ type: 'success', text: `«${writing}» добавлено в мои слова` })
  }

  function handleAddSessionToMyWords() {
    if (!onAddMyWords || preferences.source !== 'group') return
    const pool =
      sessionRef.current.poolIds.length > 0
        ? getPracticePool()
        : activePool
    const ids = [
      ...new Set(pool.flatMap((card) => (card.variantIds?.length ? card.variantIds : [card.id]))),
    ]
    if (!ids.length) return
    const before = new Set(myWordsRef.current)
    const toAdd = ids.filter((id) => !before.has(id))
    myWordsRef.current = [...myWordsRef.current, ...toAdd]
    onAddMyWords(ids)

    if (!preferences.trainFullGroup) {
      clearPendingAdvance()
      stopPractice()
      setFeedback({
        type: 'success',
        text: toAdd.length
          ? `В «Мои слова» добавлено: ${toAdd.length}. Тренировка завершена.`
          : 'Все слова набора уже в «Моих словах».',
      })
      return
    }

    setFeedback({
      type: 'success',
      text: toAdd.length
        ? `В «Мои слова» добавлено из набора: ${toAdd.length}`
        : 'Все слова набора уже в «Моих словах»',
    })
  }

  function handleSaveWordEdit(word: KanjiWord) {
    if (!onSaveWordEdit || !word.id) return
    onSaveWordEdit(word)
    // Rebuild prompt for choice/mixed with updated card fields.
    const nextCard = wordToVocabCard(word)
    if (nextCard && (preferencesRef.current.drillMode === 'choice' || preferencesRef.current.drillMode === 'mixed')) {
      const distractorPool = getDistractorPool()
      const optionsPool = distractorPool.length >= 6 ? distractorPool : getPracticePool()
      const prompt =
        preferencesRef.current.drillMode === 'mixed'
          ? buildMixedPrompt(nextCard, optionsPool)
          : buildMeaningPrompt(nextCard, optionsPool)
      setCurrentPrompt(prompt)
    }
    setFeedback({ type: 'success', text: `«${word.writing}» сохранено` })
  }

  function handleDeleteCurrentWord() {
    const card = activeCardRef.current
    if (!onHideWords || !card?.id) return
    clearPendingAdvance()
    const ids = card.variantIds?.length ? card.variantIds : [card.id]
    hiddenWordIdsRef.current = [...new Set([...hiddenWordIdsRef.current, ...ids])]
    onHideWords(ids)

    const nextSession = dropCardFromSession(card.id)
    if (!nextSession.poolIds.length || !getPracticePool().length) {
      stopPractice()
      setFeedback({
        type: 'success',
        text: `«${card.writing}» удалено. Других слов в наборе не осталось.`,
      })
      return
    }
    advanceToNextCard(nextSession)
    setFeedback({ type: 'success', text: `«${card.writing}» удалено` })
  }

  function handleAddSourceWord() {
    if (preferences.source !== 'group' && preferences.source !== 'level') return
    clearPendingAdvance()
    const full = buildVocabPool(preferencesRef.current, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit: false,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
    })
    const next = pickNextSourceCard(full, sessionRef.current.poolIds)
    if (!next) {
      setFeedback({ type: 'error', text: 'В наборе больше нет слов для добавления.' })
      return
    }
    const nextSession: PracticeSession = {
      ...sessionRef.current,
      poolIds: [...sessionRef.current.poolIds, next.id],
    }
    sessionRef.current = nextSession
    setSession(nextSession)
    rememberNavCard(next.id)
    const distractorPool = getDistractorPool()
    const optionsPool = distractorPool.length >= 6 ? distractorPool : full
    showCard(next.id, nextSession, optionsPool, { recordSeen: true })
    setFeedback({ type: 'success', text: `Добавлено: ${next.writing}` })
  }

  function handleToggleLearned() {
    const card = activeCardRef.current
    if (!onToggleLearnedWords || !card?.id) return
    const ids = card.variantIds?.length ? card.variantIds : [card.id]
    const wasLearned = ids.some((id) => learnedWordIdsRef.current.includes(id))
    onToggleLearnedWords(ids)

    if (wasLearned) {
      learnedWordIdsRef.current = learnedWordIdsRef.current.filter((id) => !ids.includes(id))
      setFeedback({ type: 'success', text: `«${card.writing}» снова в изучении` })
      return
    }

    learnedWordIdsRef.current = [...new Set([...learnedWordIdsRef.current, ...ids])]
    const dropFromSession =
      preferencesRef.current.source === 'mine' && preferencesRef.current.mineIncludeLearned === false

    if (!dropFromSession) {
      setFeedback({ type: 'success', text: `«${card.writing}» помечено как выученное` })
      return
    }

    clearPendingAdvance()
    const nextSession = dropCardFromSession(card.id)
    if (!nextSession.poolIds.length || !getPracticePool().length) {
      stopPractice()
      setFeedback({
        type: 'success',
        text: `«${card.writing}» выучено. Других слов в наборе не осталось.`,
      })
      return
    }
    advanceToNextCard(nextSession)
    setFeedback({ type: 'success', text: `«${card.writing}» помечено как выученное` })
  }

  const canAddSourceWord =
    (preferences.source === 'group' || preferences.source === 'level') &&
    Boolean(pickNextSourceCard(sourcePool, sessionRef.current.poolIds ?? []))

  const pickModeOptions = [
    {
      id: 'adaptive' as const,
      label: 'Адаптивный',
      hint: 'Сильнее тянет слабые и новые слова, но текущие веса тоже учитываются.',
    },
    {
      id: 'even' as const,
      label: 'Равномерный',
      hint: 'Все слова равны, если для них не задано отдельное значение.',
    },
  ]

  const selectedWeightCard =
    practicePool.find((card) => card.id === selectedWeightCardId) ?? practicePool[0] ?? null
  const selectedWeightValue =
    selectedWeightCard && sessionWeightMultipliers[selectedWeightCard.id] !== undefined
      ? sessionWeightMultipliers[selectedWeightCard.id]
      : 1
  const selectedWeightPercent = Math.round(selectedWeightValue * 100)
  const practiceSidebar =
    view === 'practice' ? (
      <div className="panel controls-panel setup-surface vocab-session-panel" data-testid="vocab-session-sidebar">
        <div className="control-group">
          <span className="group-label">Подбор</span>
          <div className="segmented">
            {pickModeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={preferences.pickMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
                data-testid={`vocab-session-pick-${option.id}`}
                onClick={() => onPatchPreferences({ pickMode: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="control-hint">{pickModeOptions.find((item) => item.id === preferences.pickMode)?.hint}</p>
        </div>

        <div className="control-group">
          <div className="vocab-session-head">
            <span className="group-label">Вероятности слов</span>
            <button
              type="button"
              className="text-button"
              data-testid="vocab-session-reset-weights"
              onClick={resetSessionWeights}
            >
              Сбросить все
            </button>
          </div>
          <p className="control-hint">0% исключает слово из текущей тренировки. 100% - обычный вес.</p>

          {selectedWeightCard ? (
            <div className="vocab-weight-editor" data-testid="vocab-session-weight-editor">
              <div className="vocab-weight-editor-head">
                <div className="vocab-weight-editor-copy">
                  <p className="vocab-weight-writing">{selectedWeightCard.writing}</p>
                  <p className="vocab-weight-meaning">{selectedWeightCard.meaning}</p>
                </div>
                <span className="vocab-weight-badge" data-testid="vocab-session-weight-value">
                  {selectedWeightPercent}%
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="300"
                step="10"
                value={selectedWeightPercent}
                data-testid="vocab-session-weight-slider"
                onChange={(event) => {
                  if (!selectedWeightCard) return
                  setSessionWeight(selectedWeightCard.id, Number(event.target.value) / 100)
                }}
              />

              <div className="vocab-weight-editor-actions">
                <button type="button" className="ghost-button" onClick={() => setSessionWeight(selectedWeightCard.id, 0)}>
                  0%
                </button>
                <button type="button" className="ghost-button" onClick={() => setSessionWeight(selectedWeightCard.id, 1)}>
                  100%
                </button>
                <button type="button" className="ghost-button" onClick={() => setSessionWeight(selectedWeightCard.id, 2)}>
                  200%
                </button>
              </div>
            </div>
          ) : (
            <p className="control-hint">Сначала запустите тренировку.</p>
          )}

          <div className="vocab-weight-list" role="list" aria-label="Слова текущей тренировки">
            {practicePool.map((card) => {
              const weightValue = sessionWeightMultipliers[card.id] ?? 1
              const weightPercent = Math.round(weightValue * 100)
              const selected = selectedWeightCard?.id === card.id
              return (
                <button
                  key={card.id}
                  type="button"
                  role="listitem"
                  className={
                    selected
                      ? card.id === currentCardId
                        ? 'vocab-weight-item is-active is-current'
                        : 'vocab-weight-item is-active'
                      : card.id === currentCardId
                        ? 'vocab-weight-item is-current'
                        : 'vocab-weight-item'
                  }
                  data-testid={`vocab-session-word-${card.id}`}
                  onClick={() => setSelectedWeightCardId(card.id)}
                >
                  <span className="vocab-weight-item-writing">{card.writing}</span>
                  <span className="vocab-weight-item-weight">{weightPercent}%</span>
                  <span className="vocab-weight-item-meaning">{card.meaning}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    ) : null

  if (view === 'setup') {
    return (
      <VocabSetup
        preferences={preferences}
        poolCount={activePool.length}
        sourcePoolCount={sourcePool.length}
        myWordsCount={myWords.length}
        myWordIds={myWords}
        errorText={feedback.type === 'error' ? feedback.text : ''}
        infoText={feedback.type === 'success' ? feedback.text : ''}
        onPatchPreferences={onPatchPreferences}
        onStart={startPractice}
      />
    )
  }

  return (
    <VocabPractice
      activeCard={activeCard}
      drillMode={preferences.drillMode}
      prompt={currentPrompt}
      inputMode={preferences.inputMode}
      inputRef={inputRef}
      inputValue={inputValue}
      selectedChoice={selectedChoice}
      feedback={feedback}
      round={round}
      sessionStats={{ ...sessionStats, accuracy: sessionAccuracy }}
      canGoPrev={canGoPrev}
      currentInMyWords={Boolean(
        activeCard &&
          (activeCard.variantIds?.length ? activeCard.variantIds : [activeCard.id]).some((id) =>
            myWords.includes(id),
          ),
      )}
      currentLearned={Boolean(
        activeCard &&
          (activeCard.variantIds?.length ? activeCard.variantIds : [activeCard.id]).some((id) =>
            learnedWordIds.includes(id),
          ),
      )}
      showAddSessionToMyWords={preferences.source === 'group' && Boolean(onAddMyWords)}
      sessionWordCount={
        sessionRef.current.poolIds.length || activePool.length
      }
      canAddSourceWord={canAddSourceWord}
      onInputChange={handleInputChange}
      onInputKeyDown={handleInputKeyDown}
      onRevealHint={revealHint}
      onChoose={handleChoose}
      onSkipPrev={() => skipToAdjacent('prev')}
      onSkipNext={() => skipToAdjacent('next')}
      onStop={stopPractice}
      onSubmitAnswer={handleSubmitAnswer}
      onAddCurrentToMyWords={onAddMyWords ? handleAddCurrentToMyWords : undefined}
      onAddSessionToMyWords={
        preferences.source === 'group' && onAddMyWords ? handleAddSessionToMyWords : undefined
      }
      onAddSourceWord={canAddSourceWord ? handleAddSourceWord : undefined}
      onToggleLearned={onToggleLearnedWords ? handleToggleLearned : undefined}
      onSaveWordEdit={onSaveWordEdit ? handleSaveWordEdit : undefined}
      onDeleteWord={onHideWords ? handleDeleteCurrentWord : undefined}
      onOpenKanjiInfo={onOpenKanjiInfo}
      aside={practiceSidebar}
    />
  )
}
