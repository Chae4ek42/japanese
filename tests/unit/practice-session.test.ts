import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EMPTY_SESSION_STATS,
  sessionAccuracy,
  usePracticeSession,
} from '../../src/shared/lib/usePracticeSession.ts'
import { useWordCarousel } from '../../src/shared/lib/useWordCarousel.ts'

describe('usePracticeSession helpers', () => {
  it('EMPTY_SESSION_STATS starts at zero', () => {
    assert.deepEqual(EMPTY_SESSION_STATS, { answered: 0, clean: 0, streak: 0 })
  })

  it('sessionAccuracy is 100 when nothing answered', () => {
    assert.equal(sessionAccuracy(EMPTY_SESSION_STATS), 100)
  })

  it('sessionAccuracy rounds clean ratio', () => {
    assert.equal(sessionAccuracy({ answered: 4, clean: 3, streak: 1 }), 75)
    assert.equal(sessionAccuracy({ answered: 3, clean: 1, streak: 0 }), 33)
  })

  it('exports a hook function', () => {
    assert.equal(typeof usePracticeSession, 'function')
  })
})

describe('useWordCarousel', () => {
  it('exports a hook function', () => {
    assert.equal(typeof useWordCarousel, 'function')
  })
})
