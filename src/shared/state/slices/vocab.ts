import type {
  KanjiWord,
  KanjiWordReading,
  LatencyModel,
  MemoryState,
  ReviewDayCounters,
  StatsRecord,
  VocabPreferences,
  VocabState,
} from '../../lib/types'
import { DEFAULT_LATENCY_MODEL } from '../../lib/review/grade'
import { MEMORY_MODEL_VERSION } from '../../lib/review/memory'
import { getDayKey } from '../../lib/trainer'
import { sanitizeWordJlptLevels } from './kanji'
import { sanitizeCardTrainerLiveSession } from './live-session'

const VALID_VOCAB_DRILLS = new Set(['romaji', 'choice', 'mixed'])
const VALID_VOCAB_SOURCES = new Set(['level', 'group', 'mine', 'kanji', 'list'])
const VALID_VOCAB_LEVELS = new Set([5, 4, 3, 2, 1])
const VALID_PICK_MODES = new Set(['adaptive', 'even'])
const VALID_INPUT_MODES = new Set(['instant', 'submit'])
const VALID_MEMORY_STATES = new Set(['new', 'learning', 'review', 'relearning', 'leech'])

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
  selectedKanji: [],
  targetRetention: 0.9,
  newPerDay: 10,
  sessionMinutes: 15,
  reviewV2: true,
}

function sanitizeSelectedKanji(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback]
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const ch = item.trim()
    if (!ch || seen.has(ch)) continue
    seen.add(ch)
    out.push(ch)
  }
  return out
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

function sanitizeVocabPreferences(raw: unknown, fallback: VocabPreferences): VocabPreferences {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const levelRaw = typeof source.level === 'number' ? source.level : fallback.level
  const groupId =
    typeof source.groupId === 'string' && source.groupId.length > 0 ? source.groupId : fallback.groupId

  const newWordLimit = clampInt(source.newWordLimit, -1, 50, fallback.newWordLimit)
  const newPerDayRaw =
    typeof source.newPerDay === 'number' && Number.isFinite(source.newPerDay)
      ? Math.round(source.newPerDay)
      : newWordLimit >= 0
        ? newWordLimit
        : fallback.newPerDay

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
    newWordLimit,
    trainFullGroup:
      typeof source.trainFullGroup === 'boolean' ? source.trainFullGroup : fallback.trainFullGroup,
    mineIncludeLearned:
      typeof source.mineIncludeLearned === 'boolean'
        ? source.mineIncludeLearned
        : fallback.mineIncludeLearned,
    selectedKanji: sanitizeSelectedKanji(source.selectedKanji, fallback.selectedKanji ?? []),
    targetRetention: clampFloat(source.targetRetention, 0.85, 0.95, fallback.targetRetention),
    newPerDay: Math.min(50, Math.max(0, newPerDayRaw)),
    sessionMinutes: clampInt(source.sessionMinutes, 5, 60, fallback.sessionMinutes),
    reviewV2: typeof source.reviewV2 === 'boolean' ? source.reviewV2 : fallback.reviewV2,
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

function sanitizeMemoryState(raw: unknown): MemoryState | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const state = String(source.state)
  if (!VALID_MEMORY_STATES.has(state)) return null
  return {
    s: clampFloat(source.s, 0, 20_000, 0),
    d: clampFloat(source.d, 0.05, 0.95, 0.3),
    lastAt: clampFloat(source.lastAt, 0, Number.MAX_SAFE_INTEGER, 0),
    lastPresentedAt: clampFloat(source.lastPresentedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    reps: clampInt(source.reps, 0, 1_000_000, 0),
    lapses: clampInt(source.lapses, 0, 1_000_000, 0),
    state: state as MemoryState['state'],
    uncertain: Boolean(source.uncertain),
    modelVersion: clampInt(source.modelVersion, 1, 100, MEMORY_MODEL_VERSION),
    createdAt: clampFloat(source.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    leechUntil:
      typeof source.leechUntil === 'number' && Number.isFinite(source.leechUntil)
        ? source.leechUntil
        : undefined,
  }
}

function sanitizeMemoryMap(raw: unknown): Record<string, MemoryState> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, MemoryState> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.includes(':')) continue
    const mem = sanitizeMemoryState(value)
    if (mem) out[key] = mem
  }
  return out
}

