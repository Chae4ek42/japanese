import { useCallback } from 'react'
import type {
  ContextPreferences,
  ContextSentence,
  ContextSession,
  ContextTrainingLogEntry,
} from '../lib/types'
import { useAppStateContext } from './core'

const MAX_TRAINING_LOG = 30

export function useContextState() {
  const { appState, setAppState } = useAppStateContext()

  const patchPreferences = useCallback(
    (patch: Partial<ContextPreferences>) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          context: {
            ...prevState.context,
            preferences: {
              ...prevState.context.preferences,
              ...patch,
            },
          },
        }
      })
    },
    [setAppState],
  )

  const markWordKnown = useCallback(
    (wordId: string) => {
      if (!wordId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        if (prevState.context.knownWordIds.includes(wordId)) return prevState
        return {
          ...prevState,
          context: {
            ...prevState.context,
            knownWordIds: [...prevState.context.knownWordIds, wordId],
          },
        }
      })
    },
    [setAppState],
  )

  const markWordsKnown = useCallback(
    (wordIds: string[]) => {
      const ids = [...new Set(wordIds.filter(Boolean))]
      if (!ids.length) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const known = new Set(prevState.context.knownWordIds)
        const toAdd = ids.filter((id) => !known.has(id))
        if (!toAdd.length) return prevState
        return {
          ...prevState,
          context: {
            ...prevState.context,
            knownWordIds: [...prevState.context.knownWordIds, ...toAdd],
          },
        }
      })
    },
    [setAppState],
  )

  const unmarkWordKnown = useCallback(
    (wordId: string) => {
      if (!wordId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          context: {
            ...prevState.context,
            knownWordIds: prevState.context.knownWordIds.filter((id) => id !== wordId),
          },
        }
      })
    },
    [setAppState],
  )

  const toggleGrammar = useCallback(
    (grammarId: string) => {
      if (!grammarId) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const known = prevState.context.knownGrammarIds
        const next = known.includes(grammarId)
          ? known.filter((id) => id !== grammarId)
          : [...known, grammarId]
        return {
          ...prevState,
          context: {
            ...prevState.context,
            knownGrammarIds: next,
          },
        }
      })
    },
    [setAppState],
  )

  const cacheGenerated = useCallback(
    (wordId: string, sentence: ContextSentence) => {
      if (!wordId || !sentence) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const prevList = prevState.context.generatedCache[wordId] ?? []
        const withoutDup = prevList.filter((item) => item.id !== sentence.id)
        return {
          ...prevState,
          context: {
            ...prevState.context,
            generatedCache: {
              ...prevState.context.generatedCache,
              [wordId]: [...withoutDup, sentence].slice(-12),
            },
          },
        }
      })
    },
    [setAppState],
  )

  const saveSession = useCallback(
    (session: ContextSession | null) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          context: {
            ...prevState.context,
            session,
          },
        }
      })
    },
    [setAppState],
  )

  const clearSession = useCallback(() => {
    setAppState((prevState) => {
      if (!prevState) return prevState
      if (!prevState.context.session) return prevState
      return {
        ...prevState,
        context: {
          ...prevState.context,
          session: null,
        },
      }
    })
  }, [setAppState])

  const upsertTrainingLog = useCallback((entry: ContextTrainingLogEntry) => {
    setAppState((prevState) => {
      if (!prevState) return prevState
      const without = prevState.context.trainingLog.filter((item) => item.id !== entry.id)
      return {
        ...prevState,
        context: {
          ...prevState.context,
          trainingLog: [...without, entry].slice(-MAX_TRAINING_LOG),
        },
      }
    })
  }, [setAppState])

  if (!appState) {
    return null
  }

  return {
    context: appState.context,
    patchPreferences,
    markWordKnown,
    markWordsKnown,
    unmarkWordKnown,
    toggleGrammar,
    cacheGenerated,
    saveSession,
    clearSession,
    upsertTrainingLog,
  }
}
