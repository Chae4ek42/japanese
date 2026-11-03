import type { VocabPreferences, VocabTrainingSession } from '../../shared/lib/types'

export function createVocabTrainingSession(
  id: string,
  preferences: VocabPreferences,
  name: string,
  now = Date.now(),
): VocabTrainingSession {
  const sessionMode = preferences.sessionMode === 'adaptive' ? 'adaptive' : 'drill'
  return {
    id,
    name: name.trim().slice(0, 64) || 'Тренировка',
    createdAt: now,
    updatedAt: now,
    preferences: {
      ...preferences,
      sessionMode,
      pickMode: sessionMode === 'adaptive' ? 'adaptive' : 'even',
      selectedKanji: [...preferences.selectedKanji],
      wordJlptLevels: [...preferences.wordJlptLevels],
    },
    liveSession: null,
  }
}

export function updateVocabTrainingSession(
  sessions: VocabTrainingSession[],
  id: string,
  patch: Partial<Pick<VocabTrainingSession, 'name' | 'preferences' | 'liveSession'>>,
  now = Date.now(),
): VocabTrainingSession[] {
  if (!sessions.some((session) => session.id === id)) return sessions
  return sessions.map((session) => session.id === id
    ? { ...session, ...patch, updatedAt: now }
    : session)
}

export function trainingSessionPoolLabel(preferences: VocabPreferences): string {
  if (preferences.sessionMode === 'adaptive') {
    return preferences.reviewScope === 'problem' ? 'Проблемные слова' : 'Мои слова'
  }
  switch (preferences.source) {
    case 'mine': return 'Мои слова'
    case 'problem': return 'Проблемные слова'
    case 'list': return 'Набор слов'
    case 'kanji': return 'По кандзи'
    case 'group': return 'Категория'
    case 'level': return `JLPT N${preferences.level}`
  }
}
