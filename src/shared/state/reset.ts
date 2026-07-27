import { useCallback } from 'react'
import { createDefaultAppState } from './app-state'
import { resetStoredState } from '../lib/storage'
import { useAppStateContext } from './core'

export function useResetApp() {
  const { setAppState } = useAppStateContext()

  return useCallback(async () => {
    await resetStoredState()
    setAppState(createDefaultAppState())
  }, [setAppState])
}
