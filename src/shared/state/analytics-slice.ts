import { useCallback } from 'react'
import type { AnalyticsSection } from '../lib/types'
import { useAppStateContext } from './core'
import { applyActiveTimeDelta, bumpAnalyticsAnswers } from './slices/analytics'

export function useAnalyticsState() {
  const { appState, setAppState } = useAppStateContext()
  const analytics = appState?.analytics ?? null

  const applyActiveDeltas = useCallback(
    (deltas: Array<{ section: AnalyticsSection; deltaMs: number }>, now = Date.now()) => {
      if (!deltas.length) return
      setAppState((prev) => {
        if (!prev) return prev
        let nextAnalytics = prev.analytics
        for (const delta of deltas) {
          nextAnalytics = applyActiveTimeDelta(nextAnalytics, {
            section: delta.section,
            deltaMs: delta.deltaMs,
            now,
          })
        }
        return { ...prev, analytics: nextAnalytics }
      })
    },
    [setAppState],
  )

  const recordAnswer = useCallback(
    (clean: boolean, now = Date.now()) => {
      setAppState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          analytics: bumpAnalyticsAnswers(prev.analytics, { clean, now }),
        }
      })
    },
    [setAppState],
  )

  return {
    analytics,
    applyActiveDeltas,
    recordAnswer,
  }
}
