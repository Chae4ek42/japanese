import { useCallback } from 'react'
import type { WordContext } from '../lib/types'
import { useAppStateContext } from './core'
import { DEFAULT_CONTEXT_STATE, sanitizeContextState } from './slices/contexts'

export type NewWordContext = Omit<WordContext, 'id' | 'createdAt'>

export function useContextsState() {
  const { appState, setAppState } = useAppStateContext()
  const addExamples = useCallback((items: NewWordContext[]) => {
    setAppState((prev) => {
      if (!prev) return prev
      const contexts = prev.contexts ?? DEFAULT_CONTEXT_STATE
      const examples = [...contexts.examples]
      for (const item of items) {
        if (examples.some((example) => example.wordId === item.wordId && example.sentence === item.sentence && example.surface === item.surface)) continue
        examples.push({ ...item, id: crypto.randomUUID(), createdAt: Date.now() })
      }
      return { ...prev, contexts: sanitizeContextState({ ...contexts, examples }) }
    })
  }, [setAppState])
  const removeExample = useCallback((id: string) => {
    setAppState((prev) => prev ? { ...prev, contexts: sanitizeContextState({ ...prev.contexts, examples: prev.contexts.examples.filter((item) => item.id !== id) }) } : prev)
  }, [setAppState])
  const recordAttempt = useCallback((id: string, correct: boolean) => {
    setAppState((prev) => {
      if (!prev || !prev.contexts.examples.some((item) => item.id === id)) return prev
      const old = prev.contexts.stats[id] ?? { attempts: 0, correct: 0, lastAt: 0 }
      return { ...prev, contexts: { ...prev.contexts, stats: { ...prev.contexts.stats, [id]: { attempts: old.attempts + 1, correct: old.correct + Number(correct), lastAt: Date.now() } } } }
    })
  }, [setAppState])
  if (!appState) return null
  return { ...(appState.contexts ?? DEFAULT_CONTEXT_STATE), addExamples, removeExample, recordAttempt }
}
