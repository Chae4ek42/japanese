const LESSON_REQUEST_KEY = 'jp:theory-lesson-request'

export function requestTheoryLesson(id: string): void {
  try { sessionStorage.setItem(LESSON_REQUEST_KEY, id) } catch { /* The lesson menu remains available. */ }
}

export function requestedTheoryLesson(): string | null {
  try { return sessionStorage.getItem(LESSON_REQUEST_KEY) } catch { return null }
}

export function consumeTheoryLessonRequest(): void {
  try { sessionStorage.removeItem(LESSON_REQUEST_KEY) } catch { /* Storage may be unavailable. */ }
}
