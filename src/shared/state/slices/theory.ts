import type { TheoryLessonProgress, TheoryState } from '../../lib/types'

export const DEFAULT_THEORY_STATE: TheoryState = { lessons: {} }

export function emptyTheoryLesson(): TheoryLessonProgress {
  return { readAt: null, checkAttempts: 0, lastCheckAt: null, lastScore: 0, questionCount: 0 }
}

export function sanitizeTheoryState(raw: unknown): TheoryState {
  if (!raw || typeof raw !== 'object') return { lessons: {} }
  const source = (raw as Partial<TheoryState>).lessons
  if (!source || typeof source !== 'object') return { lessons: {} }
  const lessons: TheoryState['lessons'] = {}
  const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  const stamp = (value: unknown) => count(value) || null
  for (const [id, item] of Object.entries(source)) {
    if (!id || !item || typeof item !== 'object') continue
    const questionCount = count(item.questionCount)
    lessons[id] = {
      readAt: stamp(item.readAt), checkAttempts: count(item.checkAttempts),
      lastCheckAt: stamp(item.lastCheckAt), lastScore: Math.min(count(item.lastScore), questionCount), questionCount,
    }
  }
  return { lessons }
}
