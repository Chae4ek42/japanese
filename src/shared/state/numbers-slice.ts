import { useCallback } from 'react'
import { NUMBER_HYPERPARAMS, ensureNumberStats } from '../../data/numbers'
import type {
  CardTrainerLiveSession,
  NumbersPreferences,
  StatsOutcome,
  UpdateStatsContext,
} from '../lib/types'
import { updateCardStats } from '../lib/trainer'
import { useAppStateContext } from './core'

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

  const saveLiveSession = useCallback(
    (liveSession: CardTrainerLiveSession | null) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          numbers: {
            ...prevState.numbers,
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
    preferences: appState.numbers.preferences,
    stats: appState.numbers.stats,
    liveSession: appState.numbers.liveSession ?? null,
    patchPreferences,
    updateStats,
    saveLiveSession,
    clearLiveSession,
  }
}
