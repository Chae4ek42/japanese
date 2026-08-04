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
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: [...prevState.vocab.myWords, ...toAdd],
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
        for (const id of ids) {
          if (id.startsWith('custom:')) delete customWords[id]
        }
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: nextWords,
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
        const myWords = addToMine
          ? prevState.vocab.myWords.includes(wordId)
            ? prevState.vocab.myWords
            : [...prevState.vocab.myWords, wordId]
          : prevState.vocab.myWords
        const hiddenWordIds = (prevState.vocab.hiddenWordIds ?? []).filter((id) => id !== wordId)
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords,
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

  /** Save field edits for a bank or custom word without forcing «Мои слова». */
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

  /** Permanently hide words from vocab pools (and drop custom overrides). */
  const hideWords = useCallback(
    (wordIds: string[]) => {
      const ids = [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const hide = new Set(ids)
        const customWords = { ...prevState.vocab.customWords }
        for (const id of ids) delete customWords[id]
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            myWords: prevState.vocab.myWords.filter((id) => !hide.has(id)),
            customWords,
            hiddenWordIds: [...new Set([...(prevState.vocab.hiddenWordIds ?? []), ...ids])],
            learnedWordIds: (prevState.vocab.learnedWordIds ?? []).filter((id) => !hide.has(id)),
            trainingWordIds: (prevState.vocab.trainingWordIds ?? []).filter((id) => !hide.has(id)),
          },
        }
      })
    },
    [setAppState],
  )

  const addTrainingWords = useCallback(
    (wordIds: string[]) => {
      const ids = [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const known = new Set(prevState.vocab.trainingWordIds ?? [])
        const toAdd = ids.filter((id) => !known.has(id))
        if (!toAdd.length) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingWordIds: [...(prevState.vocab.trainingWordIds ?? []), ...toAdd],
          },
        }
      })
    },
    [setAppState],
  )

  const removeTrainingWords = useCallback(
    (wordIds: string[]) => {
      const ids = new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))
      if (!ids.size) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const next = (prevState.vocab.trainingWordIds ?? []).filter((id) => !ids.has(id))
        if (next.length === (prevState.vocab.trainingWordIds ?? []).length) return prevState
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingWordIds: next,
          },
        }
      })
    },
    [setAppState],
  )

  const toggleTrainingWord = useCallback(
    (wordId: string) => {
      if (!wordId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const list = prevState.vocab.trainingWordIds ?? []
        const removing = list.includes(wordId)
        return {
          ...prevState,
          vocab: {
            ...prevState.vocab,
            trainingWordIds: removing ? list.filter((id) => id !== wordId) : [...list, wordId],
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
    hiddenWordIds: appState.vocab.hiddenWordIds ?? [],
    learnedWordIds: appState.vocab.learnedWordIds ?? [],
    trainingWordIds: appState.vocab.trainingWordIds ?? [],
    preferences: appState.vocab.preferences,
    stats: appState.vocab.stats,
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
    addSelectedKanji,
    patchPreferences,
    updateStats,
    isMyWord,
  }
}