function sanitizeLatencyModel(raw: unknown, fallback: LatencyModel): LatencyModel {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const muRaw = source.mu && typeof source.mu === 'object' ? (source.mu as Record<string, unknown>) : {}
  const betaRaw =
    source.beta && typeof source.beta === 'object' ? (source.beta as Record<string, unknown>) : {}
  const zSamples = Array.isArray(source.zSamples)
    ? source.zSamples.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)).slice(-120)
    : fallback.zSamples
  return {
    mu: {
      romaji: clampFloat(muRaw.romaji, 0, 12, fallback.mu.romaji),
      choice: clampFloat(muRaw.choice, 0, 12, fallback.mu.choice),
      mixed: clampFloat(muRaw.mixed, 0, 12, fallback.mu.mixed),
    },
    beta: {
      romaji: clampFloat(betaRaw.romaji, 0.01, 0.25, fallback.beta.romaji),
      choice: clampFloat(betaRaw.choice, 0.01, 0.25, fallback.beta.choice),
      mixed: clampFloat(betaRaw.mixed, 0.01, 0.25, fallback.beta.mixed),
    },
    samples: clampInt(source.samples, 0, 10_000_000, fallback.samples),
    zSamples,
  }
}

function sanitizeReviewDay(raw: unknown): ReviewDayCounters {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const today = getDayKey(Date.now())
  const dayKey = typeof source.dayKey === 'string' ? source.dayKey : today
  const newIntroduced = clampInt(source.newIntroduced, 0, 10_000, 0)
  if (dayKey !== today) return { dayKey: today, newIntroduced: 0 }
  return { dayKey, newIntroduced }
}

export function sanitizeVocabState(raw: unknown, fallback: VocabState): VocabState {
  const source = raw && typeof raw === 'object' ? (raw as Partial<VocabState>) : {}
  const customWords = sanitizeCustomWords(source.customWords)
  const myWordsRaw = Array.isArray(source.myWords)
    ? source.myWords.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [...fallback.myWords]
  const myWords = [...new Set([...myWordsRaw, ...Object.keys(customWords).filter((id) => id.startsWith('custom:'))])]

  const myWordAddedAtRaw =
    source.myWordAddedAt && typeof source.myWordAddedAt === 'object'
      ? (source.myWordAddedAt as Record<string, unknown>)
      : {}
  const myWordAddedAt: Record<string, number> = {}
  const migrateBase = Date.now() - myWords.length * 1000
  myWords.forEach((id, index) => {
    const raw = myWordAddedAtRaw[id]
    myWordAddedAt[id] =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : migrateBase + index * 1000
  })

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

  const trainingWordIds = [
    ...new Set(
      (Array.isArray(source.trainingWordIds) ? source.trainingWordIds : fallback.trainingWordIds ?? [])
        .filter((item): item is string => typeof item === 'string' && item.length > 0),
    ),
  ]

  const stats =
    source.stats && typeof source.stats === 'object' ? { ...(source.stats as Record<string, StatsRecord>) } : {}

  return {
    myWords,
    customWords,
    myWordAddedAt,
    hiddenWordIds,
    learnedWordIds,
    trainingWordIds,
    preferences: sanitizeVocabPreferences(source.preferences, fallback.preferences),
    stats,
    memory: sanitizeMemoryMap(source.memory),
    latencyModel: sanitizeLatencyModel(source.latencyModel, fallback.latencyModel ?? DEFAULT_LATENCY_MODEL),
    reviewDay: sanitizeReviewDay(source.reviewDay),
    liveSession: sanitizeCardTrainerLiveSession(source.liveSession, fallback.liveSession ?? null),
  }
}
