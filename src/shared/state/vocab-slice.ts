import { useCallback } from 'react'
import type {
  CardTrainerLiveSession,
  KanjiWord,
  LatencyModel,
  MemoryState,
  ReviewAspect,
  ReviewGrade,
  StatsOutcome,
  UpdateStatsContext,
  VocabPreferences,
  VocabTrainingSet,
} from '../lib/types'
import { DEFAULT_HYPERPARAMS, createStatsRecord, getDayKey, updateCardStats } from '../lib/trainer'
import {
  MAIN_TRAINING_SET_ID,
  addWordsToTrainingSet,
  defaultNewSetName,
  getTrainingSet,
  getTrainingSetWordIds,
  moveWordsBetweenTrainingSets,
  newTrainingSetId,
  removeWordsFromAllTrainingSets,
  removeWordsFromTrainingSet,
  resolveActiveTrainingSetId,
} from '../lib/trainingSets'
import {
  applyReview,
  createNewMemoryState,
  encodeReviewEvent,
  markPresented,
  memoryKey,
  migrateFromMastery,
  retentionAt,
  type PriorDifficultyHints,
  updateLatencyModel,
} from '../lib/review'
import { appendReviewEvent } from '../lib/review/journal'
import { hoursBetween } from '../lib/review/math'
import { useAppStateContext } from './core'

