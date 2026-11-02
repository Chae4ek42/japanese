import type { AppPage, AppState, StatsRecord } from './types'

export type StudyMinutes = 5 | 10 | 20
export type StudyStepKind = 'practice' | 'theory' | 'contexts' | 'reader'
export interface StudyPlanStep {
  id: string
  kind: StudyStepKind
  page: AppPage
  title: string
  reason: string
  targetIds: string[]
  goal: number
  baseline: number
  status: 'pending' | 'done' | 'skipped'
  completion?: 'explicit' | 'measured'
}
export interface StudyPlan {
  version: 1
  createdAt: number
  minutes: StudyMinutes
  steps: StudyPlanStep[]
}

const PRACTICE_PAGES = ['train', 'kana', 'numbers', 'particles', 'verbs'] as const
const finiteCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/** Reject broken plans rather than turning untrusted backup values into navigation. */
export function sanitizeStudyPlan(raw: unknown): StudyPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (value.version !== 1 || !finiteCount(value.createdAt)
    || ![5, 10, 20].includes(value.minutes as number)
    || !Array.isArray(value.steps) || !value.steps.length || value.steps.length > 6) return null
  const ids = new Set<string>()
  const steps: StudyPlanStep[] = []
  for (const rawStep of value.steps) {
    if (!rawStep || typeof rawStep !== 'object') return null
    const step = rawStep as Record<string, unknown>
    if (typeof step.id !== 'string' || !step.id || ids.has(step.id)
      || typeof step.title !== 'string' || !step.title || step.title.length > 300
      || typeof step.reason !== 'string' || step.reason.length > 1000
      || !Array.isArray(step.targetIds) || step.targetIds.length > 100
      || step.targetIds.some((id) => typeof id !== 'string' || !id || id.length > 300)
      || !finiteCount(step.goal) || step.goal < 1 || step.goal > 1000
      || !finiteCount(step.baseline)
      || !['pending', 'done', 'skipped'].includes(step.status as string)) return null
    const validRoute = step.kind === 'practice'
      ? PRACTICE_PAGES.includes(step.page as typeof PRACTICE_PAGES[number])
      : (step.kind === 'theory' && step.page === 'theory' && step.targetIds.length === 1)
        || (step.kind === 'contexts' && step.page === 'contexts')
        || (step.kind === 'reader' && step.page === 'reader')
    if (!validRoute || (step.status === 'done' && !['explicit', 'measured'].includes(step.completion as string))) return null
    ids.add(step.id)
    steps.push({
      id: step.id, kind: step.kind as StudyStepKind, page: step.page as AppPage,
      title: step.title, reason: step.reason, targetIds: [...step.targetIds] as string[],
      goal: Math.floor(step.goal), baseline: step.baseline, status: step.status as StudyPlanStep['status'],
      ...(step.status === 'done' ? { completion: step.completion as 'explicit' | 'measured' } : {}),
    })
  }
  return { version: 1, createdAt: value.createdAt, minutes: value.minutes as StudyMinutes, steps }
}

function statsForPage(state: AppState, page: AppPage): Record<string, StatsRecord> {
  if (page === 'train') return state.vocab.stats
  if (page === 'kana' || page === 'numbers' || page === 'particles' || page === 'verbs') return state[page].stats
  return {}
}

/** Counters measure recorded work, never page visits or card presentations. */
export function studyStepEvidence(step: StudyPlanStep, state: AppState): number {
  if (step.kind === 'theory') return state.theory.lessons[step.targetIds[0]]?.checkAttempts ?? 0
  if (step.kind === 'reader') return state.contexts.examples.filter((example) => example.sourceKind === 'reader').length
  if (step.kind === 'contexts') {
    return step.targetIds.reduce((sum, id) => sum + (state.contexts.stats[id]?.attempts ?? 0), 0)
  }
  const stats = statsForPage(state, step.page)
  const records = step.targetIds.length ? step.targetIds.map((id) => stats[id]) : Object.values(stats)
  return records.reduce((sum, record) => sum + (record?.clears ?? 0) + (record?.errors ?? 0), 0)
}

export function studyStepProgress(step: StudyPlanStep, state: AppState): number {
  return Math.min(step.goal, Math.max(0, studyStepEvidence(step, state) - step.baseline))
}

export function reconcileStudyPlan(plan: StudyPlan, state: AppState): StudyPlan {
  let changed = false
  const steps = plan.steps.map((step): StudyPlanStep => {
    if (step.status !== 'pending' || studyStepProgress(step, state) < step.goal) return step
    changed = true
    return { ...step, status: 'done', completion: 'measured' }
  })
  return changed ? { ...plan, steps } : plan
}
