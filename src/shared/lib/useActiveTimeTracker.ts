import { useEffect, useRef } from 'react'
import type { AnalyticsSection, AppPage } from './types'
import {
  ACTIVE_TICK_MS,
  createActiveTimeEngine,
  noteInput,
  pauseActive,
  setSection,
  takePendingFlush,
  tickActive,
  type ActiveTimeEngineState,
} from './active-time'
import { sectionFromAppPage } from '../state/slices/analytics'

const INPUT_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
]

export function useActiveTimeTracker({
  page,
  enabled,
  onFlush,
}: {
  page: AppPage
  enabled: boolean
  onFlush: (deltas: Array<{ section: AnalyticsSection; deltaMs: number }>) => void
}) {
  const engineRef = useRef<ActiveTimeEngineState>(createActiveTimeEngine(sectionFromAppPage(page)))
  const onFlushRef = useRef(onFlush)
  onFlushRef.current = onFlush
  const pageRef = useRef(page)
  pageRef.current = page

  useEffect(() => {
    if (!enabled) return

    const flush = (force: boolean) => {
      const result = takePendingFlush(engineRef.current, { force })
      engineRef.current = result.state
      if (result.deltas.length) onFlushRef.current(result.deltas)
    }

    const onInput = () => {
      engineRef.current = noteInput(engineRef.current, Date.now())
    }

    const onVisibility = () => {
      if (document.hidden) {
        engineRef.current = pauseActive(engineRef.current, Date.now())
        flush(true)
      }
    }

    const onPageHide = () => {
      engineRef.current = pauseActive(engineRef.current, Date.now())
      flush(true)
    }

    for (const eventName of INPUT_EVENTS) {
      window.addEventListener(eventName, onInput, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    const intervalId = window.setInterval(() => {
      engineRef.current = tickActive(engineRef.current, Date.now())
      flush(false)
    }, ACTIVE_TICK_MS)

    return () => {
      engineRef.current = pauseActive(engineRef.current, Date.now())
      flush(true)
      for (const eventName of INPUT_EVENTS) {
        window.removeEventListener(eventName, onInput)
      }
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.clearInterval(intervalId)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const section = sectionFromAppPage(page)
    const now = Date.now()
    engineRef.current = setSection(engineRef.current, section, now)
    const result = takePendingFlush(engineRef.current, { force: true })
    engineRef.current = result.state
    if (result.deltas.length) onFlushRef.current(result.deltas)
  }, [page, enabled])
}
