import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { AppState } from '../lib/types'
import { bootstrapAppState, saveAppState } from '../lib/storage'

export interface AppStateContextValue {
  appState: AppState | null
  setAppState: Dispatch<SetStateAction<AppState | null>>
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState | null>(null)
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    bootstrapAppState().then((state) => {
      if (cancelled) {
        return
      }
      setAppState(state)
      setStorageReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !appState) {
      return
    }
    const timer = window.setTimeout(() => {
      void saveAppState(appState).catch((error) => {
        console.warn('[storage] failed to save app state', error)
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [appState, storageReady])

  return (
    <AppStateContext.Provider value={{ appState, setAppState }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppStateContext(): AppStateContextValue {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('App state hooks must be used within AppStateProvider')
  }
  return context
}

export function useAppState(): AppState | null {
  return useAppStateContext().appState
}
