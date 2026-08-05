import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyGradeToSequencer,
  createReviewSessionState,
  IN_FLIGHT_LIMIT,
  learningLag,
  pickNextCard,
  shouldIntroduce,
} from '../../src/shared/lib/review'

describe('review sequencer', () => {
  it('never returns a card before its dueTurn', () => {
    let state = createReviewSessionState(['a', 'b', 'c', 'd', 'e', 'f'], { seed: 42 })
    const seenBeforeDue: string[] = []
    for (let i = 0; i < 40; i += 1) {
      const pick = pickNextCard(state, { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 })
      if (pick.kind !== 'card') {
        state = pick.state
        break
      }
      const due = pick.state.dueTurns[pick.cardId] ?? 0
      if (due > pick.state.turn + 1e-9) seenBeforeDue.push(pick.cardId)
      state = applyGradeToSequencer(pick.state, pick.cardId, 3)
    }
    assert.deepEqual(seenBeforeDue, [])
  })

  it('keeps introduced cards until graduated or still in-flight', () => {
    let state = createReviewSessionState(['a', 'b', 'c'], { seed: 7 })
    const introduced = new Set<string>()
    for (let i = 0; i < 30; i += 1) {
      const pick = pickNextCard(state)
      if (pick.kind === 'done') {
        for (const id of introduced) {
          assert.ok(
            pick.state.graduatedIds.includes(id) || pick.state.inFlight.includes(id),
            `lost ${id}`,
          )
        }
        break
      }
      if (pick.kind === 'card') {
        introduced.add(pick.cardId)
        state = applyGradeToSequencer(pick.state, pick.cardId, i % 5 === 0 ? 1 : 4)
      } else {
        state = pick.state
      }
    }
  })

  it('respects in-flight gate', () => {
    let state = createReviewSessionState(
      Array.from({ length: 20 }, (_, i) => `c${i}`),
      { seed: 1 },
    )
    const pick = pickNextCard(state)
    assert.equal(pick.kind, 'card')
    if (pick.kind === 'card') {
      assert.ok(pick.state.inFlight.length <= IN_FLIGHT_LIMIT)
    }
  })

  it('again schedules at least working-set size turns', () => {
    let state = createReviewSessionState(['a', 'b', 'c', 'd', 'e'], { seed: 3 })
    // Build a fuller working set first.
    for (let i = 0; i < 4; i += 1) {
      const pick = pickNextCard(state)
      assert.equal(pick.kind, 'card')
      if (pick.kind !== 'card') return
      state = applyGradeToSequencer(pick.state, pick.cardId, 3)
    }
    const next = pickNextCard(state)
    assert.equal(next.kind, 'card')
    if (next.kind !== 'card') return
    const after = applyGradeToSequencer(next.state, next.cardId, 1)
    const working = after.inFlight.filter((id) => (after.weightMultipliers[id] ?? 1) > 0).length
    assert.equal(after.dueTurns[next.cardId], after.turn + learningLag(working, 3))
    assert.ok((after.dueTurns[next.cardId] ?? 0) - after.turn >= working)
  })

  it('does not introduce while the working set is full', () => {
    let state = createReviewSessionState(
      Array.from({ length: 12 }, (_, i) => `c${i}`),
      { seed: 11 },
    )
    for (let i = 0; i < IN_FLIGHT_LIMIT; i += 1) {
      const pick = pickNextCard(state)
      assert.equal(pick.kind, 'card')
      if (pick.kind !== 'card') return
      state = applyGradeToSequencer(pick.state, pick.cardId, 3)
    }
    assert.equal(state.inFlight.length, IN_FLIGHT_LIMIT)
    assert.equal(shouldIntroduce(state), false)
    const planIndex = state.planIndex
    // Next pick must come from the in-flight set, not a brand-new plan card.
    const pick = pickNextCard(state)
    assert.equal(pick.kind, 'card')
    if (pick.kind !== 'card') return
    assert.ok(state.inFlight.includes(pick.cardId) || pick.state.inFlight.includes(pick.cardId))
    assert.equal(pick.state.planIndex, planIndex)
  })

  it('does not re-show the only new card immediately after a good', () => {
    let state = createReviewSessionState(['a', 'b', 'c', 'd'], { seed: 5 })
    const first = pickNextCard(state)
    assert.equal(first.kind, 'card')
    if (first.kind !== 'card') return
    state = applyGradeToSequencer(first.state, first.cardId, 3)
    const second = pickNextCard(state)
    assert.equal(second.kind, 'card')
    if (second.kind !== 'card') return
    assert.notEqual(second.cardId, first.cardId)
  })
})
