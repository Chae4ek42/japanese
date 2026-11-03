import { useCallback } from 'react'
import type { CardTrainerLiveSession, VocabPreferences } from '../lib/types'
import { createVocabTrainingSession, updateVocabTrainingSession } from '../../features/vocab/trainingSessions'
import { DEFAULT_VOCAB_PREFERENCES, sanitizeVocabPreferences } from './slices/vocab'
import { useAppStateContext } from './core'

export function useVocabSessions() {
  const { appState, setAppState } = useAppStateContext()

  const createSession = useCallback((preferences = DEFAULT_VOCAB_PREFERENCES, name?: string) => {
    const id = `vocab_${crypto.randomUUID()}`
    const now = Date.now()
    setAppState((state) => {
      if (!state) return state
      const session = createVocabTrainingSession(id, sanitizeVocabPreferences(preferences, DEFAULT_VOCAB_PREFERENCES),
        name ?? `Тренировка ${state.vocab.trainingSessions.length + 1}`, now)
      return { ...state, vocab: { ...state.vocab,
        trainingSessions: [...state.vocab.trainingSessions, session], activeSessionId: id } }
    })
    return id
  }, [setAppState])

  const selectSession = useCallback((id: string | null) => {
    setAppState((state) => !state ? state : {
      ...state, vocab: { ...state.vocab, activeSessionId: id },
    })
  }, [setAppState])

  const renameSession = useCallback((id: string, name: string) => {
    const trimmed = name.trim().slice(0, 64)
    if (!trimmed) return
    setAppState((state) => !state ? state : { ...state, vocab: { ...state.vocab,
      trainingSessions: updateVocabTrainingSession(state.vocab.trainingSessions, id, { name: trimmed }),
    } })
  }, [setAppState])

  const deleteSession = useCallback((id: string) => {
    setAppState((state) => !state ? state : { ...state, vocab: { ...state.vocab,
      trainingSessions: state.vocab.trainingSessions.filter((session) => session.id !== id),
      activeSessionId: state.vocab.activeSessionId === id ? null : state.vocab.activeSessionId,
    } })
  }, [setAppState])

  const saveSessionLive = useCallback((id: string, liveSession: CardTrainerLiveSession | null) => {
    setAppState((state) => {
      if (!state) return state
      const sessions = updateVocabTrainingSession(state.vocab.trainingSessions, id, { liveSession })
      return sessions === state.vocab.trainingSessions ? state : {
        ...state, vocab: { ...state.vocab, trainingSessions: sessions },
      }
    })
  }, [setAppState])

  const patchSessionPreferences = useCallback((id: string, patch: Partial<VocabPreferences>) => {
    setAppState((state) => {
      if (!state) return state
      const session = state.vocab.trainingSessions.find((entry) => entry.id === id)
      if (!session) return state
      const preferences = sanitizeVocabPreferences({ ...session.preferences, ...patch }, session.preferences)
      return { ...state, vocab: { ...state.vocab,
        trainingSessions: updateVocabTrainingSession(state.vocab.trainingSessions, id, { preferences }),
      } }
    })
  }, [setAppState])

  return { sessions: appState?.vocab.trainingSessions ?? [], createSession, selectSession,
    renameSession, deleteSession, saveSessionLive, patchSessionPreferences }
}
