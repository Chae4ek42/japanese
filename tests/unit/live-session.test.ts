import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isRestorableLiveSession } from '../../src/shared/lib/useLiveTrainerSession.ts'
import type { CardTrainerLiveSession } from '../../src/shared/lib/types.ts'

describe('isRestorableLiveSession', () => {
  it('принимает practice с карточкой из пула', () => {
    const live: CardTrainerLiveSession = {
      view: 'practice',
      currentCardId: 'n-1',
      session: {
        poolIds: ['n-1', 'n-2'],
        recentHistory: [],
        lastCardId: null,
        mistakeQueue: [],
        sinceQueuePick: 0,
        mode: 'even',
      },
      sessionStats: { answered: 1, clean: 1, streak: 1 },
    }
    assert.equal(isRestorableLiveSession(live), true)
  })

  it('отклоняет setup и карточку вне пула', () => {
    assert.equal(isRestorableLiveSession(null), false)
    assert.equal(
      isRestorableLiveSession({
        view: 'setup',
        currentCardId: 'n-1',
        session: {
          poolIds: ['n-1'],
          recentHistory: [],
          lastCardId: null,
          mistakeQueue: [],
          sinceQueuePick: 0,
          mode: 'adaptive',
        },
        sessionStats: { answered: 0, clean: 0, streak: 0 },
      }),
      false,
    )
  })
})
