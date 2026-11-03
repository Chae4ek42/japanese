import type { AppPage, AppState, StatsRecord } from './types'
import { THEORY_UNITS } from '../../features/theory/units'

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

const PRACTICE_PAGES = ['train', 'kana', 'numbers'] as const
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

/** Alternatives are built from the learner's current evidence, with a fresh baseline. */
export function studyPlanOptions(state: AppState, minutes: StudyMinutes): StudyPlanStep[] {
  const answerGoal = minutes === 5 ? 5 : minutes === 10 ? 10 : 20
  const options: StudyPlanStep[] = []
  function add(step: Omit<StudyPlanStep, 'baseline' | 'status'>) {
    const next = { ...step, baseline: 0, status: 'pending' as const }
    next.baseline = studyStepEvidence(next, state)
    options.push(next)
  }
  const visible = state.vocab.myWords.filter((id) => !state.vocab.hiddenWordIds.includes(id))
  const weak = visible.filter((id) => {
    const stats = state.vocab.stats[id]
    return stats && (stats.errors > 0 || stats.hints > 0)
      && (!stats.wordPractice || stats.wordPractice.strength < 0.8)
  }).sort((a, b) => (state.vocab.stats[b]?.lastErrorAt ?? 0) - (state.vocab.stats[a]?.lastErrorAt ?? 0))
  if (visible.length) add({
    id: 'words', kind: 'practice', page: 'train', title: `${answerGoal} ответов · слова`,
    reason: weak.length ? `${weak.length} слов с ошибками или подсказками: начните с них.` : 'Закрепите слова из вашей коллекции.',
    targetIds: (weak.length ? weak : visible).slice(0, 20), goal: answerGoal,
  })
  const kanaIds = Object.entries(state.kana.stats)
    .filter(([, stats]) => stats.clears > 0 || stats.errors > 0 || stats.hints > 0)
    .sort(([, a], [, b]) => b.errors - a.errors).slice(0, 10).map(([id]) => id)
  add({ id: 'kana', kind: 'practice', page: 'kana', title: `${answerGoal} ответов · кана`,
    reason: kanaIds.length ? 'Повторите знакомые знаки, начиная с тех, где было больше ошибок.' : 'Начните с чтения каны: выберите знакомую строку в тренажёре.',
    targetIds: kanaIds, goal: answerGoal })
  const unit = THEORY_UNITS.find((item) => {
    const progress = state.theory.lessons[item.id]
    return progress?.checkAttempts && progress.lastScore < progress.questionCount
  }) ?? THEORY_UNITS.find((item) => !state.theory.lessons[item.id]?.checkAttempts) ?? THEORY_UNITS[0]
  if (unit) {
    const previous = state.theory.lessons[unit.id]
    add({ id: 'theory', kind: 'theory', page: 'theory', title: unit.title,
      reason: previous?.checkAttempts && previous.lastScore < previous.questionCount
        ? 'В последней проверке были ошибки. Прочитайте правило и снова проверьте себя.'
        : previous?.readAt ? 'Урок уже прочитан. Закрепите его короткой проверкой.' : 'Следующий урок без завершённой проверки: прочитайте и проверьте себя.',
      targetIds: [unit.id], goal: 1 })
  }
  const examples = state.contexts.examples.map((example) => example.id)
  if (examples.length) add({ id: 'contexts', kind: 'contexts', page: 'contexts',
    title: `${minutes === 20 ? 6 : 3} ответа · контексты`,
    reason: 'Проверьте узнавание слов в сохранённых предложениях.',
    targetIds: examples.slice(0, 100), goal: minutes === 20 ? 6 : 3 })
  add({ id: 'reader', kind: 'reader', page: 'reader', title: 'Прочитать фразу и сохранить пример',
    reason: 'Откройте свой текст и сохраните одно предложение со словом в контексты.', targetIds: [], goal: 1 })
  return options
}

export function buildStudyPlan(state: AppState, minutes: StudyMinutes, now = Date.now()): StudyPlan {
  const options = studyPlanOptions(state, minutes)
  const first = options.find((step) => step.id === 'words') ?? options.find((step) => step.id === 'kana')!
  const theory = options.find((step) => step.kind === 'theory')
  const context = options.find((step) => step.kind === 'contexts') ?? options.find((step) => step.kind === 'reader')!
  return { version: 1, createdAt: now, minutes,
    steps: [first, ...(theory ? [theory] : []), ...(minutes > 5 ? [context] : [])] }
}
