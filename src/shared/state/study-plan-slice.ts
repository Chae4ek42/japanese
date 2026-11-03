import { useCallback, useEffect } from 'react'
import { useAppStateContext } from './core'
import { buildStudyPlan, reconcileStudyPlan, studyPlanOptions, type StudyMinutes } from '../lib/studyPlan'

export function useStudyPlan() {
  const { appState, setAppState } = useAppStateContext()
  const stored = appState?.studyPlan ?? null
  const plan = stored && appState ? reconcileStudyPlan(stored, appState) : null
  useEffect(() => {
    if (!stored || plan === stored) return
    setAppState((previous) => {
      if (!previous?.studyPlan) return previous
      const next = reconcileStudyPlan(previous.studyPlan, previous)
      return next === previous.studyPlan ? previous : { ...previous, studyPlan: next }
    })
  }, [stored, plan, setAppState])
  const start = useCallback((minutes: StudyMinutes) => {
    setAppState((previous) => previous ? { ...previous, studyPlan: buildStudyPlan(previous, minutes) } : previous)
  }, [setAppState])
  const finish = useCallback((id: string, skip = false) => {
    setAppState((previous) => !previous?.studyPlan ? previous : { ...previous, studyPlan: {
      ...previous.studyPlan, steps: previous.studyPlan.steps.map((step) => step.id !== id || step.status !== 'pending' ? step
        : { ...step, status: skip ? 'skipped' : 'done', completion: skip ? undefined : 'explicit' }),
    } })
  }, [setAppState])
  const replace = useCallback((id: string, alternativeId: string) => {
    setAppState((previous) => {
      if (!previous?.studyPlan) return previous
      const option = studyPlanOptions(previous, previous.studyPlan.minutes).find((step) => step.id === alternativeId)
      if (!option || previous.studyPlan.steps.some((step) => step.id === alternativeId && step.id !== id)) return previous
      return { ...previous, studyPlan: { ...previous.studyPlan,
        steps: previous.studyPlan.steps.map((step) => step.id === id && step.status === 'pending' ? option : step),
      } }
    })
  }, [setAppState])
  return { appState, plan, start, finish, replace }
}
