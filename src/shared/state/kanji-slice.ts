import { useCallback } from 'react'
import type { KanjiPreferences } from '../lib/types'
import { useAppStateContext } from './core'

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
