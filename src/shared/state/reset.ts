import { useCallback } from 'react'
import { createDefaultAppState } from './app-state'
import { saveAppState } from '../lib/storage'
import { useAppStateContext } from './core'

export function useResetApp() {
  const { setAppState, activeAccountId } = useAppStateContext()

  return useCallback(async () => {
    if (!activeAccountId) return
    const next = createDefaultAppState()
    await saveAppState(next, activeAccountId)
    setAppState(next)
  }, [activeAccountId, setAppState])
}
