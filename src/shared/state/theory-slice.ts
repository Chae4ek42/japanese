import { useCallback } from 'react'
import { useAppStateContext } from './core'
import { emptyTheoryLesson } from './slices/theory'

export function useTheoryState() {
  const { appState, setAppState } = useAppStateContext()
  const markTheoryRead = useCallback((unitId: string) => {
    setAppState((prev) => {
      if (!prev) return prev
      const lesson = prev.theory.lessons[unitId] ?? emptyTheoryLesson()
      return { ...prev, theory: { lessons: { ...prev.theory.lessons, [unitId]: { ...lesson, readAt: Date.now() } } } }
    })
  }, [setAppState])
  const recordTheoryCheck = useCallback((unitId: string, score: number, questionCount: number) => {
    setAppState((prev) => {
      if (!prev || questionCount < 1) return prev
      const lesson = prev.theory.lessons[unitId] ?? emptyTheoryLesson()
      return { ...prev, theory: { lessons: { ...prev.theory.lessons, [unitId]: {
        ...lesson, checkAttempts: lesson.checkAttempts + 1, lastCheckAt: Date.now(),
        lastScore: Math.max(0, Math.min(questionCount, score)), questionCount,
      } } } }
    })
  }, [setAppState])
  return appState ? { ...appState.theory, markTheoryRead, recordTheoryCheck } : null
}
