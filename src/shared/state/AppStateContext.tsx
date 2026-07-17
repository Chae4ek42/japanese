import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { NUMBER_HYPERPARAMS, ensureNumberStats } from '../../data/numbers'
import type {
  AppState,
  KanaPreferences,
  KanjiPreferences,
  NumbersPreferences,
  PracticeHistory,
  StatsOutcome,
  UpdateStatsContext,
  VocabPreferences,
} from '../lib/types'
import { DEFAULT_HYPERPARAMS, createStatsRecord, updateCardStats } from '../lib/trainer'
import {
  bootstrapAppState,
  createDefaultAppState,
  resetStoredState,
  saveAppState,
} from '../lib/storage'

interface AppStateContextValue {
  appState: AppState | null
  setAppState: Dispatch<SetStateAction<AppState | null>>
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState | null>(null)
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    bootstrapAppState().then((state) => {
      if (cancelled) {
        return
      }
      setAppState(state)
      setStorageReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !appState) {
      return
    }
    saveAppState(appState)
  }, [appState, storageReady])

  return (
    <AppStateContext.Provider value={{ appState, setAppState }}>
      {children}
    </AppStateContext.Provider>
  )
}

function useAppStateContext(): AppStateContextValue {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('App state hooks must be used within AppStateProvider')
  }
  return context
}

export function useAppState(): AppState | null {
  return useAppStateContext().appState
}

export type KanaPracticeSlice = {
  preferences: KanaPreferences
  stats: AppState['kana']['stats']
  history: PracticeHistory
}

export type KanaPracticePatch = Partial<{
  preferences: KanaPreferences
  stats: AppState['kana']['stats']
  history: PracticeHistory
}>

export function useKanaState() {
  const { appState, setAppState } = useAppStateContext()

  const patchPreferences = useCallback(
    (patch: Partial<KanaPreferences>) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          kana: {
            ...prevState.kana,
            preferences: {
              ...prevState.kana.preferences,
              ...patch,
            },
          },
        }
      })
    },
    [setAppState],
  )

  const patchHyperparam = useCallback(
    (key: keyof KanaPreferences['hyperparams'], value: number) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          kana: {
            ...prevState.kana,
            preferences: {
              ...prevState.kana.preferences,
              hyperparams: {
                ...prevState.kana.preferences.hyperparams,
                [key]: value,
              },
            },
          },
        }
      })
    },
    [setAppState],
  )

  const updatePractice = useCallback(
    (recipe: (slice: KanaPracticeSlice) => KanaPracticePatch) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const slice: KanaPracticeSlice = {
          preferences: prevState.kana.preferences,
          stats: prevState.kana.stats,
          history: prevState.kana.history,
        }
        const patch = recipe(slice)
        return {
          ...prevState,
          kana: {
            ...prevState.kana,
            ...patch,
          },
        }
      })
    },
    [setAppState],
  )

  if (!appState) {
    return null
  }

  return {
    preferences: appState.kana.preferences,
    stats: appState.kana.stats,
    history: appState.kana.history,
    patchPreferences,
    patchHyperparam,
    updatePractice,
  }
}

export function useNumbersState() {
  const { appState, setAppState } = useAppStateContext()

  const patchPreferences = useCallback(
    (patch: Partial<NumbersPreferences>) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          numbers: {
            ...prevState.numbers,
            preferences: {
              ...prevState.numbers.preferences,
              ...patch,
            },
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
        return {
          ...prevState,
          numbers: {
            ...prevState.numbers,
            stats: {
              ...prevState.numbers.stats,
              [cardId]: updateCardStats(
                ensureNumberStats(prevState.numbers.stats, cardId),
                outcome,
                context,
                NUMBER_HYPERPARAMS,
              ),
            },
          },
        }
      })
    },
    [setAppState],
  )

  if (!appState) {
    return null
  }

  return {
    preferences: appState.numbers.preferences,
    stats: appState.numbers.stats,
    patchPreferences,
    updateStats,
  }
}

export function useKanjiState() {
  const { appState, setAppState } = useAppStateContext()

  const patchPreferences = useCallback(
    (patch: Partial<KanjiPreferences>) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          kanji: {
            ...prevState.kanji,
            preferences: {
              ...prevState.kanji.preferences,
              ...patch,
            },
          },
        }
      })
    },
    [setAppState],
  )

  const toggleLearned = useCallback(
    (character: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const learned = prevState.kanji.learned
        const nextLearned = learned.includes(character)
          ? learned.filter((item) => item !== character)
          : [...learned, character]
        return {
          ...prevState,
          kanji: {
            ...prevState.kanji,
            learned: nextLearned,
          },
        }
      })
    },
    [setAppState],
  )

  if (!appState) {
    return null
  }

  return {
    learned: appState.kanji.learned,
    preferences: appState.kanji.preferences,
    patchPreferences,
    toggleLearned,
  }
}

export function useVocabState() {
  const { appState, setAppState } = useAppStateContext()

  const toggleMyWord = useCallback(
    (wordId: string) => {
      if (!wordId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const myWords = prevState.vocab.myWords
        const nextWords = myWords.includes(wordId)
          ? myWords.filter((item) => item !== wordId)
          : [...myWords, wordId]
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: nextWords,
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
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            preferences: {
              ...prevState.vocab.preferences,
              ...patch,
            },
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
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            stats: {
              ...prevState.vocab.stats,
              [cardId]: updateCardStats(existing, outcome, context, DEFAULT_HYPERPARAMS),
            },
          },
        }
      })
    },
    [setAppState],
  )

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

  return {
    myWords: appState.vocab.myWords,
    preferences: appState.vocab.preferences,
    stats: appState.vocab.stats,
    toggleMyWord,
    patchPreferences,
    updateStats,
    isMyWord,
  }
}

export function useResetApp() {
  const { setAppState } = useAppStateContext()

  return useCallback(async () => {
    await resetStoredState()
    setAppState(createDefaultAppState())
  }, [setAppState])
}
