import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  KanjiWord,
  KanjiWordJlptLevel,
  PracticeSession,
  StatsRecord,
  VocabCard,
  VocabLevelFilter,
  VocabPreferences,
} from '../../shared/lib/types'
import {
  DEFAULT_HYPERPARAMS,
  bumpSessionShow,
  createStatsRecord,
  pickNextCardId,
  pushRecentCard,
  setCardCooldown,
  successCooldownTurns,
} from '../../shared/lib/trainer'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import { getWordById, getWordsByWriting } from '../../data/words/bank'
import {
  buildVocabPool,
  buildWideVocabDistractorPool,
  evaluateRomajiReadings,
  filterTemporaryVocabPool,
  normalizeRomajiDraft,
  pickNextSourceCard,
  pickWeightedVocabCardId,
  wordToVocabCard,
} from './pool'
import { mergeWordsByWriting } from './mergeHomographs'
import { buildMeaningPrompt, buildMixedPrompt, type VocabMixedPrompt } from './mixed'
import { VocabPractice } from './VocabPractice'
import { VocabSessionSidebar } from './VocabSessionSidebar'
import { VocabSetup } from './VocabSetup'

export interface VocabTrainerProps {
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
  myWords: string[]
  customWords?: Record<string, KanjiWord>
  hiddenWordIds?: string[]
  learnedWordIds?: string[]
  trainingWordIds?: string[]
  /** Fixed card pool (e.g. kanji-scoped). Ignores preferences.source for pool building. */
  poolOverride?: VocabCard[]
  /** Treat like group: add-to-mine UX, mine exclusion via trainFullGroup. */
  temporaryPool?: boolean
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
  trainingWordIds = [],
  poolOverride,
  temporaryPool = false,
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
  const trainingWordIdsRef = useRef(trainingWordIds)
  const activeCardRef = useRef<VocabCard | null>(null)
  const currentCardIdRef = useRef<string | null>(null)
  const navHistoryRef = useRef<string[]>([])
  const navIndexRef = useRef(-1)
  const [sessionWeightMultipliers, setSessionWeightMultipliers] = useState<Record<string, number>>({})
  const [selectedWeightCardId, setSelectedWeightCardId] = useState<string | null>(null)

