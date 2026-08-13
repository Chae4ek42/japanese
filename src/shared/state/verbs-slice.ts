import { useCallback } from 'react'
import { VERB_HYPERPARAMS, ensureVerbStats } from '../../data/verbs'
import type {
  CardTrainerLiveSession,
  StatsOutcome,
  UpdateStatsContext,
  VerbsPreferences,
} from '../lib/types'
import { updateCardStats } from '../lib/trainer'
import { useAppStateContext } from './core'

export function useVerbsState() {
  const { appState, setAppState } = useAppStateContext()

  const patchPreferences = useCallback(
    (patch: Partial<VerbsPreferences>) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          verbs: {
            ...prevState.verbs,
            preferences: {
              ...prevState.verbs.preferences,
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
          verbs: {
            ...prevState.verbs,
            stats: {
              ...prevState.verbs.stats,
              [cardId]: updateCardStats(
                ensureVerbStats(prevState.verbs.stats, cardId),
                outcome,
                context,
                VERB_HYPERPARAMS,
              ),
            },
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
          verbs: {
            ...prevState.verbs,
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

  if (!appState?.verbs) {
    return null
  }

  return {
    preferences: appState.verbs.preferences,
    stats: appState.verbs.stats,
    liveSession: appState.verbs.liveSession ?? null,
    patchPreferences,
    updateStats,
    saveLiveSession,
    clearLiveSession,
  }
}
