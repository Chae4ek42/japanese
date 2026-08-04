import { useCallback } from 'react'
import type { CardTrainerLiveSession, KanaPreferences, PracticeHistory } from '../lib/types'
import type { AppState } from '../lib/types'
import { useAppStateContext } from './core'

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

  const saveLiveSession = useCallback(
    (liveSession: CardTrainerLiveSession | null) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          kana: {
            ...prevState.kana,
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

  if (!appState) {
    return null
  }

  return {
    preferences: appState.kana.preferences,
    stats: appState.kana.stats,
    history: appState.kana.history,
    liveSession: appState.kana.liveSession ?? null,
    patchPreferences,
    patchHyperparam,
    updatePractice,
    saveLiveSession,
    clearLiveSession,
  }
}