  const poolOpts = { hiddenWordIds, learnedWordIds, trainingWordIds }
  const usesOverride = Boolean(poolOverride)
  const isTemporarySet = temporaryPool || usesOverride
  const isSetSource =
    isTemporarySet ||
    preferences.source === 'group' ||
    preferences.source === 'kanji' ||
    preferences.source === 'list'
  const activePool = useMemo(() => {
    if (poolOverride) {
      return filterTemporaryVocabPool(poolOverride, {
        myWords,
        trainFullGroup: preferences.trainFullGroup === true,
        newWordLimit: preferences.newWordLimit ?? -1,
        applyNewWordLimit: true,
        wordJlptLevels: preferences.wordJlptLevels ?? [],
      })
    }
    return buildVocabPool(preferences, myWords, customWords, { applyNewWordLimit: true, ...poolOpts })
  }, [poolOverride, preferences, myWords, customWords, hiddenWordIds, learnedWordIds, trainingWordIds])
  const sourcePool = useMemo(() => {
    if (poolOverride) {
      return filterTemporaryVocabPool(poolOverride, {
        myWords,
        trainFullGroup: preferences.trainFullGroup === true,
        newWordLimit: preferences.newWordLimit ?? -1,
        applyNewWordLimit: false,
        wordJlptLevels: preferences.wordJlptLevels ?? [],
      })
    }
    return buildVocabPool(preferences, myWords, customWords, { applyNewWordLimit: false, ...poolOpts })
  }, [poolOverride, preferences, myWords, customWords, hiddenWordIds, learnedWordIds, trainingWordIds])
  const poolOverrideRef = useRef(poolOverride)
  const isTemporarySetRef = useRef(isTemporarySet)
  const isSetSourceRef = useRef(isSetSource)
  useEffect(() => {
    poolOverrideRef.current = poolOverride
    isTemporarySetRef.current = isTemporarySet
    isSetSourceRef.current = isSetSource
  }, [poolOverride, isTemporarySet, isSetSource])
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
    trainingWordIdsRef.current = trainingWordIds
  }, [preferences, stats, myWords, customWords, hiddenWordIds, learnedWordIds, trainingWordIds])

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

  function resolveFullPool(applyNewWordLimit: boolean) {
    const prefs = preferencesRef.current
    const override = poolOverrideRef.current
    if (override) {
      return filterTemporaryVocabPool(override, {
        myWords: myWordsRef.current,
        trainFullGroup: prefs.trainFullGroup === true,
        newWordLimit: prefs.newWordLimit ?? -1,
        applyNewWordLimit,
        wordJlptLevels: prefs.wordJlptLevels ?? [],
      })
    }
    return buildVocabPool(prefs, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
      trainingWordIds: trainingWordIdsRef.current,
    })
  }

  function getPracticePool() {
    const prefs = preferencesRef.current
    const full = resolveFullPool(false)
    if (viewRef.current === 'practice' && sessionRef.current.poolIds.length) {
      const allow = new Set(sessionRef.current.poolIds)
      const excludeMine = isSetSourceRef.current && !prefs.trainFullGroup
      const mine = new Set(myWordsRef.current)
      const frozen = full.filter((card) => {
        if (!allow.has(card.id)) return false
        const ids = card.variantIds?.length ? card.variantIds : [card.id]
        if (excludeMine && ids.some((id) => mine.has(id))) return false
        return true
      })
      if (frozen.length) return frozen
    }
    return resolveFullPool(true)
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
    const prefs = preferencesRef.current
    if (
      poolOverrideRef.current ||
      prefs.source === 'kanji' ||
      prefs.source === 'list' ||
      prefs.source === 'group'
    ) {
      const wide = buildWideVocabDistractorPool(customWordsRef.current, hiddenWordIdsRef.current)
      if (wide.length >= 6) return wide
    }
    return buildVocabPool(prefs, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit: false,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
      trainingWordIds: trainingWordIdsRef.current,
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
          isTemporarySet
            ? 'В этом наборе нет слов для тренировки.'
            : preferences.source === 'mine'
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
    setFeedback({ type: 'success', text: '' })
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

    const value = normalizeRomajiDraft(event.target.value)

    if (preferences.inputMode === 'submit') {
      setInputValue(value)
      return
    }

    const previousResult = evaluateRomajiReadings(activeCard.answers, inputValue, 'instant')
    setInputValue(value)
    const result = evaluateRomajiReadings(activeCard.answers, value, 'instant')

    if (result === 'wrong') {
      if (previousResult !== 'wrong') {
        registerWrongAttempt()
        setFeedback({ type: 'wrong', text: '' })
      }
      return
    }

    if (feedback.type === 'wrong') {
      setFeedback({ type: 'idle', text: '' })
    }

    if (result === 'correct') {
      finalizeCorrect(round.hintUsed ? 'hint' : 'correct', 220)
    }
  }

  function handleSubmitAnswer() {
    if (!activeCard || view !== 'practice' || pendingAdvanceRef.current) return
    const result = evaluateRomajiReadings(activeCard.answers, inputValue, 'submit')
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
      text:
        activeCard.answers.length > 1
          ? 'Неверно. Укажите все чтения через /.'
          : 'Неверно.',
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
    setFeedback({ type: 'hint', text: '' })
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
    if (!onAddMyWords || !isSetSource) return
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
    if (
      preferences.source !== 'group' &&
      preferences.source !== 'level' &&
      preferences.source !== 'kanji' &&
      preferences.source !== 'list' &&
      !isTemporarySetRef.current
    ) {
      return
    }
    clearPendingAdvance()
    const full = resolveFullPool(false)
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

  function reconcileSessionAfterFilterChange({ rebuild }: { rebuild: boolean }) {
    if (viewRef.current !== 'practice') return
    clearPendingAdvance()
    const full = resolveFullPool(false)
    const limited = resolveFullPool(true)
    const allowed = new Set(full.map((card) => card.id))
    let poolIds = rebuild
      ? limited.map((card) => card.id)
      : sessionRef.current.poolIds.filter((id) => allowed.has(id))
    if (!poolIds.length) {
      poolIds = limited.map((card) => card.id)
    }
    if (!poolIds.length) {
      stopPractice()
      setFeedback({
        type: 'error',
        text: 'После фильтра не осталось слов для тренировки.',
      })
      return
    }

    const nextSession: PracticeSession = {
      ...sessionRef.current,
      poolIds,
      mistakeQueue: sessionRef.current.mistakeQueue.filter((id) => allowed.has(id)),
    }
    sessionRef.current = nextSession
    setSession(nextSession)

    const currentId = currentCardIdRef.current
    const currentStillValid = Boolean(currentId && poolIds.includes(currentId) && allowed.has(currentId))
    if (currentStillValid && !rebuild) {
      setFeedback({ type: 'idle', text: '' })
      return
    }

    const nextId = currentStillValid && currentId ? currentId : poolIds[0]!
    rememberNavCard(nextId)
    const distractorPool = getDistractorPool()
    const optionsPool = distractorPool.length >= 6 ? distractorPool : full
    showCard(nextId, nextSession, optionsPool, { recordSeen: !currentStillValid || rebuild })
  }

  function handleSessionLevelChange(level: VocabLevelFilter) {
    if (preferencesRef.current.level === level) return
    preferencesRef.current = { ...preferencesRef.current, level }
    onPatchPreferences({ level })
    reconcileSessionAfterFilterChange({ rebuild: true })
  }

  function handleSessionWordJlptChange(wordJlptLevels: KanjiWordJlptLevel[]) {
    preferencesRef.current = { ...preferencesRef.current, wordJlptLevels }
    onPatchPreferences({ wordJlptLevels })
    reconcileSessionAfterFilterChange({ rebuild: false })
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
    (preferences.source === 'group' ||
      preferences.source === 'level' ||
      preferences.source === 'kanji' ||
      preferences.source === 'list' ||
      isTemporarySet) &&
    Boolean(pickNextSourceCard(sourcePool, session.poolIds))

  const showWordJlptFilter =
    preferences.source === 'group' ||
    preferences.source === 'mine' ||
    preferences.source === 'kanji' ||
    preferences.source === 'list' ||
    isTemporarySet

  const practiceSidebar =
    view === 'practice' ? (
      <VocabSessionSidebar
        pickMode={preferences.pickMode}
        source={preferences.source}
        level={preferences.level}
        wordJlptLevels={preferences.wordJlptLevels ?? []}
        cards={practicePool}
        currentCardId={currentCardId}
        selectedCardId={selectedWeightCardId}
        weightMultipliers={sessionWeightMultipliers}
        canAddSourceWord={canAddSourceWord}
        showWordJlptFilter={showWordJlptFilter}
        onPickModeChange={(mode) => onPatchPreferences({ pickMode: mode })}
        onLevelChange={handleSessionLevelChange}
        onWordJlptChange={handleSessionWordJlptChange}
        onSelectCard={setSelectedWeightCardId}
        onSetWeight={setSessionWeight}
        onResetWeights={resetSessionWeights}
        onAddSourceWord={canAddSourceWord ? handleAddSourceWord : undefined}
      />
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
        temporaryPool={isTemporarySet}
        trainingWordCount={trainingWordIds.length}
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
      showAddSessionToMyWords={isSetSource && Boolean(onAddMyWords)}
      sessionWordCount={
        sessionRef.current.poolIds.length || activePool.length
      }
      onInputChange={handleInputChange}
      onInputKeyDown={handleInputKeyDown}
      onRevealHint={revealHint}
      onChoose={handleChoose}
      onSkipPrev={() => skipToAdjacent('prev')}
      onSkipNext={() => skipToAdjacent('next')}
      onStop={stopPractice}
      onSubmitAnswer={handleSubmitAnswer}
      onAddCurrentToMyWords={onAddMyWords ? handleAddCurrentToMyWords : undefined}
      onAddSessionToMyWords={isSetSource && onAddMyWords ? handleAddSessionToMyWords : undefined}
      onToggleLearned={onToggleLearnedWords ? handleToggleLearned : undefined}
      onSaveWordEdit={onSaveWordEdit ? handleSaveWordEdit : undefined}
      onDeleteWord={onHideWords ? handleDeleteCurrentWord : undefined}
      onOpenKanjiInfo={onOpenKanjiInfo}
      aside={practiceSidebar}
    />
  )
}
