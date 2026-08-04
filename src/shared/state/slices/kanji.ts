import type { AppState, KanjiWordJlptLevel } from '../../lib/types'

const VALID_WORD_JLPT = new Set<KanjiWordJlptLevel>([5, 4, 3, 2, 1])

function sanitizeHiddenWordsByKanji(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, string[]> = {}
  for (const [character, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof character !== 'string' || character.length !== 1 || !Array.isArray(value)) continue
    const ids = [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    if (ids.length) result[character] = ids
  }
  return result
}

export function sanitizeWordJlptLevels(raw: unknown, fallback: KanjiWordJlptLevel[] = []): KanjiWordJlptLevel[] {
  if (!Array.isArray(raw)) return [...fallback]
  const levels = [
    ...new Set(
      raw.filter((item): item is KanjiWordJlptLevel =>
        typeof item === 'number' && VALID_WORD_JLPT.has(item as KanjiWordJlptLevel),
      ),
    ),
  ].sort((a, b) => b - a)
  if (levels.length === 0 || levels.length === VALID_WORD_JLPT.size) return []
  return levels
}

export function sanitizeKanjiState(raw: unknown, fallback: AppState['kanji']): AppState['kanji'] {
  const source = raw && typeof raw === 'object' ? (raw as Partial<AppState['kanji']>) : {}
  const learned = Array.isArray(source.learned)
    ? [...new Set(source.learned.filter((item): item is string => typeof item === 'string' && item.length === 1))]
    : [...fallback.learned]

  return {
    learned,
    preferences: {
      hiddenWordsByKanji: sanitizeHiddenWordsByKanji(
        source.preferences?.hiddenWordsByKanji ?? fallback.preferences.hiddenWordsByKanji,
      ),
      wordJlptLevels: sanitizeWordJlptLevels(
        source.preferences?.wordJlptLevels,
        fallback.preferences.wordJlptLevels,
      ),
    },
  }
}
