import type { AppPage, CardTrainerLiveSession, MemoryState } from '../../shared/lib/types'
import { memoryKey, retentionAt } from '../../shared/lib/review/memory'

export interface HomeContinueItem {
  page: AppPage
  title: string
  answered: number
  testId: string
}

type ContinuePage = 'train' | 'kana' | 'particles' | 'verbs' | 'numbers'

const CONTINUE_ORDER: Array<{ page: ContinuePage; title: string; testId: string }> = [
  { page: 'train', title: 'Слова', testId: 'home-continue-train' },
  { page: 'kana', title: 'Кана', testId: 'home-continue-kana' },
  { page: 'particles', title: 'Частицы', testId: 'home-continue-particles' },
  { page: 'verbs', title: 'Глаголы', testId: 'home-continue-verbs' },
  { page: 'numbers', title: 'Числа', testId: 'home-continue-numbers' },
]

export function continueItemFromLiveSession(
  page: AppPage,
  title: string,
  testId: string,
  liveSession: CardTrainerLiveSession | null | undefined,
): HomeContinueItem | null {
  if (!liveSession || liveSession.view !== 'practice' || !liveSession.currentCardId) {
    return null
  }
  return {
    page,
    title,
    answered: liveSession.sessionStats.answered,
    testId,
  }
}

export function collectContinueItems(live: {
  train?: CardTrainerLiveSession | null
  kana?: CardTrainerLiveSession | null
  particles?: CardTrainerLiveSession | null
  verbs?: CardTrainerLiveSession | null
  numbers?: CardTrainerLiveSession | null
}): HomeContinueItem[] {
  const byPage: Record<ContinuePage, CardTrainerLiveSession | null | undefined> = {
    train: live.train,
    kana: live.kana,
    particles: live.particles,
    verbs: live.verbs,
    numbers: live.numbers,
  }

  const items: HomeContinueItem[] = []
  for (const entry of CONTINUE_ORDER) {
    const item = continueItemFromLiveSession(entry.page, entry.title, entry.testId, byPage[entry.page])
    if (item) items.push(item)
  }
  return items
}

export function countHomeVocabDue(input: {
  myWords: string[]
  memory: Record<string, MemoryState>
  targetRetention: number
  now?: number
}): { due: number; newCards: number } {
  const now = input.now ?? Date.now()
  const seen = new Set<string>()
  let due = 0
  let newCards = 0

  for (const id of input.myWords) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    const mem = input.memory[memoryKey(id, 1)] ?? input.memory[memoryKey(id, 0)]
    if (!mem || mem.state === 'new' || mem.s <= 0 || !mem.lastAt) {
      newCards += 1
      continue
    }
    if (mem.state === 'learning' || mem.state === 'relearning') {
      due += 1
      continue
    }
    if (retentionAt(mem, now) < input.targetRetention) {
      due += 1
    }
  }

  return { due, newCards }
}
