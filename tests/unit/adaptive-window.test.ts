import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createAdaptiveWindow, dropAdaptiveWord, effectiveWordStrength, gradeAdaptiveWord,
  pickAdaptiveWord, updateWordPractice, wordPracticeStats, WINDOW_SIZE,
} from '../../src/features/vocab/adaptiveWindow.ts'
import { applyOptimisticStat, nextSessionAfterVocabGrade } from '../../src/features/vocab/vocabGrade.ts'
import { startReviewPracticeSession } from '../../src/features/vocab/reviewSession.ts'
import { pickNextVocabCardId } from '../../src/features/vocab/vocabPick.ts'
import { applyVocabNewWordLimit, buildVocabPool } from '../../src/features/vocab/pool.ts'
import { createInitialSession, createStatsRecord } from '../../src/shared/lib/trainer.ts'
import { createDefaultAppState } from '../../src/shared/state/app-state.ts'
import { sanitizeVocabState, DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/slices/vocab.ts'
import { sanitizeCardTrainerLiveSession } from '../../src/shared/state/slices/live-session.ts'
import type { AdaptiveWindowState, StatsOutcome, StatsRecord, VocabCard } from '../../src/shared/lib/types.ts'

const NOW = Date.parse('2026-11-02T12:00:00Z')
const ids = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`)
const card = (id: string): VocabCard => ({ id, writing: id, kana: id, romaji: id, answers: [id], meaning: id, meanings: [id] })

function simulate(size: number, turns: number, outcome: (id: string, attempt: number, turn: number) => StatsOutcome) {
  const pool = ids(size)
  let state = createAdaptiveWindow(pool, {}, NOW)
  const stats: Record<string, StatsRecord> = {}
  const shown: string[] = []
  const firstSeen: Record<string, number> = {}
  const reviewTurns: number[] = []
  const activeCounts: number[] = []
  let coveredAt = -1
  for (let turn = 0; turn < turns; turn++) {
    const picked = pickAdaptiveWord(state, pool)
    assert.ok(picked.cardId, `no card at turn ${turn}`)
    const id = picked.cardId
    state = picked.state
    if (size > 1) assert.notEqual(id, shown.at(-1), `immediate repeat at turn ${turn}`)
    if (!state.active.includes(id)) reviewTurns.push(turn)
    activeCounts.push(state.active.length)
    assert.ok(state.active.length <= WINDOW_SIZE)
    if (firstSeen[id] === undefined) firstSeen[id] = turn
    shown.push(id)
    const result = outcome(id, (stats[id]?.wordPractice?.attempts ?? 0) + 1, turn)
    stats[id] = applyOptimisticStat(stats[id], result, NOW + turn * 4000)
    state = gradeAdaptiveWord(state, id, result, wordPracticeStats(stats[id]))
    if (coveredAt < 0 && Object.keys(firstSeen).length === size) coveredAt = turn
  }
  return { state, stats, shown, firstSeen, coveredAt, reviewTurns, activeCounts }
}

describe('persistent vocabulary evidence', () => {
  it('a failed known word loses more evidence than a failed weak word', () => {
    const weak = createStatsRecord()
    const strong = { ...weak, wordPractice: { strength: 0.95, attempts: 20, streak: 10, lapses: 0, lastAnsweredAt: NOW } }
    const weakDrop = wordPracticeStats(weak).strength - updateWordPractice(weak, 'wrong', NOW).strength
    const strongDrop = 0.95 - updateWordPractice(strong, 'wrong', NOW).strength
    assert.ok(strongDrop > 3 * weakDrop)
    assert.ok(updateWordPractice(strong, 'hint', NOW).strength < 0.5)
  })

  it('exposure is not recall; elapsed time reduces confidence', () => {
    const prev = wordPracticeStats(undefined)
    assert.deepEqual(updateWordPractice(undefined, 'seen', NOW), prev)
    assert.equal(effectiveWordStrength({ ...prev, strength: 0.8, lastAnsweredAt: NOW }, NOW + 30 * 86400000), 0.4)
  })

  it('statistics survive serialization and legacy progress remains usable', () => {
    const stats = applyOptimisticStat(undefined, 'correct', NOW)
    const restored = sanitizeVocabState(JSON.parse(JSON.stringify({ stats: { w: stats } })), createDefaultAppState().vocab)
    assert.deepEqual(restored.stats.w?.wordPractice, stats.wordPractice)
    assert.equal(wordPracticeStats({ ...createStatsRecord(), clears: 50, mastery: 0.99 }).strength, 0.7)
  })
})

describe('sliding adaptive window', () => {
  it('adaptive mode includes all my words despite old filters, limits and learned marks', () => {
    const preferences = { ...DEFAULT_VOCAB_PREFERENCES, sessionMode: 'adaptive' as const,
      source: 'level' as const, wordJlptLevels: [5 as const], newWordLimit: 1,
      includeColloquial: false, mineIncludeLearned: false }
    const words = Object.fromEntries(ids(12).map((id) => [`custom:${id}`, {
      id: `custom:${id}`, writing: id, kana: 'ことば', romaji: id, meanings: ['слово (разг.)'], kanji: [],
    }]))
    const pool = buildVocabPool(preferences, Object.keys(words), words, { learnedWordIds: Object.keys(words) })
    assert.equal(pool.length, 12)
    assert.equal(applyVocabNewWordLimit(pool, preferences).length, 12)
  })

  it('starts with the weakest five, including statistics from other modes', () => {
    const stats = {
      weak: applyOptimisticStat(undefined, 'wrong', NOW),
      known: applyOptimisticStat(undefined, 'correct', NOW),
    }
    const state = createAdaptiveWindow(['known', 'new', 'weak', ...ids(10)], stats, NOW)
    assert.deepEqual(state.order.slice(0, 2), ['weak', 'new'])
    assert.equal(state.order.at(-1), 'known')
    let next = state
    const shown: string[] = []
    for (let i = 0; i < 15; i++) {
      const pick = pickAdaptiveWord(next, next.order)
      next = pick.state
      shown.push(pick.cardId!)
      // No answers: no new intake and no fabricated mastery.
    }
    assert.equal(new Set(shown).size, 5)
  })

  it('opens slots after independent recalls, keeps old words and grows intervals', () => {
    const run = simulate(100, 1200, () => 'correct')
    assert.ok(run.coveredAt > 100 && run.coveredAt < 650, `${run.coveredAt}`)
    assert.ok(run.shown.slice(30).includes('w0'))
    assert.ok(run.state.intervals.w0! >= 48)
    const early = run.shown.slice(0, 30).filter((id) => id === 'w0').length
    const later = run.shown.slice(100, 130).filter((id) => id === 'w0').length
    assert.ok(early > later)
    assert.equal(run.state.introduced.length, 100)
  })

  it('never traps the deck when every answer fails', () => {
    const run = simulate(100, 1500, () => 'wrong')
    assert.ok(run.coveredAt > 100 && run.coveredAt < 1150, `${run.coveredAt}`)
    assert.ok(run.shown.slice(100).includes('w0'))
    assert.equal(run.stats.w0?.wordPractice?.strength, 0)
    assert.equal(run.state.introduced.length, 100)
  })

  it('remains bounded and deterministic with persistent difficult words and lapses', () => {
    const outcomes = (id: string, attempt: number) => Number(id.slice(1)) % 7 === 0 || attempt % 6 === 0 ? 'wrong' as const : 'correct' as const
    const a = simulate(100, 2000, outcomes)
    const b = simulate(100, 2000, outcomes)
    assert.deepEqual(a.shown, b.shown)
    assert.ok(a.coveredAt > 0 && a.coveredAt < 1150, `${a.coveredAt}`)
    for (let i = 1; i < a.reviewTurns.length; i++) {
      const turn = a.reviewTurns[i]!
      if (a.activeCounts[turn]! >= 2) assert.ok(turn - a.reviewTurns[i - 1]! >= 4)
    }
    assert.equal(new Set(a.shown.slice(-500)).size, 100)
  })

  it('handles empty/tiny decks and hard exclusions without fallback leaks', () => {
    assert.equal(pickAdaptiveWord(createAdaptiveWindow([], {}, NOW), []).cardId, null)
    for (let size = 1; size <= 5; size++) simulate(size, 100, () => 'correct')
    const state = createAdaptiveWindow(ids(10), {}, NOW)
    assert.equal(pickAdaptiveWord(state, []).cardId, null)
    const run = pickAdaptiveWord(state, ['w9'])
    assert.equal(run.cardId, 'w9')
    const restored = pickAdaptiveWord(run.state, ids(10))
    assert.ok(restored.cardId)
  })

  it('persists the exact next selection through a live-session round trip', () => {
    const run = simulate(20, 85, (_, attempt) => attempt % 3 === 0 ? 'wrong' : 'correct')
    const session = createInitialSession({ poolIds: ids(20), vocabMode: 'adaptive', adaptive: run.state })
    const live = sanitizeCardTrainerLiveSession(JSON.parse(JSON.stringify({
      session, currentCardId: run.shown.at(-1), view: 'practice', sessionStats: { answered: 85, clean: 40, streak: 0 },
    })))
    assert.ok(live?.session.adaptive)
    assert.deepEqual(live.session.adaptive, run.state)
    assert.deepEqual(pickAdaptiveWord(live.session.adaptive, ids(20)), pickAdaptiveWord(run.state, ids(20)))
  })

  it('deleting a word before the cursor does not skip the next word', () => {
    let state: AdaptiveWindowState = pickAdaptiveWord(createAdaptiveWindow(ids(10), {}, NOW), ids(10)).state
    state = dropAdaptiveWord(state, 'w0')
    const picked = pickAdaptiveWord(state, ids(10).slice(1))
    assert.ok(picked.state.active.includes('w5'))
    assert.ok(!picked.state.order.includes('w0'))
  })

  it('ordinary sessions are even and ignore old adaptive preferences', () => {
    const { session } = startReviewPracticeSession({ scope: ids(10).map(card),
      preferences: { ...DEFAULT_VOCAB_PREFERENCES, pickMode: 'adaptive' }, memory: {}, stats: {}, newUsedToday: 0 })
    assert.equal(session.mode, 'even')
    assert.equal(session.adaptive, undefined)
    const picked = pickNextVocabCardId(ids(10).map(card), null, session, {
      weights: {}, pickMode: 'adaptive', preferences: DEFAULT_VOCAB_PREFERENCES,
      usesReviewV2: true, memory: {}, stats: {}, applySession: () => assert.fail('changed even mode'),
    })
    assert.ok(picked)
  })

  it('new adaptive sessions use the window even when reviewV2 is disabled', () => {
    const { session } = startReviewPracticeSession({ scope: ids(10).map(card),
      preferences: { ...DEFAULT_VOCAB_PREFERENCES, sessionMode: 'adaptive', reviewV2: false },
      memory: {}, stats: {}, newUsedToday: 999 })
    assert.ok(session.adaptive)
    assert.equal(session.review, undefined)
    assert.equal(session.poolIds.length, 10)
  })

  it('slow correct answers free a slot, and a forgotten retired card returns sooner', () => {
    const pool = ids(5).map(card)
    let session = createInitialSession({ poolIds: ids(5), adaptive: createAdaptiveWindow(ids(5), {}, NOW) })
    let stats: StatsRecord | undefined
    for (let i = 0; i < 4; i++) {
      const pick = pickAdaptiveWord(session.adaptive!, ids(5))
      session = { ...session, adaptive: { ...pick.state, active: ids(5), turn: i * 5 + 1 } }
      stats = applyOptimisticStat(stats, 'correct', NOW + i * 20000)
      session = nextSessionAfterVocabGrade({ session, cardId: 'w0', grade: 2, wrong: false,
        hintUsed: false, statsOutcome: 'correct', clean: true, usesReviewV2: true, pool, nextStats: stats })
    }
    assert.ok(!session.adaptive!.active.includes('w0'))
    const forgotten = applyOptimisticStat(stats, 'wrong', NOW + 100000)
    const next = nextSessionAfterVocabGrade({ session, cardId: 'w0', grade: 1, wrong: true,
      hintUsed: false, statsOutcome: 'wrong', clean: false, usesReviewV2: true, pool, nextStats: forgotten })
    assert.equal(next.adaptive!.intervals.w0, 4)
    assert.equal(next.adaptive!.streaks.w0, 0)
    assert.ok(forgotten.wordPractice!.strength < 0.72)
  })

  it('legacy live adaptive drills migrate to an even ordinary session', () => {
    const old = { session: createInitialSession({ poolIds: ['w0', 'w1'], mode: 'adaptive' }),
      currentCardId: 'w0', view: 'practice', sessionStats: { answered: 1, clean: 1, streak: 1 } }
    const restored = sanitizeVocabState({ preferences: { sessionMode: 'drill', pickMode: 'adaptive' }, liveSession: old }, createDefaultAppState().vocab)
    assert.equal(restored.preferences.pickMode, 'even')
    assert.equal(restored.liveSession?.session.mode, 'even')
    assert.equal(restored.liveSession?.currentCardId, 'w0')
  })
})
