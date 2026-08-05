import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CardTrainerLiveSession,
  KanjiWord,
  KanjiWordJlptLevel,
  LatencyModel,
  MemoryState,
  PracticeSession,
  ReviewDayCounters,
  ReviewGrade,
  StatsRecord,
  VocabCard,
  VocabLevelFilter,
  VocabPreferences,
} from '../../shared/lib/types'
import {
  DEFAULT_HYPERPARAMS,
  createStatsRecord,
  isProblemByRecentAnswers,
  pickNextCardId,
  projectRecentAnswers,
  pushRecentCard,
} from '../../shared/lib/trainer'
import { afterSuccessfulCard, enqueueMistake, prepareShownCard } from '../../shared/lib/trainerCore'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import { DEFAULT_LATENCY_MODEL, isForgivableTypo } from '../../shared/lib/review/grade'
import { getWordById, getWordsByWriting } from '../../data/words/bank'
import {
  applyVocabNewWordLimit,
  buildEvenModeWeightMultipliers,
  buildVocabPool,
  buildWideVocabDistractorPool,
  evaluateRomajiReadings,
  normalizeRomajiDraft,
  pickNextSourceCard,
  pickWeightedVocabCardId,
  wordToVocabCard,
} from './pool'
import { mergeWordsByWriting } from './mergeHomographs'
import { buildMeaningPrompt, buildMixedPrompt, type VocabMixedPrompt } from './mixed'
import {
  answerLengthForCard,
  cardHintsFromVocab,
  drillModeToAspect,
  deriveRoundGrade,
  gradeAndAdvanceReview,
  masteryOutcomeFromRound,
  patchReviewWeights,
  pickReviewCard,
  removeCardFromReviewSession,
  appendCardToReviewSession,
  resolveCardMemory,
  startReviewPracticeSession,
} from './reviewSession'
import type { PriorDifficultyHints } from '../../shared/lib/review/memory'
import type { StatsOutcome, UpdateStatsContext } from '../../shared/lib/types'
import { VocabPractice } from './VocabPractice'
import { VocabSessionSidebar } from './VocabSessionSidebar'
import { VocabSetup } from './VocabSetup'

export interface VocabTrainerProps {
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
  memory?: Record<string, MemoryState>
  latencyModel?: LatencyModel
  reviewDay?: ReviewDayCounters
  myWords: string[]
  customWords?: Record<string, KanjiWord>
  hiddenWordIds?: string[]
  learnedWordIds?: string[]
  trainingWordIds?: string[]
  problemWordIds?: string[]
  liveSession?: CardTrainerLiveSession | null
  onSaveLiveSession?: (session: CardTrainerLiveSession | null) => void
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
      drillMode?: VocabPreferences['drillMode']
      answerLength?: number
    },
  ) => void
  onApplyGradedReview?: (input: {
    cardId: string
    aspect: 0 | 1
    grade: ReviewGrade
    now: number
    latencyMs: number
    drillMode: VocabPreferences['drillMode']
    answerLength: number
    hints?: PriorDifficultyHints
    distractor?: string
    masteryOutcome?: StatsOutcome
    masteryContext?: UpdateStatsContext
    countAsNewIntro?: boolean
  }) => void
  onAddMyWords?: (wordIds: string[]) => void
  onRemoveTrainingWords?: (wordIds: string[]) => void
  onSaveWordEdit?: (word: KanjiWord) => void
  onHideWords?: (wordIds: string[]) => void
  onToggleLearnedWords?: (wordIds: string[]) => void
  onAddProblemWords?: (wordIds: string[]) => void
  onRemoveProblemWords?: (wordIds: string[]) => void
  onOpenKanjiInfo?: (character: string) => void
}

