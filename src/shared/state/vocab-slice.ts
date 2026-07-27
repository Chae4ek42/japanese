import { useCallback } from 'react'
import type { KanjiWord, StatsOutcome, UpdateStatsContext, VocabPreferences } from '../lib/types'
import { DEFAULT_HYPERPARAMS, createStatsRecord, updateCardStats } from '../lib/trainer'
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
        if (removing && wordId.startsWith('custom:')) {
          delete customWords[wordId]
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: nextWords,
            customWords,
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
        const myWords = prevState.vocab.myWords.includes(wordId)
          ? prevState.vocab.myWords
          : [...prevState.vocab.myWords, wordId]
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords,
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
    customWords: appState.vocab.customWords,
    preferences: appState.vocab.preferences,
    stats: appState.vocab.stats,
    toggleMyWord,
    addCustomWord,
    patchPreferences,
    updateStats,
    isMyWord,
  }
}
