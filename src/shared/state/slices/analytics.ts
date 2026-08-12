import type { AnalyticsDayBucket, AnalyticsSection, AnalyticsState } from '../../lib/types'
import { getDayKey } from '../../lib/trainer'

export const ANALYTICS_SECTIONS: AnalyticsSection[] = [
  'home',
  'kana',
  'kanji',
  'numbers',
  'particles',
  'reader',
  'train',
  'vocab',
  'mine',
  'theory',
]

export const ANALYTICS_DAY_LIMIT = 90

export function emptySectionMap(): Record<AnalyticsSection, number> {
  return {
    home: 0,
    kana: 0,
    kanji: 0,
    numbers: 0,
    particles: 0,
    reader: 0,
    train: 0,
    vocab: 0,
    mine: 0,
    theory: 0,
  }
}

export function createDefaultAnalyticsState(now = Date.now()): AnalyticsState {
  return {
    lifetimeActiveMs: 0,
    bySection: emptySectionMap(),
    days: [],
    activeDayStreak: 0,
    lastActiveDayKey: null,
    updatedAt: now,
  }
}

function isAnalyticsSection(value: unknown): value is AnalyticsSection {
  return typeof value === 'string' && (ANALYTICS_SECTIONS as string[]).includes(value)
}

function clampMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.min(value, 1000 * 60 * 60 * 24 * 365)
}

function sanitizeDayBucket(raw: unknown): AnalyticsDayBucket | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const dayKey = typeof source.dayKey === 'string' ? source.dayKey.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null

  const bySection: Partial<Record<AnalyticsSection, number>> = {}
  const rawSections =
    source.bySection && typeof source.bySection === 'object'
      ? (source.bySection as Record<string, unknown>)
      : {}
  for (const key of ANALYTICS_SECTIONS) {
    const ms = clampMs(rawSections[key])
    if (ms > 0) bySection[key] = ms
  }
  const legacyContextMs = clampMs(rawSections.context)
  if (legacyContextMs > 0) {
    bySection.home = (bySection.home ?? 0) + legacyContextMs
  }

  const totalFromSections = ANALYTICS_SECTIONS.reduce((sum, key) => sum + (bySection[key] ?? 0), 0)
  const totalActiveMs = Math.max(clampMs(source.totalActiveMs), totalFromSections)
  const answers =
    typeof source.answers === 'number' && Number.isFinite(source.answers)
      ? Math.max(0, Math.round(source.answers))
      : undefined
  const cleanAnswers =
    typeof source.cleanAnswers === 'number' && Number.isFinite(source.cleanAnswers)
      ? Math.max(0, Math.round(source.cleanAnswers))
      : undefined

  return {
    dayKey,
    totalActiveMs,
    bySection,
    ...(answers !== undefined ? { answers } : {}),
    ...(cleanAnswers !== undefined ? { cleanAnswers } : {}),
  }
}

function prevDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  date.setDate(date.getDate() - 1)
  return getDayKey(date.getTime())
}

export function computeActiveDayStreak(
  days: AnalyticsDayBucket[],
  lastActiveDayKey: string | null,
  todayKey: string,
): number {
  if (!lastActiveDayKey) return 0
  // Streak counts consecutive days ending at today or yesterday (grace).
  let cursor =
    lastActiveDayKey === todayKey || lastActiveDayKey === prevDayKey(todayKey)
      ? lastActiveDayKey
      : null
  if (!cursor) return 0

  const byKey = new Map(days.map((day) => [day.dayKey, day]))
  let streak = 0
  while (cursor) {
    const bucket = byKey.get(cursor)
    if (!bucket || bucket.totalActiveMs <= 0) break
    streak += 1
    cursor = prevDayKey(cursor)
  }
  return streak
}

export function trimAnalyticsDays(days: AnalyticsDayBucket[], limit = ANALYTICS_DAY_LIMIT): AnalyticsDayBucket[] {
  const sorted = [...days].sort((a, b) => a.dayKey.localeCompare(b.dayKey))
  if (sorted.length <= limit) return sorted
  return sorted.slice(sorted.length - limit)
}

