import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildStudyPlan, reconcileStudyPlan, sanitizeStudyPlan, studyPlanOptions, studyStepProgress } from '../../src/shared/lib/studyPlan.ts'
import { createDefaultAppState, normalizeAppState } from '../../src/shared/state/app-state.ts'
import { createStatsRecord } from '../../src/shared/lib/trainer.ts'

describe('short study plan', () => {
  it('offers a usable fresh start and scales approximate workload without hidden trainers', () => {
    const state = createDefaultAppState()
    const short = buildStudyPlan(state, 5, 100)
    const long = buildStudyPlan(state, 20, 100)
    assert.deepEqual(short.steps.map((step) => step.kind), ['practice', 'theory'])
    assert.equal(short.steps[0].page, 'kana')
    assert.equal(short.steps[0].goal, 5)
    assert.equal(long.steps[0].goal, 20)
    assert.equal(long.steps[2].kind, 'reader')
    assert.ok(studyPlanOptions(state, 20).every((step) => step.page !== 'particles' && step.page !== 'verbs'))
  })

  it('selects actual weak words, excludes hidden words, and ignores historical/presentation evidence', () => {
    const state = createDefaultAppState()
    state.vocab.myWords = ['known', 'weak', 'hidden']
    state.vocab.hiddenWordIds = ['hidden']
    state.vocab.stats.weak = { ...createStatsRecord(), errors: 4, clears: 8, lastErrorAt: 500 }
    const plan = buildStudyPlan(state, 5, 1000)
    const first = plan.steps[0]
    assert.deepEqual(first.targetIds, ['weak'])
    assert.equal(first.baseline, 12)
    assert.equal(studyStepProgress(first, state), 0)
    assert.equal(reconcileStudyPlan(plan, state), plan)
    state.vocab.stats.weak.exposures += 10
    assert.equal(reconcileStudyPlan(plan, state), plan)
    state.vocab.stats.known = { ...createStatsRecord(), clears: 10 }
    assert.equal(studyStepProgress(first, state), 0)
    state.vocab.stats.weak.clears += 5
    const measured = reconcileStudyPlan(plan, state)
    assert.equal(measured.steps[0].status, 'done')
    assert.equal(measured.steps[0].completion, 'measured')
    assert.equal(measured.steps[1].status, 'pending')
  })

  it('counts a new lesson check, not merely reading the lesson', () => {
    const state = createDefaultAppState()
    const plan = buildStudyPlan(state, 5)
    const step = plan.steps.find((item) => item.kind === 'theory')!
    state.theory.lessons[step.targetIds[0]] = { readAt: Date.now(), checkAttempts: 0, lastCheckAt: null, lastScore: 0, questionCount: 0 }
    assert.equal(studyStepProgress(step, state), 0)
    state.theory.lessons[step.targetIds[0]].checkAttempts = 1
    assert.equal(reconcileStudyPlan(plan, state).steps[1].completion, 'measured')
  })

  it('revisits a failed theory check and gives replacements a current baseline', () => {
    const state = createDefaultAppState()
    state.theory.lessons.questions = { readAt: 2, checkAttempts: 2, lastCheckAt: 3, lastScore: 1, questionCount: 2 }
    const plan = buildStudyPlan(state, 10)
    assert.deepEqual(plan.steps[1].targetIds, ['questions'])
    assert.equal(plan.steps[1].baseline, 2)
    const kana = Object.keys(state.kana.stats)[0]
    state.kana.stats[kana].clears = 12
    const replacement = studyPlanOptions(state, 10).find((step) => step.id === 'kana')!
    assert.equal(replacement.baseline, 12)
    assert.equal(studyStepProgress(replacement, state), 0)
    assert.equal(replacement.status, 'pending')
  })

  it('measures saved context attempts while preserving explicit and skipped decisions', () => {
    const state = createDefaultAppState()
    state.contexts.examples = [{ id: 'example', wordId: 'word', sentence: '本です。', surface: '本', sourceKind: 'reader', createdAt: 1 }]
    state.contexts.stats.example = { attempts: 7, correct: 3, lastAt: 1 }
    const plan = buildStudyPlan(state, 10)
    assert.equal(plan.steps[2].kind, 'contexts')
    assert.equal(studyStepProgress(plan.steps[2], state), 0)
    state.contexts.stats.example.attempts += 3
    plan.steps[0] = { ...plan.steps[0], status: 'done', completion: 'explicit' }
    plan.steps[1] = { ...plan.steps[1], status: 'skipped' }
    const next = reconcileStudyPlan(plan, state)
    assert.equal(next.steps[0].completion, 'explicit')
    assert.equal(next.steps[1].status, 'skipped')
    assert.equal(next.steps[2].completion, 'measured')
  })

  it('roundtrips a real plan and rejects malformed routes, counters and duplicate steps', () => {
    const state = createDefaultAppState()
    const plan = buildStudyPlan(state, 10, 100)
    assert.deepEqual(sanitizeStudyPlan(JSON.parse(JSON.stringify(plan))), plan)
    assert.equal(sanitizeStudyPlan({ ...plan, steps: [{ ...plan.steps[0], page: 'accounts' }] }), null)
    assert.equal(sanitizeStudyPlan({ ...plan, steps: [{ ...plan.steps[0], baseline: -1 }] }), null)
    assert.equal(sanitizeStudyPlan({ ...plan, steps: [plan.steps[0], plan.steps[0]] }), null)
    assert.equal(sanitizeStudyPlan({ ...plan, steps: [{ ...plan.steps[0], status: 'done' }] }), null)
    assert.equal(sanitizeStudyPlan(null), null)
    state.studyPlan = plan
    assert.deepEqual(normalizeAppState(JSON.parse(JSON.stringify(state)))!.studyPlan, plan)
  })
})