export function useVocabState() {
  const { appState, setAppState } = useAppStateContext()

  const toggleMyWord = useCallback(
    (wordId: string) => {
      if (!wordId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const myWords = prevState.vocab.myWords
        const removing = myWords.includes(wordId)
        const nextWords = removing ? myWords.filter((item) => item !== wordId) : [...myWords, wordId]
        const customWords = { ...prevState.vocab.customWords }
        const myWordAddedAt = { ...(prevState.vocab.myWordAddedAt ?? {}) }
        if (removing) {
          delete myWordAddedAt[wordId]
          if (wordId.startsWith('custom:')) {
            delete customWords[wordId]
          }
        } else {
          myWordAddedAt[wordId] = Date.now()
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: nextWords,
            myWordAddedAt,
            customWords,
            learnedWordIds: removing
              ? (prevState.vocab.learnedWordIds ?? []).filter((id) => id !== wordId)
              : prevState.vocab.learnedWordIds ?? [],
          },
        }
      })
    },
    [setAppState],
  )

  const addMyWords = useCallback(
    (wordIds: string[]) => {
      const ids = [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const known = new Set(prevState.vocab.myWords)
        const toAdd = ids.filter((id) => !known.has(id))
        if (!toAdd.length) return prevState
        const now = Date.now()
        const myWordAddedAt = { ...(prevState.vocab.myWordAddedAt ?? {}) }
        for (const id of toAdd) {
          myWordAddedAt[id] = now
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: [...prevState.vocab.myWords, ...toAdd],
            myWordAddedAt,
          },
        }
      })
    },
    [setAppState],
  )

  const removeMyWords = useCallback(
    (wordIds: string[]) => {
      const ids = new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))
      if (!ids.size) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const nextWords = prevState.vocab.myWords.filter((id) => !ids.has(id))
        if (nextWords.length === prevState.vocab.myWords.length) return prevState
        const customWords = { ...prevState.vocab.customWords }
        const myWordAddedAt = { ...(prevState.vocab.myWordAddedAt ?? {}) }
        for (const id of ids) {
          delete myWordAddedAt[id]
          if (id.startsWith('custom:')) delete customWords[id]
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: nextWords,
            myWordAddedAt,
            customWords,
            learnedWordIds: (prevState.vocab.learnedWordIds ?? []).filter((id) => !ids.has(id)),
          },
        }
      })
    },
    [setAppState],
  )

  const addCustomWord = useCallback(
    (word: KanjiWord) => {
      if (!word?.id) return
      const wordId = word.id
      setAppState((prevState) => {
        if (!prevState) return prevState
        const addToMine = wordId.startsWith('custom:') || prevState.vocab.myWords.includes(wordId)
        const alreadyMine = prevState.vocab.myWords.includes(wordId)
        const myWords = addToMine
          ? alreadyMine
            ? prevState.vocab.myWords
            : [...prevState.vocab.myWords, wordId]
          : prevState.vocab.myWords
        const myWordAddedAt = { ...(prevState.vocab.myWordAddedAt ?? {}) }
        if (addToMine && !alreadyMine) {
          myWordAddedAt[wordId] = Date.now()
        }
        const hiddenWordIds = (prevState.vocab.hiddenWordIds ?? []).filter((id) => id !== wordId)
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords,
            myWordAddedAt,
            hiddenWordIds,
            customWords: {
              ...prevState.vocab.customWords,
              [wordId]: word,
            },
          },
        }
      })
    },
    [setAppState],
  )

  const saveWordEdit = useCallback(
    (word: KanjiWord) => {
      if (!word?.id) return
      const wordId = word.id
      setAppState((prevState) => {
        if (!prevState) return prevState
        const hiddenWordIds = (prevState.vocab.hiddenWordIds ?? []).filter((id) => id !== wordId)
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            hiddenWordIds,
            customWords: {
              ...prevState.vocab.customWords,
              [wordId]: word,
            },
          },
        }
      })
    },
    [setAppState],
  )

  const hideWords = useCallback(
    (wordIds: string[]) => {
      const ids = [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const hide = new Set(ids)
        const customWords = { ...prevState.vocab.customWords }
        const myWordAddedAt = { ...(prevState.vocab.myWordAddedAt ?? {}) }
        for (const id of ids) {
          delete customWords[id]
          delete myWordAddedAt[id]
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: prevState.vocab.myWords.filter((id) => !hide.has(id)),
            myWordAddedAt,
            customWords,
            hiddenWordIds: [...new Set([...(prevState.vocab.hiddenWordIds ?? []), ...ids])],
            learnedWordIds: (prevState.vocab.learnedWordIds ?? []).filter((id) => !hide.has(id)),
            trainingSets: removeWordsFromAllTrainingSets(prevState.vocab.trainingSets ?? [], ids),
            problemWordIds: (prevState.vocab.problemWordIds ?? []).filter((id) => !hide.has(id)),
          },
        }
      })
    },
    [setAppState],
  )

  const addTrainingWords = useCallback(
    (wordIds: string[], setId?: string) => {
      const ids = [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        const targetId = resolveActiveTrainingSetId(
          setId ?? prevState.vocab.activeTrainingSetId,
          sets,
        )
        const nextSets = addWordsToTrainingSet(sets, targetId, ids)
        if (nextSets === sets) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingSets: nextSets,
          },
        }
      })
    },
    [setAppState],
  )

  const removeTrainingWords = useCallback(
    (wordIds: string[], setId?: string) => {
      const ids = wordIds.filter((id) => typeof id === 'string' && id.length > 0)
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        const targetId = resolveActiveTrainingSetId(
          setId ?? prevState.vocab.activeTrainingSetId,
          sets,
        )
        const nextSets = removeWordsFromTrainingSet(sets, targetId, ids)
        if (nextSets === sets) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingSets: nextSets,
          },
        }
      })
    },
    [setAppState],
  )

  const toggleTrainingWord = useCallback(
    (wordId: string, setId?: string) => {
      if (!wordId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        const targetId = resolveActiveTrainingSetId(
          setId ?? prevState.vocab.activeTrainingSetId,
          sets,
        )
        const list = getTrainingSetWordIds(sets, targetId)
        const nextSets = list.includes(wordId)
          ? removeWordsFromTrainingSet(sets, targetId, [wordId])
          : addWordsToTrainingSet(sets, targetId, [wordId])
        if (nextSets === sets) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingSets: nextSets,
          },
        }
      })
    },
    [setAppState],
  )

  const setActiveTrainingSet = useCallback(
    (setId: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        const nextId = resolveActiveTrainingSetId(setId, sets)
        if (nextId === prevState.vocab.activeTrainingSetId) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            activeTrainingSetId: nextId,
          },
        }
      })
    },
    [setAppState],
  )

  const createTrainingSet = useCallback(
    ({
      name,
      wordIds = [],
      makeActive = false,
      train = false,
    }: {
      name?: string
      wordIds?: string[]
      makeActive?: boolean
      train?: boolean
    } = {}): string | null => {
      const id = newTrainingSetId()
      let applied = false
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        if (sets.some((set) => set.id === id)) {
          applied = true
          return prevState
        }
        applied = true
        const now = Date.now()
        const setName = (name?.trim() || defaultNewSetName(sets)).slice(0, 48)
        const nextSet: VocabTrainingSet = {
          id,
          name: setName,
          wordIds: [...new Set(wordIds.filter((w) => typeof w === 'string' && w.length > 0))],
          createdAt: now,
          updatedAt: now,
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingSets: [...sets, nextSet],
            activeTrainingSetId: makeActive ? id : prevState.vocab.activeTrainingSetId,
            preferences: train
              ? { ...prevState.vocab.preferences, trainingSetId: id }
              : prevState.vocab.preferences,
          },
        }
      })
      return applied ? id : null
    },
    [setAppState],
  )

  const renameTrainingSet = useCallback(
    (setId: string, name: string) => {
      const nextName = name.trim().slice(0, 48)
      if (!setId || !nextName) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        if (!sets.some((set) => set.id === setId)) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingSets: sets.map((set) =>
              set.id === setId ? { ...set, name: nextName, updatedAt: Date.now() } : set,
            ),
          },
        }
      })
    },
    [setAppState],
  )

  const deleteTrainingSet = useCallback(
    (setId: string) => {
      if (!setId || setId === MAIN_TRAINING_SET_ID) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        if (!sets.some((set) => set.id === setId)) return prevState
        const nextSets = sets.filter((set) => set.id !== setId)
        const activeTrainingSetId =
          prevState.vocab.activeTrainingSetId === setId
            ? MAIN_TRAINING_SET_ID
            : prevState.vocab.activeTrainingSetId
        const trainingSetId =
          prevState.vocab.preferences.trainingSetId === setId
            ? MAIN_TRAINING_SET_ID
            : prevState.vocab.preferences.trainingSetId
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingSets: nextSets,
            activeTrainingSetId,
            preferences: { ...prevState.vocab.preferences, trainingSetId },
          },
        }
      })
    },
    [setAppState],
  )

  const moveTrainingWords = useCallback(
    ({
      fromSetId,
      toSetId,
      wordIds,
    }: {
      fromSetId: string
      toSetId: string
      wordIds: string[]
    }) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const sets = prevState.vocab.trainingSets ?? []
        const nextSets = moveWordsBetweenTrainingSets(sets, { fromSetId, toSetId, wordIds })
        if (nextSets === sets) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingSets: nextSets,
          },
        }
      })
    },
    [setAppState],
  )

  const addProblemWords = useCallback(
    (wordIds: string[]) => {
      const ids = [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const known = new Set(prevState.vocab.problemWordIds ?? [])
        const toAdd = ids.filter((id) => !known.has(id))
        if (!toAdd.length) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            problemWordIds: [...(prevState.vocab.problemWordIds ?? []), ...toAdd],
          },
        }
      })
    },
    [setAppState],
  )

  const removeProblemWords = useCallback(
    (wordIds: string[]) => {
      const ids = new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))
      if (!ids.size) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const next = (prevState.vocab.problemWordIds ?? []).filter((id) => !ids.has(id))
        if (next.length === (prevState.vocab.problemWordIds ?? []).length) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            problemWordIds: next,
          },
        }
      })
    },
    [setAppState],
  )

  const toggleProblemWord = useCallback(
    (wordId: string) => {
      if (!wordId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const list = prevState.vocab.problemWordIds ?? []
        const removing = list.includes(wordId)
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            problemWordIds: removing ? list.filter((id) => id !== wordId) : [...list, wordId],
          },
        }
      })
    },
    [setAppState],
  )

  const addSelectedKanji = useCallback(
    (characters: string[]) => {
      const chars = [...new Set(characters.map((ch) => ch.trim()).filter(Boolean))]
      if (!chars.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const known = new Set(prevState.vocab.preferences.selectedKanji ?? [])
        const toAdd = chars.filter((ch) => !known.has(ch))
        if (!toAdd.length) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            preferences: {
              ...prevState.vocab.preferences,
              selectedKanji: [...(prevState.vocab.preferences.selectedKanji ?? []), ...toAdd],
            },
          },
        }
      })
    },
    [setAppState],
  )

  const toggleLearnedWords = useCallback(
    (wordIds: string[]) => {
      const ids = [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const learned = new Set(prevState.vocab.learnedWordIds ?? [])
        const allLearned = ids.every((id) => learned.has(id))
        if (allLearned) {
          for (const id of ids) learned.delete(id)
        } else {
          for (const id of ids) learned.add(id)
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            learnedWordIds: [...learned],
          },
        }
      })
    },
    [setAppState],
  )

  const patchPreferences = useCallback(
    (patch: Partial<VocabPreferences>) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const nextPrefs = {
          ...prevState.vocab.preferences,
          ...patch,
        }
        if (nextPrefs.sessionMode === 'srs') {
          nextPrefs.source = 'mine'
        }
        // newPerDay (SRS quota) and newWordLimit (session set size) stay independent.
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            preferences: nextPrefs,
          },
        }
      })
    },
    [setAppState],
  )

  const updateStats = useCallback(
    (cardId: string, outcome: StatsOutcome, context: UpdateStatsContext) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const existing = prevState.vocab.stats[cardId] ?? createStatsRecord()
        const nextStats = updateCardStats(existing, outcome, context, DEFAULT_HYPERPARAMS)

        // Dual-write: keep mastery path, also touch presentation timestamp on seen.
        let memory = prevState.vocab.memory ?? {}
        if (outcome === 'seen') {
          const aspectKeys: ReviewAspect[] = [0, 1]
          const nextMemory = { ...memory }
          for (const aspect of aspectKeys) {
            const key = memoryKey(cardId, aspect)
            const prev =
              nextMemory[key] ??
              (existing.exposures || existing.clears || existing.errors
                ? migrateFromMastery(existing, context.now)
                : createNewMemoryState(context.now))
            nextMemory[key] = markPresented(prev, context.now)
          }
          memory = nextMemory
        }

        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            stats: {
              ...prevState.vocab.stats,
              [cardId]: nextStats,
            },
            memory,
          },
        }
      })
    },
    [setAppState],
  )

  const applyGradedReview = useCallback(
    (input: {
      cardId: string
      aspect: ReviewAspect
      grade: ReviewGrade
      now: number
      latencyMs: number
      drillMode: VocabPreferences['drillMode']
      answerLength: number
      hints?: PriorDifficultyHints
      distractor?: string
      /** Also update legacy mastery stats. */
      masteryOutcome?: StatsOutcome
      masteryContext?: UpdateStatsContext
      countAsNewIntro?: boolean
    }) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const key = memoryKey(input.cardId, input.aspect)
        const stats = prevState.vocab.stats[input.cardId] ?? createStatsRecord()
        const prevMem =
          prevState.vocab.memory?.[key] ??
          (stats.exposures || stats.clears || stats.errors
            ? migrateFromMastery(stats, input.now)
            : createNewMemoryState(input.now))

        const predictedR = retentionAt(prevMem, input.now)
        const elapsed = prevMem.lastAt ? hoursBetween(prevMem.lastAt, input.now) : 0
        const nextMem = applyReview(prevMem, input.grade, input.now, input.hints)
        const wasNew = prevMem.state === 'new'

        const latencyModel = updateLatencyModel(
          prevState.vocab.latencyModel,
          input.drillMode,
          input.latencyMs,
          input.answerLength,
          input.grade >= 3,
        )

        let statsMap = prevState.vocab.stats
        if (input.masteryOutcome && input.masteryContext) {
          statsMap = {
            ...statsMap,
            [input.cardId]: updateCardStats(
              stats,
              input.masteryOutcome,
              input.masteryContext,
              DEFAULT_HYPERPARAMS,
            ),
          }
        }

        const dayKey = getDayKey(input.now)
        let reviewDay = prevState.vocab.reviewDay ?? { dayKey, newIntroduced: 0 }
        if (reviewDay.dayKey !== dayKey) {
          reviewDay = { dayKey, newIntroduced: 0 }
        }
        if (input.countAsNewIntro && wasNew) {
          reviewDay = { ...reviewDay, newIntroduced: reviewDay.newIntroduced + 1 }
        }

        const modeCode = input.drillMode === 'romaji' ? 0 : input.drillMode === 'choice' ? 1 : 2
        void appendReviewEvent(
          encodeReviewEvent({
            t: input.now,
            c: input.cardId,
            a: input.aspect,
            g: input.grade,
            l: input.latencyMs,
            e: elapsed,
            r: predictedR,
            s: prevMem.s,
            d: prevMem.d,
            m: modeCode as 0 | 1 | 2,
            distractor: input.distractor,
          }),
        )

        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            stats: statsMap,
            memory: {
              ...(prevState.vocab.memory ?? {}),
              [key]: nextMem,
            },
            latencyModel,
            reviewDay,
          },
        }
      })
    },
    [setAppState],
  )

  const saveLiveSession = useCallback(
    (liveSession: CardTrainerLiveSession | null) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            liveSession,
          },
        }
      })
    },
    [setAppState],
  )

  const clearLiveSession = useCallback(() => {
    saveLiveSession(null)
  }, [saveLiveSession])

  const isMyWord = useCallback(
    (wordId: string | null | undefined) => {
      if (!wordId || !appState) return false
      return appState.vocab.myWords.includes(wordId)
    },
    [appState],
  )

  if (!appState) {
    return null
  }

  const trainingSets = appState.vocab.trainingSets ?? []
  const activeTrainingSetId = resolveActiveTrainingSetId(
    appState.vocab.activeTrainingSetId,
    trainingSets,
  )
  const activeTrainingSet = getTrainingSet(trainingSets, activeTrainingSetId)
  const trainSetId = resolveActiveTrainingSetId(
    appState.vocab.preferences.trainingSetId,
    trainingSets,
  )
  const trainingWordIds = getTrainingSetWordIds(trainingSets, activeTrainingSetId)
  const listTrainingWordIds = getTrainingSetWordIds(trainingSets, trainSetId)

  return {
    myWords: appState.vocab.myWords,
    customWords: appState.vocab.customWords,
    myWordAddedAt: appState.vocab.myWordAddedAt ?? {},
    hiddenWordIds: appState.vocab.hiddenWordIds ?? [],
    learnedWordIds: appState.vocab.learnedWordIds ?? [],
    trainingSets,
    activeTrainingSetId,
    activeTrainingSet,
    /** Words in the active set (where «+ В набор» writes). */
    trainingWordIds,
    /** Words in the set used for source === 'list' practice. */
    listTrainingWordIds,
    listTrainingSetId: trainSetId,
    problemWordIds: appState.vocab.problemWordIds ?? [],
    preferences: appState.vocab.preferences,
    stats: appState.vocab.stats,
    memory: appState.vocab.memory ?? {},
    latencyModel: appState.vocab.latencyModel as LatencyModel,
    reviewDay: appState.vocab.reviewDay,
    liveSession: appState.vocab.liveSession ?? null,
    toggleMyWord,
    addMyWords,
    removeMyWords,
    addCustomWord,
    saveWordEdit,
    hideWords,
    toggleLearnedWords,
    addTrainingWords,
    removeTrainingWords,
    toggleTrainingWord,
    setActiveTrainingSet,
    createTrainingSet,
    renameTrainingSet,
    deleteTrainingSet,
    moveTrainingWords,
    addProblemWords,
    removeProblemWords,
    toggleProblemWord,
    addSelectedKanji,
    patchPreferences,
    updateStats,
    applyGradedReview,
    isMyWord,
    saveLiveSession,
    clearLiveSession,
  }
}

export type ApplyGradedReview = NonNullable<ReturnType<typeof useVocabState>>['applyGradedReview']
export type { MemoryState }