export function sanitizeAnalyticsState(raw: unknown, fallback: AnalyticsState): AnalyticsState {
  if (!raw || typeof raw !== 'object') return { ...fallback, bySection: { ...fallback.bySection } }
  const source = raw as Record<string, unknown>

  const bySection = emptySectionMap()
  const rawSections =
    source.bySection && typeof source.bySection === 'object'
      ? (source.bySection as Record<string, unknown>)
      : {}
  for (const key of ANALYTICS_SECTIONS) {
    bySection[key] = clampMs(rawSections[key])
  }
  // v27: drop Context; fold its active time into «Прочее».
  bySection.home += clampMs(rawSections.context)

  const daysRaw = Array.isArray(source.days) ? source.days : []
  const days = trimAnalyticsDays(
    daysRaw.map(sanitizeDayBucket).filter((item): item is AnalyticsDayBucket => item !== null),
  )

  const lastActiveDayKey =
    typeof source.lastActiveDayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.lastActiveDayKey)
      ? source.lastActiveDayKey
      : days.length
        ? days[days.length - 1]!.dayKey
        : null

  const todayKey = getDayKey(Date.now())
  const streakRaw =
    typeof source.activeDayStreak === 'number' && Number.isFinite(source.activeDayStreak)
      ? Math.max(0, Math.round(source.activeDayStreak))
      : computeActiveDayStreak(days, lastActiveDayKey, todayKey)

  return {
    lifetimeActiveMs: Math.max(
      clampMs(source.lifetimeActiveMs),
      ANALYTICS_SECTIONS.reduce((sum, key) => sum + bySection[key], 0),
    ),
    bySection,
    days,
    activeDayStreak: streakRaw,
    lastActiveDayKey,
    updatedAt:
      typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt)
        ? source.updatedAt
        : fallback.updatedAt,
  }
}

/** Map router page → analytics section (analytics UI counts as home/прочее). */
export function sectionFromAppPage(page: string): AnalyticsSection {
  if (isAnalyticsSection(page)) return page
  return 'home'
}

export function applyActiveTimeDelta(
  state: AnalyticsState,
  {
    section,
    deltaMs,
    now = Date.now(),
  }: {
    section: AnalyticsSection
    deltaMs: number
    now?: number
  },
): AnalyticsState {
  const ms = Math.round(deltaMs)
  if (ms <= 0) return state

  const dayKey = getDayKey(now)
  const bySection = { ...state.bySection, [section]: state.bySection[section] + ms }
  const days = [...state.days]
  const index = days.findIndex((day) => day.dayKey === dayKey)
  if (index >= 0) {
    const current = days[index]!
    days[index] = {
      ...current,
      totalActiveMs: current.totalActiveMs + ms,
      bySection: {
        ...current.bySection,
        [section]: (current.bySection[section] ?? 0) + ms,
      },
    }
  } else {
    days.push({
      dayKey,
      totalActiveMs: ms,
      bySection: { [section]: ms },
    })
  }

  const trimmed = trimAnalyticsDays(days)
  const lastActiveDayKey = dayKey
  return {
    lifetimeActiveMs: state.lifetimeActiveMs + ms,
    bySection,
    days: trimmed,
    activeDayStreak: computeActiveDayStreak(trimmed, lastActiveDayKey, dayKey),
    lastActiveDayKey,
    updatedAt: now,
  }
}

export function bumpAnalyticsAnswers(
  state: AnalyticsState,
  {
    clean,
    now = Date.now(),
  }: {
    clean: boolean
    now?: number
  },
): AnalyticsState {
  const dayKey = getDayKey(now)
  const days = [...state.days]
  const index = days.findIndex((day) => day.dayKey === dayKey)
  if (index >= 0) {
    const current = days[index]!
    days[index] = {
      ...current,
      answers: (current.answers ?? 0) + 1,
      cleanAnswers: (current.cleanAnswers ?? 0) + (clean ? 1 : 0),
    }
  } else {
    days.push({
      dayKey,
      totalActiveMs: 0,
      bySection: {},
      answers: 1,
      cleanAnswers: clean ? 1 : 0,
    })
  }
  return {
    ...state,
    days: trimAnalyticsDays(days),
    updatedAt: now,
  }
}
