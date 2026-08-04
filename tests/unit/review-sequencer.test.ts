import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyGradeToSequencer,
  createReviewSessionState,
  IN_FLIGHT_LIMIT,
  pickNextCard,
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

  it('again schedules +2 turns', () => {
    let state = createReviewSessionState(['a', 'b', 'c', 'd', 'e'], { seed: 3 })
    const first = pickNextCard(state)
    assert.equal(first.kind, 'card')
    if (first.kind !== 'card') return
    const after = applyGradeToSequencer(first.state, first.cardId, 1)
    assert.equal(after.dueTurns[first.cardId], after.turn + 2)
  })
})