export function VocabTrainer({
  preferences,
  stats,
  memory = {},
  latencyModel = DEFAULT_LATENCY_MODEL,
  reviewDay = { dayKey: '', newIntroduced: 0 },
  myWords,
  customWords = {},
  hiddenWordIds = [],
  learnedWordIds = [],
  trainingWordIds = [],
  problemWordIds = [],
  liveSession = null,
  onSaveLiveSession,
  onPatchPreferences,
  onUpdateStats,
  onApplyGradedReview,
  onAddMyWords,
  onRemoveTrainingWords,
  onSaveWordEdit,
  onHideWords,
  onToggleLearnedWords,
  onAddProblemWords,
  onRemoveProblemWords,
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

  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [currentPrompt, setCurrentPrompt] = useState<VocabMixedPrompt | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [canGoPrev, setCanGoPrev] = useState(false)
  /** Optimistic per-card stats for the session sidebar (merged over persisted `stats`). */
  const [liveStats, setLiveStats] = useState<Record<string, StatsRecord>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const preferencesRef = useRef(preferences)
  const statsRef = useRef(stats)
  const memoryRef = useRef(memory)
  const latencyModelRef = useRef(latencyModel)
  const reviewDayRef = useRef(reviewDay)
  const myWordsRef = useRef(myWords)
  const customWordsRef = useRef(customWords)
  const hiddenWordIdsRef = useRef(hiddenWordIds)
  const learnedWordIdsRef = useRef(learnedWordIds)
  const trainingWordIdsRef = useRef(trainingWordIds)
  const problemWordIdsRef = useRef(problemWordIds)
  const activeCardRef = useRef<VocabCard | null>(null)
  const currentCardIdRef = useRef<string | null>(null)
  const navHistoryRef = useRef<string[]>([])
  const navIndexRef = useRef(-1)
  const didRestoreLiveSessionRef = useRef(false)
  const [sessionWeightMultipliers, setSessionWeightMultipliers] = useState<Record<string, number>>({})
  const sessionWeightMultipliersRef = useRef<Record<string, number>>({})
  /** Epoch ms when each card entered the current session pool (novelty sort). */
  const [sessionPoolAddedAt, setSessionPoolAddedAt] = useState<Record<string, number>>({})
  const sessionPoolAddedAtRef = useRef<Record<string, number>>({})
  const [setupExcludedIds, setSetupExcludedIds] = useState<Set<string>>(() => new Set())

  function seedPoolAddedAt(poolIds: string[], base = Date.now()): Record<string, number> {
    const next: Record<string, number> = {}
    for (let i = 0; i < poolIds.length; i += 1) {
      // Later pool index ≈ added later (e.g. Набор append order).
      next[poolIds[i]!] = base + i
    }
    return next
  }

  function replacePoolAddedAt(next: Record<string, number>) {
    sessionPoolAddedAtRef.current = next
    setSessionPoolAddedAt(next)
  }

  function markPoolAdded(cardId: string, at = Date.now()) {
    const prev = sessionPoolAddedAtRef.current
    const maxExisting = Object.values(prev).reduce((max, value) => Math.max(max, value), 0)
    const next = { ...prev, [cardId]: Math.max(at, maxExisting + 1) }
    replacePoolAddedAt(next)
  }

  function syncPoolAddedAt(poolIds: string[]) {
    const prev = sessionPoolAddedAtRef.current
    const now = Date.now()
    const next: Record<string, number> = {}
    let cursor = Math.max(now, ...Object.values(prev), 0)
    for (const id of poolIds) {
      if (prev[id] != null) {
        next[id] = prev[id]!
      } else {
        cursor += 1
        next[id] = cursor
      }
    }
    replacePoolAddedAt(next)
  }

  const poolOpts = { hiddenWordIds, learnedWordIds, trainingWordIds, problemWordIds }
  const isSetSource =
    preferences.source === 'group' ||
    preferences.source === 'kanji' ||
    preferences.source === 'list' ||
    preferences.source === 'problem'
  const sourcePool = useMemo(
    () => buildVocabPool(preferences, myWords, customWords, { applyNewWordLimit: false, ...poolOpts }),
    [preferences, myWords, customWords, hiddenWordIds, learnedWordIds, trainingWordIds, problemWordIds],
  )
  /** Limited start set (for «Слов за раз»); setup menu shows full `sourcePool`. */
  const activePool = useMemo(
    () => applyVocabNewWordLimit(sourcePool, preferences),
    [sourcePool, preferences],
  )
  const startPool = useMemo(
    () =>
      applyVocabNewWordLimit(
        sourcePool.filter((card) => !setupExcludedIds.has(card.id)),
        preferences,
      ),
    [sourcePool, setupExcludedIds, preferences],
  )

  useEffect(() => {
    setSetupExcludedIds((prev) => {
      if (!prev.size) return prev
      const allow = new Set(sourcePool.map((card) => card.id))
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (allow.has(id)) next.add(id)
        else changed = true
      }
      return changed || next.size !== prev.size ? next : prev
    })
  }, [sourcePool])
  const isSetSourceRef = useRef(isSetSource)
  useEffect(() => {
    isSetSourceRef.current = isSetSource
  }, [isSetSource])
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
    memoryRef.current = memory
    latencyModelRef.current = latencyModel
    reviewDayRef.current = reviewDay
    myWordsRef.current = myWords
    customWordsRef.current = customWords
    hiddenWordIdsRef.current = hiddenWordIds
    learnedWordIdsRef.current = learnedWordIds
    trainingWordIdsRef.current = trainingWordIds
    problemWordIdsRef.current = problemWordIds
  }, [
    preferences,
    stats,
    memory,
    latencyModel,
    reviewDay,
    myWords,
    customWords,
    hiddenWordIds,
    learnedWordIds,
    trainingWordIds,
    problemWordIds,
  ])

  function usesReviewV2(session?: PracticeSession) {
    if (session?.review) return true
    return preferencesRef.current.reviewV2 !== false
  }

  useEffect(() => {
    activeCardRef.current = activeCard
  }, [activeCard])

  useEffect(() => {
    currentCardIdRef.current = currentCardId
  }, [currentCardId])

  useEffect(() => {
    if (didRestoreLiveSessionRef.current) return
    didRestoreLiveSessionRef.current = true
    if (
      !liveSession ||
      liveSession.view !== 'practice' ||
      !liveSession.currentCardId ||
      !liveSession.session.poolIds.includes(liveSession.currentCardId)
    ) {
      return
    }

    const cardId = liveSession.currentCardId
    sessionRef.current = liveSession.session
    setSession(liveSession.session)
    setSessionStats(liveSession.sessionStats)
    setCurrentCardId(cardId)
    setView('practice')
    setSessionWeightMultipliers(liveSession.weightMultipliers ?? {})
    sessionWeightMultipliersRef.current = liveSession.weightMultipliers ?? {}
    const restoredAddedAt =
      liveSession.poolAddedAt && Object.keys(liveSession.poolAddedAt).length
        ? liveSession.poolAddedAt
        : seedPoolAddedAt(liveSession.session.poolIds)
    replacePoolAddedAt(restoredAddedAt)
    navHistoryRef.current = liveSession.navHistory ?? []
    navIndexRef.current = liveSession.navIndex ?? -1
    setCanGoPrev((liveSession.navIndex ?? -1) > 0)
    resetRound(Date.now())
    setInputValue('')
    setSelectedChoice(null)
    setFeedback({ type: 'idle', text: '' })

    const mode = preferencesRef.current.drillMode
    const card =
      activePool.find((item) => item.id === cardId) ??
      sourcePool.find((item) => item.id === cardId) ??
      null
    if (card && (mode === 'choice' || mode === 'mixed')) {
      const distractorPool = buildWideVocabDistractorPool(customWordsRef.current, hiddenWordIdsRef.current)
      const optionsPool = distractorPool.length >= 6 ? distractorPool : sourcePool.length ? sourcePool : activePool
      setCurrentPrompt(
        mode === 'mixed' ? buildMixedPrompt(card, optionsPool) : buildMeaningPrompt(card, optionsPool),
      )
    } else {
      setCurrentPrompt(null)
    }
  }, [liveSession, activePool, sourcePool, setSession, setSessionStats, setView, sessionRef, resetRound, setFeedback])

  useEffect(() => {
    if (!onSaveLiveSession) return
    if (view !== 'practice' || !currentCardId) return
    onSaveLiveSession({
      session,
      currentCardId,
      view,
      sessionStats,
      weightMultipliers: sessionWeightMultipliers,
      poolAddedAt: sessionPoolAddedAt,
      navHistory: navHistoryRef.current,
      navIndex: navIndexRef.current,
    })
  }, [
    view,
    currentCardId,
    session,
    sessionStats,
    sessionWeightMultipliers,
    sessionPoolAddedAt,
    onSaveLiveSession,
  ])

  useEffect(() => {
    if (view === 'practice' && preferences.drillMode === 'romaji') {
      inputRef.current?.focus()
    }
  }, [view, currentCardId, preferences.drillMode])

  const skipToAdjacentRef = useRef<(direction: 'prev' | 'next') => void>(() => {})
  const revealHintRef = useRef<() => void>(() => {})

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (viewRef.current !== 'practice' || !activeCardRef.current) return
      const typingInField =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement

      if (event.code === 'ArrowLeft' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        skipToAdjacentRef.current('prev')
        return
      }
      if (event.code === 'ArrowRight' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        skipToAdjacentRef.current('next')
        return
      }

      if (event.code === 'Space' && preferencesRef.current.drillMode === 'romaji') {
        // Input field handles Space via onKeyDown when focused.
        if (typingInField) return
        event.preventDefault()
        revealHintRef.current()
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown, true)
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true)
  }, [])

  function showCard(
    cardId: string,
    nextSession: PracticeSession,
    optionsPool: VocabCard[],
    {
      recordSeen = true,
      /** When false, do not bump showCounts/cooldowns (skip navigation). */
      countPresentation = true,
    }: { recordSeen?: boolean; countPresentation?: boolean } = {},
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
    // C5: presentation pacing for real drill shows (not nav skips).
    // Even mode also needs showCounts for the new-word ×2 boost.
    const trackShows =
      countPresentation &&
      (!usesReviewV2(nextSession) || preferencesRef.current.pickMode === 'even')
    const shownSession = trackShows ? prepareShownCard(nextSession, cardId) : nextSession
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
    return buildVocabPool(prefs, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
      trainingWordIds: trainingWordIdsRef.current,
      problemWordIds: problemWordIdsRef.current,
    })
  }

  function getPracticePool() {
    const prefs = preferencesRef.current
    const full = resolveFullPool(false)
    if (viewRef.current === 'practice' && sessionRef.current.poolIds.length) {
      const allow = new Set(sessionRef.current.poolIds)
      // «Набор» (list) keeps my-words in play; group/kanji still drop them unless trainFullGroup.
      const excludeMine =
        isSetSourceRef.current &&
        prefs.source !== 'list' &&
        prefs.source !== 'problem' &&
        !prefs.trainFullGroup
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

  function removeFromTrainingSet(wordIds: string[]) {
    if (!onRemoveTrainingWords || preferencesRef.current.source !== 'list') return
    const ids = [...new Set(wordIds.filter(Boolean))]
    if (!ids.length) return
    const drop = new Set(ids)
    trainingWordIdsRef.current = trainingWordIdsRef.current.filter((id) => !drop.has(id))
    onRemoveTrainingWords(ids)
  }

  function resetSessionWeights() {
    sessionWeightMultipliersRef.current = {}
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
      sessionWeightMultipliersRef.current = next
      return next
    })
    if (sessionRef.current.review) {
      const nextSession = patchReviewWeights(sessionRef.current, cardId, clamped)
      sessionRef.current = nextSession
      setSession(nextSession)
    }
  }

  function zeroWeightExcludeIds(weights: Record<string, number>, extraIds: string[] = []): string[] {
    const ids = new Set(extraIds)
    for (const [id, weight] of Object.entries(weights)) {
      if (weight <= 0) ids.add(id)
    }
    return [...ids]
  }

  function pickNextVocabCardId(pool: VocabCard[], currentCardId: string | null, session: PracticeSession) {
    const weights = sessionWeightMultipliersRef.current
    const activePool = pool.filter((card) => (weights[card.id] ?? 1) > 0)
    const pickPool = activePool.length ? activePool : pool
    const excludeIds = zeroWeightExcludeIds(weights, currentCardId ? [currentCardId] : [])
    const pickMode = preferencesRef.current.pickMode

    // Even mode must win over the v2 review sequencer — otherwise mid-session
    // toggles look like a no-op while review keeps driving picks.
    if (pickMode === 'even') {
      const evenWeights = buildEvenModeWeightMultipliers(
        pickPool.map((card) => card.id),
        {
          weightMultipliers: weights,
          showCounts: session.showCounts ?? {},
        },
      )
      return pickWeightedVocabCardId(pickPool, {
        excludeIds,
        weightMultipliers: evenWeights,
      })
    }

    if (usesReviewV2(session) && session.review) {
      const picked = pickReviewCard(
        session,
        pickPool,
        memoryRef.current,
        statsRef.current,
        preferencesRef.current,
      )
      sessionRef.current = picked.session
      setSession(picked.session)
      if (picked.done) return null
      return picked.cardId
    }

    return pickNextCardId(
      pickPool,
      statsWithDefaults(pickPool),
      session,
      pickMode,
      DEFAULT_HYPERPARAMS,
      Math.random,
      { weightMultipliers: weights },
    )
  }

  function handlePickModeChange(mode: 'adaptive' | 'even') {
    onPatchPreferences({ pickMode: mode })
    preferencesRef.current = { ...preferencesRef.current, pickMode: mode }
    const current = sessionRef.current
    const nextSession: PracticeSession = {
      ...current,
      mode,
      review: current.review ? { ...current.review, mode } : current.review,
    }
    sessionRef.current = nextSession
    setSession(nextSession)
    setFeedback({
      type: 'idle',
      text: mode === 'even' ? 'Режим: равномерный' : 'Режим: адаптивный',
    })
  }

  function getDistractorPool() {
    const prefs = preferencesRef.current
    if (prefs.source === 'kanji' || prefs.source === 'list' || prefs.source === 'group') {
      const wide = buildWideVocabDistractorPool(customWordsRef.current, hiddenWordIdsRef.current)
      if (wide.length >= 6) return wide
    }
    return buildVocabPool(prefs, myWordsRef.current, customWordsRef.current, {
      applyNewWordLimit: false,
      hiddenWordIds: hiddenWordIdsRef.current,
      learnedWordIds: learnedWordIdsRef.current,
      trainingWordIds: trainingWordIdsRef.current,
      problemWordIds: problemWordIdsRef.current,
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

    let nextSession = nextSessionOverride ?? sessionRef.current
    const nextId = pickNextVocabCardId(pool, currentCardIdRef.current, nextSession)
    nextSession = sessionRef.current
    if (!nextId) {
      if (usesReviewV2(nextSession) && nextSession.review?.done) {
        stopPractice()
        setFeedback({
          type: 'success',
          text: 'Слова этой сессии пройдены. Можно начать снова или выбрать другой набор.',
        })
        return
      }
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
      { recordSeen: true, countPresentation: true },
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
      showCard(prevId, sessionRef.current, optionsPool, { recordSeen: false, countPresentation: false })
      return
    }

    if (navIndexRef.current >= 0 && navIndexRef.current < navHistoryRef.current.length - 1) {
      navIndexRef.current += 1
      setCanGoPrev(navIndexRef.current > 0)
      const nextId = navHistoryRef.current[navIndexRef.current]
      showCard(nextId, sessionRef.current, optionsPool, { recordSeen: false, countPresentation: false })
      return
    }

    // Fresh forward skip = correct (or soft-correct if hint/mistakes already happened).
    if (activeCardRef.current) {
      finalizeCorrect(
        roundRef.current.hintUsed || roundRef.current.mistakes > 0 ? 'hint' : 'correct',
        0,
      )
      return
    }

    const currentId = currentCardIdRef.current
    const session = sessionRef.current
    const pickSession: PracticeSession =
      usesReviewV2(session) || !currentId ? session : pushRecentCard(session, currentId)
    const nextId = pickNextVocabCardId(pool, currentId, pickSession)
    if (!nextId || nextId === currentId) {
      if (pool.length < 2) return
      const fallback = pool.find((card) => card.id !== currentId)
      if (!fallback) return
      rememberNavCard(fallback.id)
      showCard(fallback.id, sessionRef.current, optionsPool, {
        recordSeen: false,
        countPresentation: false,
      })
      return
    }

    rememberNavCard(nextId)
    showCard(nextId, sessionRef.current, optionsPool, { recordSeen: false, countPresentation: false })
  }

  skipToAdjacentRef.current = skipToAdjacent

  function startPractice() {
    const scope = startPool
    if (!scope.length) {
      setFeedback({
        type: 'error',
        text:
          preferences.source === 'mine'
            ? 'В «Моих словах» пока пусто. Добавьте слова из каталога.'
            : setupExcludedIds.size && sourcePool.length
              ? 'Все слова исключены. Верните хотя бы одно в список справа.'
              : 'В этом наборе нет слов для тренировки.',
      })
      return
    }

    resetSessionWeights()
    navHistoryRef.current = []
    navIndexRef.current = -1
    setCanGoPrev(false)
    setLiveStats({})

    if (preferences.reviewV2 !== false) {
      const planned = startReviewPracticeSession({
        scope,
        preferences,
        memory: memoryRef.current,
        stats: statsRef.current,
        newUsedToday: reviewDayRef.current.newIntroduced,
        weightMultipliers: {},
      })
      if (planned.planEmpty) {
        setFeedback({
          type: 'error',
          text: 'В этом наборе нет слов для тренировки.',
        })
        return
      }
      replacePoolAddedAt(seedPoolAddedAt(planned.session.poolIds))
      const nextSession = beginPractice(planned.session)
      sessionRef.current = nextSession
      advanceToNextCard(nextSession)
      if (planned.dueCount || planned.newCount) {
        setFeedback({
          type: 'idle',
          text: `К повторению: ${planned.dueCount}, новых: ${planned.newCount}`,
        })
      }
      return
    }

    const poolIds = startPool.map((card) => card.id)
    replacePoolAddedAt(seedPoolAddedAt(poolIds))
    const nextSession = beginPractice({
      poolIds,
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
    replacePoolAddedAt({})
    navHistoryRef.current = []
    navIndexRef.current = -1
    setCanGoPrev(false)
    onSaveLiveSession?.(null)
  }

  function settleGrade({
    card,
    grade,
    wrong,
    delay,
    distractor,
    advance = true,
  }: {
    card: VocabCard
    grade: ReviewGrade
    wrong: boolean
    delay: number
    distractor?: string
    advance?: boolean
  }) {
    const now = Date.now()
    const activeRound = roundRef.current
    const prefs = preferencesRef.current
    const latencyMs = Math.max(200, now - activeRound.shownAt)
    const aspect = drillModeToAspect(prefs.drillMode)
    const answerLength = answerLengthForCard(card.answers, prefs.drillMode)
    const statsOutcome = masteryOutcomeFromRound({
      wrong,
      dontKnow: Boolean(activeRound.dontKnow),
      hintUsed: activeRound.hintUsed,
      wrongRecorded: Boolean(activeRound.wrongRecorded),
    })
    const masteryHintUsed =
      activeRound.hintUsed || statsOutcome === 'hint' || statsOutcome === 'wrong'

    if (onApplyGradedReview && usesReviewV2()) {
      onApplyGradedReview({
        cardId: card.id,
        aspect,
        grade,
        now,
        latencyMs,
        drillMode: prefs.drillMode,
        answerLength,
        hints: cardHintsFromVocab(card),
        distractor,
        masteryOutcome: statsOutcome,
        masteryContext: {
          now,
          latencyMs,
          mistakesOnCard: activeRound.mistakes,
          hintUsed: masteryHintUsed,
          inputMode: prefs.inputMode,
          drillMode: prefs.drillMode,
          answerLength,
        },
        countAsNewIntro: true,
      })
    } else {
      onUpdateStats(card.id, statsOutcome, {
        now,
        latencyMs,
        mistakesOnCard: activeRound.mistakes,
        hintUsed: masteryHintUsed,
        inputMode: prefs.inputMode,
        drillMode: prefs.drillMode,
        answerLength,
      })
    }

    let nextSession = sessionRef.current
    if (usesReviewV2(nextSession) && nextSession.review) {
      nextSession = gradeAndAdvanceReview({
        session: nextSession,
        cardId: card.id,
        grade,
        pool: getPracticePool(),
      })
    } else if (grade >= 3 || (!wrong && grade === 2 && !activeRound.hintUsed)) {
      const poolSize = getPracticePool().length || nextSession.poolIds.length || 1
      const clean = grade >= 3 && activeRound.mistakes === 0 && !activeRound.hintUsed
      nextSession = afterSuccessfulCard(nextSession, card.id, {
        kind: statsOutcome === 'hint' ? 'hint' : 'correct',
        poolSize,
        clean,
      })
    } else if (wrong || grade === 1) {
      nextSession = enqueueMistake(nextSession, card.id)
    }

    recordCleanAnswer(grade >= 3 && activeRound.mistakes === 0 && !activeRound.hintUsed)
    sessionRef.current = nextSession
    setSession(nextSession)
    patchRound({ wrongRecorded: true })

    const problemIds = card.variantIds?.length ? card.variantIds : [card.id]
    const existingStats = statsRef.current[card.id] ?? createStatsRecord()
    const projectedRecent = projectRecentAnswers(existingStats.recentAnswers, statsOutcome)
    // Keep local ref in sync before React state catches up (multi-answer rounds).
    const projectedClears =
      existingStats.clears + (statsOutcome === 'correct' ? 1 : 0)
    const projectedErrors = existingStats.errors + (statsOutcome === 'wrong' ? 1 : 0)
    const projectedHints = existingStats.hints + (statsOutcome === 'hint' ? 1 : 0)
    const projectedTotal = projectedClears + projectedErrors + projectedHints
    const nextCardStats: StatsRecord = {
      ...existingStats,
      clears: projectedClears,
      errors: projectedErrors,
      hints: projectedHints,
      recentAnswers: projectedRecent,
      eventAccuracy: projectedTotal
        ? Math.round((projectedClears / projectedTotal) * 100)
        : 0,
    }
    statsRef.current = {
      ...statsRef.current,
      [card.id]: nextCardStats,
    }
    setLiveStats((prev) => ({ ...prev, [card.id]: nextCardStats }))
    if (isProblemByRecentAnswers(projectedRecent)) {
      onAddProblemWords?.(problemIds)
    } else {
      onRemoveProblemWords?.(problemIds)
    }

    if (!advance) return
    if (grade >= 3) setFeedback({ type: 'success', text: '' })
    queueAdvance(() => advanceToNextCard(nextSession), delay)
  }

  function finalizeCorrect(kind: 'correct' | 'hint', delay = 280) {
    const card = activeCardRef.current
    if (!card) return
    const activeRound = roundRef.current
    const prefs = preferencesRef.current
    const now = Date.now()
    const mem = resolveCardMemory(
      memoryRef.current,
      statsRef.current,
      card.id,
      drillModeToAspect(prefs.drillMode),
      now,
    )
    const grade = deriveRoundGrade({
      wrong: false,
      hintUsed: kind === 'hint' || activeRound.hintUsed,
      dontKnow: Boolean(activeRound.dontKnow),
      typoForgiven: Boolean(activeRound.typoForgiven),
      mistakesOnCard: activeRound.mistakes,
      latencyMs: now - activeRound.shownAt,
      answers: card.answers,
      drillMode: prefs.drillMode,
      latencyModel: latencyModelRef.current,
      hadRecentLapse: mem.lapses > 0 && mem.lastAt > 0 && now - mem.lastAt < 8 * 3_600_000,
    })
    settleGrade({ card, grade, wrong: false, delay })
  }

  function registerWrongAttempt() {
    if (!activeCard) return
    // C1: at most one again / stats wrong per round.
    if (roundRef.current.wrongRecorded) {
      patchRound({ mistakes: Math.max(1, roundRef.current.mistakes) })
      return
    }
    patchRound({ mistakes: roundRef.current.mistakes + 1, wrongRecorded: true })
    // C8: sync sessionRef immediately.
    if (!usesReviewV2()) {
      const nextSession = enqueueMistake(sessionRef.current, activeCard.id)
      sessionRef.current = nextSession
      setSession(nextSession)
      onUpdateStats(activeCard.id, 'wrong', {
        now: Date.now(),
        inputMode: preferencesRef.current.inputMode,
        drillMode: preferencesRef.current.drillMode,
        answerLength: answerLengthForCard(activeCard.answers, preferencesRef.current.drillMode),
      })
    }
  }

  function handleDontKnow() {
    if (!activeCard || viewRef.current !== 'practice' || pendingAdvanceRef.current) return
    patchRound({ dontKnow: true, hintUsed: true, wrongRecorded: true })
    setFeedback({ type: 'wrong', text: 'Не помню' })
    settleGrade({
      card: activeCard,
      grade: 1,
      wrong: true,
      delay: preferences.drillMode === 'romaji' ? 500 : 900,
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
      // C2: soft typo → hard, not again.
      if (isForgivableTypo(activeCard.answers, value)) {
        patchRound({ typoForgiven: true, mistakes: Math.max(roundRef.current.mistakes, 1) })
        setFeedback({ type: 'wrong', text: 'Почти — проверьте опечатку' })
        return
      }
      if (previousResult !== 'wrong' && !roundRef.current.wrongRecorded) {
        registerWrongAttempt()
        setFeedback({ type: 'wrong', text: '' })
      }
      return
    }

    if (feedback.type === 'wrong') {
      setFeedback({ type: 'idle', text: '' })
    }

    if (result === 'correct') {
      finalizeCorrect(
        roundRef.current.hintUsed || roundRef.current.wrongRecorded ? 'hint' : 'correct',
        220,
      )
    }
  }

  function handleSubmitAnswer() {
    if (!activeCard || view !== 'practice' || pendingAdvanceRef.current) return
    const result = evaluateRomajiReadings(activeCard.answers, inputValue, 'submit')
    if (result === 'empty') return

    if (result === 'correct') {
      finalizeCorrect(
        roundRef.current.hintUsed || roundRef.current.wrongRecorded ? 'hint' : 'correct',
        220,
      )
      return
    }

    // C2: forgivable typo does not force hintUsed / again.
    if (isForgivableTypo(activeCard.answers, inputValue)) {
      patchRound({ typoForgiven: true, mistakes: Math.max(roundRef.current.mistakes, 1) })
      setFeedback({ type: 'wrong', text: 'Почти — исправьте опечатку и отправьте снова' })
      return
    }

    registerWrongAttempt()
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: 'Неверно.',
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

  revealHintRef.current = revealHint

  function handleChoose(answer: string) {
    if (!activeCard || !currentPrompt || selectedChoice || pendingAdvanceRef.current) return
    setSelectedChoice(answer)

    if (answer === currentPrompt.correctAnswer) {
      setFeedback({ type: 'success', text: '' })
      finalizeCorrect(roundRef.current.hintUsed ? 'hint' : 'correct', 700)
      return
    }

    // C7: choice wrong == romaji again (same grade / lag via settleGrade).
    patchRound({ mistakes: roundRef.current.mistakes + 1, wrongRecorded: true, hintUsed: true })
    setFeedback({
      type: 'wrong',
      text: `Верно: ${currentPrompt.correctAnswer}`,
    })
    settleGrade({
      card: activeCard,
      grade: 1,
      wrong: true,
      delay: 1100,
      distractor: answer,
    })
  }

  function dropCardFromSession(cardId: string): PracticeSession {
    const currentSession = sessionRef.current
    const nextSession = usesReviewV2(currentSession)
      ? removeCardFromReviewSession(currentSession, cardId)
      : {
          ...currentSession,
          poolIds: (
            currentSession.poolIds.length
              ? currentSession.poolIds
              : getPracticePool().map((card) => card.id)
          ).filter((id) => id !== cardId),
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
      sessionWeightMultipliersRef.current = next
      return next
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
    const alreadyMine = variantIds.some((id) => myWordsRef.current.includes(id))
    const fromList = preferencesRef.current.source === 'list'
    // Outside «Набор», button only adds new mine words; for list it also moves out of the set.
    if (alreadyMine && !fromList) return

    clearPendingAdvance()
    const removeId = card.id
    const writing = card.writing

    if (!alreadyMine) {
      myWordsRef.current = [...new Set([...myWordsRef.current, ...variantIds])]
      onAddMyWords(variantIds)
    }
    removeFromTrainingSet(variantIds)

    const nextSession = dropCardFromSession(removeId)
    if (!nextSession.poolIds.length || !getPracticePool().length) {
      stopPractice()
      setFeedback({
        type: 'success',
        text: fromList
          ? alreadyMine
            ? `«${writing}» убрано из набора. Других слов не осталось.`
            : `«${writing}» перенесено в «Мои слова» и убрано из набора. Других слов не осталось.`
          : `«${writing}» добавлено в мои слова. Других слов в наборе не осталось.`,
      })
      return
    }

    advanceToNextCard(nextSession)
    setFeedback({
      type: 'success',
      text: fromList
        ? alreadyMine
          ? `«${writing}» убрано из набора`
          : `«${writing}» перенесено в «Мои слова» и убрано из набора`
        : `«${writing}» добавлено в мои слова`,
    })
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
    const fromList = preferences.source === 'list'
    if (fromList) removeFromTrainingSet(ids)

    // Group/kanji without trainFullGroup: mine words leave the pool → stop.
    // List: words leave the staged set → stop.
    if (fromList || !preferences.trainFullGroup) {
      clearPendingAdvance()
      stopPractice()
      setFeedback({
        type: 'success',
        text: fromList
          ? toAdd.length
            ? `В «Мои слова» перенесено: ${toAdd.length}. Слова убраны из набора.`
            : 'Слова убраны из набора (уже были в «Моих словах»).'
          : toAdd.length
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

  function handleExcludeCurrentFromSession() {
    const card = activeCardRef.current
    if (!card?.id) return
    clearPendingAdvance()

    const nextWeights = { ...sessionWeightMultipliersRef.current, [card.id]: 0 }
    sessionWeightMultipliersRef.current = nextWeights
    setSessionWeightMultipliers(nextWeights)
    if (sessionRef.current.review) {
      const nextSession = patchReviewWeights(sessionRef.current, card.id, 0)
      sessionRef.current = nextSession
      setSession(nextSession)
    }

    const pool = getPracticePool()
    const remaining = pool.filter((item) => (nextWeights[item.id] ?? 1) > 0)
    if (!remaining.length) {
      setFeedback({
        type: 'success',
        text: `«${card.writing}» исключено. Верните слово кнопкой «Вернуть», чтобы продолжить.`,
      })
      return
    }

    advanceToNextCard()
    setFeedback({
      type: 'success',
      text: `«${card.writing}» исключено из этой тренировки. Вернуть — в списке справа.`,
    })
  }

  function handleRestoreCurrentToSession() {
    const card = activeCardRef.current
    if (!card?.id) return
    setSessionWeight(card.id, 1)
    setFeedback({ type: 'success', text: `«${card.writing}» снова в тренировке` })
  }

  function handleAddSourceWord() {
    if (
      preferences.source !== 'group' &&
      preferences.source !== 'level' &&
      preferences.source !== 'kanji' &&
      preferences.source !== 'list'
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
    const nextSession = appendCardToReviewSession(sessionRef.current, next.id)
    sessionRef.current = nextSession
    setSession(nextSession)
    markPoolAdded(next.id)
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
    if (rebuild) replacePoolAddedAt(seedPoolAddedAt(poolIds))
    else syncPoolAddedAt(poolIds)

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
      preferences.source === 'list') &&
    Boolean(pickNextSourceCard(sourcePool, session.poolIds))

  const showWordJlptFilter =
    preferences.source === 'group' ||
    preferences.source === 'mine' ||
    preferences.source === 'kanji' ||
    preferences.source === 'list' ||
    preferences.source === 'problem'

  const practiceSidebar =
    view === 'practice' ? (
      <VocabSessionSidebar
        pickMode={preferences.pickMode}
        source={preferences.source}
        level={preferences.level}
        wordJlptLevels={preferences.wordJlptLevels ?? []}
        cards={practicePool}
        currentCardId={currentCardId}
        stats={{ ...stats, ...liveStats }}
        weightMultipliers={sessionWeightMultipliers}
        poolAddedAt={sessionPoolAddedAt}
        canAddSourceWord={canAddSourceWord}
        showWordJlptFilter={showWordJlptFilter}
        onPickModeChange={handlePickModeChange}
        onLevelChange={handleSessionLevelChange}
        onWordJlptChange={handleSessionWordJlptChange}
        onSetWeight={setSessionWeight}
        onResetWeights={resetSessionWeights}
        onAddSourceWord={canAddSourceWord ? handleAddSourceWord : undefined}
      />
    ) : null

  if (view === 'setup') {
    return (
      <VocabSetup
        preferences={preferences}
        poolCards={sourcePool}
        poolCount={startPool.length}
        sourcePoolCount={sourcePool.length}
        myWordsCount={myWords.length}
        myWordIds={myWords}
        errorText={feedback.type === 'error' ? feedback.text : ''}
        infoText={feedback.type === 'success' ? feedback.text : ''}
        trainingWordCount={trainingWordIds.length}
        problemWordCount={problemWordIds.length}
        excludedIds={setupExcludedIds}
        memory={memory}
        onPatchPreferences={onPatchPreferences}
        onToggleExclude={(cardId) => {
          setSetupExcludedIds((prev) => {
            const next = new Set(prev)
            if (next.has(cardId)) next.delete(cardId)
            else next.add(cardId)
            return next
          })
        }}
        onClearExcluded={() => setSetupExcludedIds(new Set())}
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
      currentExcluded={Boolean(activeCard && (sessionWeightMultipliers[activeCard.id] ?? 1) <= 0)}
      showAddSessionToMyWords={isSetSource && Boolean(onAddMyWords)}
      sessionWordCount={
        sessionRef.current.poolIds.length || activePool.length
      }
      onInputChange={handleInputChange}
      onInputKeyDown={handleInputKeyDown}
      onRevealHint={revealHint}
      onDontKnow={handleDontKnow}
      onChoose={handleChoose}
      onSkipPrev={() => skipToAdjacent('prev')}
      onSkipNext={() => skipToAdjacent('next')}
      onStop={stopPractice}
      onSubmitAnswer={handleSubmitAnswer}
      onAddCurrentToMyWords={onAddMyWords ? handleAddCurrentToMyWords : undefined}
      onAddSessionToMyWords={isSetSource && onAddMyWords ? handleAddSessionToMyWords : undefined}
      onToggleLearned={onToggleLearnedWords ? handleToggleLearned : undefined}
      onExcludeFromSession={handleExcludeCurrentFromSession}
      onRestoreToSession={handleRestoreCurrentToSession}
      onSaveWordEdit={onSaveWordEdit ? handleSaveWordEdit : undefined}
      onDeleteWord={onHideWords ? handleDeleteCurrentWord : undefined}
      onOpenKanjiInfo={onOpenKanjiInfo}
      aside={practiceSidebar}
    />
  )
}
