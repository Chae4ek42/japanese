import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildSessionPlan, createNewMemoryState, applyReview } from '../../src/shared/lib/review'

describe('review planner', () => {
  it('prefers due cards over fresh when backlog is high', () => {
    const now = Date.parse('2026-08-04T12:00:00Z')
    const memory: Record<string, ReturnType<typeof createNewMemoryState>> = {}
    for (let i = 0; i < 40; i += 1) {
      let mem = createNewMemoryState(now - 40 * 3_600_000)
      mem = applyReview(mem, 3, now - 40 * 3_600_000)
      mem = { ...mem, s: 4, lastAt: now - 40 * 3_600_000, state: 'review' }
      memory[`due${i}:1`] = mem
    }
    for (let i = 0; i < 5; i += 1) {
      memory[`new${i}:1`] = createNewMemoryState(now)
    }

    const plan = buildSessionPlan({
      scope: [
        ...Array.from({ length: 40 }, (_, i) => ({ id: `due${i}` })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: `new${i}` })),
      ],
      memory,
      aspect: 1,
      knobs: { targetRetention: 0.9, newPerDay: 10, sessionMinutes: 15 },
      now,
      newUsedToday: 0,
    })

    assert.ok(plan.dueCount >= 40)
    // backlog > 1.5 * dailyQuota suppresses new intake.
    assert.equal(plan.newCount, 0)
    assert.ok(plan.planIds.every((id) => id.startsWith('due')))
  })

  it('even mode keeps scope order', () => {
    const plan = buildSessionPlan({
      scope: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      memory: {},
      aspect: 1,
      knobs: { targetRetention: 0.9, newPerDay: 10, sessionMinutes: 15 },
      even: true,
    })
    assert.deepEqual(plan.planIds, ['a', 'b', 'c'])
  })
})
