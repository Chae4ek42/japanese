import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SWIPE_MAX_DURATION_MS,
  SWIPE_THRESHOLD_PX,
  classifySwipe,
} from '../../src/shared/lib/useSwipeGestures'

describe('swipe classification', () => {
  it('treats a slow horizontal drag as a swipe', () => {
    assert.equal(classifySwipe(-70, 12, 650), 'left')
    assert.equal(classifySwipe(70, -8, 500), 'right')
  })

  it('ignores a short or diagonal nudge', () => {
    assert.equal(classifySwipe(20, 4, 200), null)
    assert.equal(classifySwipe(50, 48, 200), null)
  })

  it('ignores a gesture that lasts too long', () => {
    assert.equal(classifySwipe(-120, 0, SWIPE_MAX_DURATION_MS + 1), null)
  })

  it('accepts a vertical swipe past its own threshold', () => {
    assert.equal(classifySwipe(8, 80, 300), 'down')
    assert.equal(classifySwipe(-6, -80, 300), 'up')
    assert.equal(classifySwipe(0, SWIPE_THRESHOLD_PX, 200), null)
  })
})
