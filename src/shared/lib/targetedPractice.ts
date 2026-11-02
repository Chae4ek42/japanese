export type PracticeSection = 'kana' | 'vocab' | 'numbers' | 'particles' | 'verbs'

export interface TargetedPracticeIntent {
  section: PracticeSection
  cardIds: string[]
  createdAt: number
}

export const TARGETED_PRACTICE_KEY = 'jp:targeted-practice:v1'
const MAX_AGE = 10 * 60 * 1000

export function requestTargetedPractice(
  intent: Pick<TargetedPracticeIntent, 'section' | 'cardIds'>,
): void {
  try {
    sessionStorage.setItem(TARGETED_PRACTICE_KEY, JSON.stringify({
      ...intent,
      cardIds: [...new Set(intent.cardIds)],
      createdAt: Date.now(),
    }))
  } catch { /* Training remains accessible when browser storage is unavailable. */ }
}

/** Read without mutation so React's repeated initial render cannot lose an intent. */
export function readTargetedPractice(section: PracticeSection): TargetedPracticeIntent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(TARGETED_PRACTICE_KEY) ?? 'null')
    if (!value || value.section !== section || !Array.isArray(value.cardIds)
      || !value.cardIds.length || value.cardIds.some((id: unknown) => typeof id !== 'string')
      || !Number.isFinite(value.createdAt) || Date.now() - value.createdAt > MAX_AGE
      || value.createdAt > Date.now() + 60_000) return null
    return value as TargetedPracticeIntent
  } catch { return null }
}

export function consumeTargetedPractice(section: PracticeSection): TargetedPracticeIntent | null {
  const intent = readTargetedPractice(section)
  if (intent) {
    try { sessionStorage.removeItem(TARGETED_PRACTICE_KEY) } catch { /* Storage may be disabled. */ }
  }
  return intent
}
