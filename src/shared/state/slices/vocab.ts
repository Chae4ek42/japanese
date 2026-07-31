import type { KanjiWord, KanjiWordReading, StatsRecord, VocabPreferences, VocabState } from '../../lib/types'
import { sanitizeWordJlptLevels } from './kanji'

const VALID_VOCAB_DRILLS = new Set(['romaji', 'choice', 'mixed'])
const VALID_VOCAB_SOURCES = new Set(['level', 'group', 'mine'])
const VALID_VOCAB_LEVELS = new Set([5, 4, 3, 2, 1])
const VALID_PICK_MODES = new Set(['adaptive', 'even'])
const VALID_INPUT_MODES = new Set(['instant', 'submit'])

export const DEFAULT_VOCAB_PREFERENCES: VocabPreferences = {
  drillMode: 'romaji',
  source: 'level',
  level: 5,
  groupId: 'family',
  pickMode: 'adaptive',
  inputMode: 'instant',
  wordJlptLevels: [],
  newWordLimit: -1,
  trainFullGroup: false,
  mineIncludeLearned: true,
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

function sanitizeVocabPreferences(raw: unknown, fallback: VocabPreferences): VocabPreferences {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const levelRaw = typeof source.level === 'number' ? source.level : fallback.level
  const groupId =
    typeof source.groupId === 'string' && source.groupId.length > 0 ? source.groupId : fallback.groupId

  return {
    drillMode: VALID_VOCAB_DRILLS.has(String(source.drillMode))
      ? (source.drillMode as VocabPreferences['drillMode'])
      : fallback.drillMode,
    source: VALID_VOCAB_SOURCES.has(String(source.source))
      ? (source.source as VocabPreferences['source'])
      : fallback.source,
    level: VALID_VOCAB_LEVELS.has(levelRaw) ? (levelRaw as VocabPreferences['level']) : fallback.level,
    groupId,
    pickMode: VALID_PICK_MODES.has(String(source.pickMode))
      ? (source.pickMode as VocabPreferences['pickMode'])
      : fallback.pickMode,
    inputMode: VALID_INPUT_MODES.has(String(source.inputMode))
      ? (source.inputMode as VocabPreferences['inputMode'])
      : fallback.inputMode,
    wordJlptLevels: sanitizeWordJlptLevels(source.wordJlptLevels, fallback.wordJlptLevels),
    newWordLimit: clampInt(source.newWordLimit, -1, 50, fallback.newWordLimit),
    trainFullGroup:
      typeof source.trainFullGroup === 'boolean' ? source.trainFullGroup : fallback.trainFullGroup,
    mineIncludeLearned:
      typeof source.mineIncludeLearned === 'boolean'
        ? source.mineIncludeLearned
        : fallback.mineIncludeLearned,
  }
}

function sanitizeReading(raw: unknown): KanjiWordReading | null {
  if (!raw || typeof raw !== 'object') return null
  const reading = raw as Record<string, unknown>
  const kana = typeof reading.kana === 'string' ? reading.kana.trim() : ''
  const romaji = typeof reading.romaji === 'string' ? reading.romaji.trim() : ''
  const meanings = Array.isArray(reading.meanings)
    ? reading.meanings
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : []
  if (!kana || !romaji || !meanings.length) return null
  return {
    id: typeof reading.id === 'string' && reading.id ? reading.id : undefined,
    kana,
    romaji,
    meanings,
    jlpt: typeof reading.jlpt === 'number' ? reading.jlpt : undefined,
    common: typeof reading.common === 'boolean' ? reading.common : undefined,
  }
}

function sanitizeCustomWords(raw: unknown): Record<string, KanjiWord> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  const result: Record<string, KanjiWord> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !value || typeof value !== 'object') continue
    const word = value as Record<string, unknown>
    const writing = typeof word.writing === 'string' ? word.writing.trim() : ''
    if (!writing) continue

    const readings = Array.isArray(word.readings)
      ? word.readings
          .map(sanitizeReading)
          .filter((item): item is KanjiWordReading => item !== null)
      : []

    let kana = typeof word.kana === 'string' ? word.kana.trim() : ''
    let romaji = typeof word.romaji === 'string' ? word.romaji.trim() : ''
    let meanings = Array.isArray(word.meanings)
      ? word.meanings
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
      : []

    if (readings.length) {
      kana = readings.map((reading) => reading.kana).join(' / ')
      romaji = readings.map((reading) => reading.romaji).join(' / ')
      meanings = [...new Set(readings.flatMap((reading) => reading.meanings))]
    }

    if (!kana || !romaji || !meanings.length) continue
    const id = typeof word.id === 'string' && word.id ? word.id : key
    const kanji = Array.isArray(word.kanji)
      ? word.kanji.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : []
    const variantIds = Array.isArray(word.variantIds)
      ? [
          ...new Set(
            word.variantIds.filter((item): item is string => typeof item === 'string' && item.length > 0),
          ),
        ]
      : undefined
    result[id] = {
      id,
      writing,
      kana,
      romaji,
      meanings,
      kanji,
      ...(readings.length ? { readings } : {}),
      ...(variantIds?.length ? { variantIds } : {}),
    }
  }
  return result
}

export function sanitizeVocabState(raw: unknown, fallback: VocabState): VocabState {
  const source = raw && typeof raw === 'object' ? (raw as Partial<VocabState>) : {}
  const customWords = sanitizeCustomWords(source.customWords)
  const myWordsRaw = Array.isArray(source.myWords)
    ? source.myWords.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [...fallback.myWords]
  const myWords = [...new Set([...myWordsRaw, ...Object.keys(customWords).filter((id) => id.startsWith('custom:'))])]

  const hiddenWordIds = [
    ...new Set(
      (Array.isArray(source.hiddenWordIds) ? source.hiddenWordIds : fallback.hiddenWordIds ?? [])
        .filter((item): item is string => typeof item === 'string' && item.length > 0),
    ),
  ]

  const learnedWordIds = [
    ...new Set(
      (Array.isArray(source.learnedWordIds) ? source.learnedWordIds : fallback.learnedWordIds ?? [])
        .filter((item): item is string => typeof item === 'string' && item.length > 0),
    ),
  ]

  const stats =
    source.stats && typeof source.stats === 'object' ? { ...(source.stats as Record<string, StatsRecord>) } : {}

  return {
    myWords,
    customWords,
    hiddenWordIds,
    learnedWordIds,
    preferences: sanitizeVocabPreferences(source.preferences, fallback.preferences),
    stats,
  }
}
