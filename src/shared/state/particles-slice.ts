import { useCallback } from 'react'
import { PARTICLE_HYPERPARAMS, ensureParticleStats } from '../../data/particles'
import type { ParticlesPreferences, StatsOutcome, UpdateStatsContext } from '../lib/types'
import { updateCardStats } from '../lib/trainer'
import { useAppStateContext } from './core'

export function useParticlesState() {
  const { appState, setAppState } = useAppStateContext()

  const patchPreferences = useCallback(
    (patch: Partial<ParticlesPreferences>) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        return {
          ...prevState,
          particles: {
            ...prevState.particles,
            preferences: {
              ...prevState.particles.preferences,
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
          particles: {
            ...prevState.particles,
            stats: {
              ...prevState.particles.stats,
              [cardId]: updateCardStats(
                ensureParticleStats(prevState.particles.stats, cardId),
                outcome,
                context,
                PARTICLE_HYPERPARAMS,
              ),
            },
          },
        }
      })
    },
    [setAppState],
  )

  if (!appState?.particles) {
    return null
  }

  return {
    preferences: appState.particles.preferences,
    stats: appState.particles.stats,
    patchPreferences,
    updateStats,
  }
}
