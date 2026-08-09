import { KANJI_LIST, getJoyoKanji } from '../../data/words/bank'
import { getTopConfusions } from '../../shared/lib/trainer'
import { getDayKey } from '../../shared/lib/trainer'
import { isDue } from '../../shared/lib/review/memory'
import type {
  AnalyticsDayBucket,
  AnalyticsSection,
  AppState,
  MemoryState,
  PracticeHistory,
  StatsRecord,
} from '../../shared/lib/types'
import { ANALYTICS_SECTIONS } from '../../shared/state/slices/analytics'
import { SECTION_LABELS, formatMinutes } from './chartTheme'

export function sumLastDays(days: AnalyticsDayBucket[], n: number, now = Date.now()): number {
  const keys = new Set<string>()
  for (let i = 0; i < n; i += 1) {
    keys.add(getDayKey(now - i * 86_400_000))
  }
  return days.reduce((sum, day) => (keys.has(day.dayKey) ? sum + day.totalActiveMs : sum), 0)
}

export function todayBucket(days: AnalyticsDayBucket[], now = Date.now()): AnalyticsDayBucket | null {
  const key = getDayKey(now)
  return days.find((day) => day.dayKey === key) ?? null
}

export function buildActivitySeries(days: AnalyticsDayBucket[], length = 30, now = Date.now()) {
  const byKey = new Map(days.map((day) => [day.dayKey, day]))
  const series: Array<{ dayKey: string; minutes: number; answers: number; cleanAnswers: number }> = []
  for (let i = length - 1; i >= 0; i -= 1) {
    const dayKey = getDayKey(now - i * 86_400_000)
    const bucket = byKey.get(dayKey)
    series.push({
      dayKey,
      minutes: formatMinutes(bucket?.totalActiveMs ?? 0),
      answers: bucket?.answers ?? 0,
      cleanAnswers: bucket?.cleanAnswers ?? 0,
    })
  }
  return series
}

export function buildSectionLifetime(bySection: Record<AnalyticsSection, number>) {
  return ANALYTICS_SECTIONS.map((section) => ({
    section,
    name: SECTION_LABELS[section],
    ms: bySection[section] ?? 0,
    minutes: formatMinutes(bySection[section] ?? 0),
  })).filter((row) => row.ms > 0)
}

export function buildStackedSectionDays(days: AnalyticsDayBucket[], length = 14, now = Date.now()) {
  const byKey = new Map(days.map((day) => [day.dayKey, day]))
  const rows: Array<Record<string, string | number>> = []
  for (let i = length - 1; i >= 0; i -= 1) {
    const dayKey = getDayKey(now - i * 86_400_000)
    const bucket = byKey.get(dayKey)
    const row: Record<string, string | number> = { dayKey }
    for (const section of ANALYTICS_SECTIONS) {
      row[section] = formatMinutes(bucket?.bySection[section] ?? 0)
    }
    rows.push(row)
  }
  return rows
}

export function aggregateStatsMap(stats: Record<string, StatsRecord>) {
  let clears = 0
  let errors = 0
  let hints = 0
  let exposures = 0
  let touched = 0
  const mastery = { weak: 0, learning: 0, strong: 0, untouched: 0 }
  const accuracyBuckets = [
    { name: '0–40%', count: 0 },
    { name: '40–70%', count: 0 },
    { name: '70–90%', count: 0 },
    { name: '90–100%', count: 0 },
  ]

  for (const record of Object.values(stats)) {
    clears += record.clears
    errors += record.errors
    hints += record.hints
    exposures += record.exposures
    const events = record.clears + record.errors + record.hints
    if (record.exposures > 0 || events > 0) touched += 1
    else {
      mastery.untouched += 1
      continue
    }
    if (record.mastery < 0.4) mastery.weak += 1
    else if (record.mastery < 0.7) mastery.learning += 1
    else mastery.strong += 1

    const acc = record.eventAccuracy
    if (acc < 40) accuracyBuckets[0]!.count += 1
    else if (acc < 70) accuracyBuckets[1]!.count += 1
    else if (acc < 90) accuracyBuckets[2]!.count += 1
    else accuracyBuckets[3]!.count += 1
  }

  const resolved = clears + errors + hints
  return {
    clears,
    errors,
    hints,
    exposures,
    touched,
    accuracy: resolved ? Math.round((clears / resolved) * 100) : null,
    mastery,
    accuracyBuckets,
    clearsVsErrors: [
      { name: 'Верно', count: clears },
      { name: 'Ошибки', count: errors },
      { name: 'Подсказки', count: hints },
    ],
  }
}

export function aggregateMemoryStates(
  memory: Record<string, MemoryState>,
  targetRetention: number,
  now = Date.now(),
) {
  const counts = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
    leech: 0,
    due: 0,
  }
  for (const mem of Object.values(memory)) {
    counts[mem.state] += 1
    if (isDue(mem, now, targetRetention)) counts.due += 1
  }
  return {
    counts,
    pie: [
      { name: 'Новые', value: counts.new },
      { name: 'Учатся', value: counts.learning },
      { name: 'Повтор', value: counts.review },
      { name: 'Переучёба', value: counts.relearning },
      { name: 'Пиявки', value: counts.leech },
    ].filter((row) => row.value > 0),
  }
}

export function aggregateKanjiLearned(learned: string[]) {
  const learnedSet = new Set(learned)
  const levels = [5, 4, 3, 2, 1] as const
  const byLevel = levels.map((level) => {
    const total = KANJI_LIST.filter((item) => item.level === level).length
    const done = KANJI_LIST.filter((item) => item.level === level && learnedSet.has(item.character)).length
    return {
      name: `N${level}`,
      learned: done,
      remaining: Math.max(0, total - done),
      total,
    }
  })
  const joyoTotal = getJoyoKanji().length
  const joyoLearned = getJoyoKanji().filter((item) => learnedSet.has(item.character)).length
  return {
    totalLearned: learned.length,
    bankTotal: KANJI_LIST.length,
    byLevel,
    joyo: { learned: joyoLearned, total: joyoTotal },
  }
}

export function aggregateKana(history: PracticeHistory, stats: Record<string, StatsRecord>) {
  const base = aggregateStatsMap(stats)
  const confusions = getTopConfusions(history, 8).map((entry) => ({
    name: `${entry.fromId}→${entry.toId}`,
    count: entry.count,
  }))
  return { ...base, confusions }
}

export function buildAnalyticsViewModel(state: AppState, now = Date.now()) {
  const { analytics } = state
  const today = todayBucket(analytics.days, now)
  const activity = buildActivitySeries(analytics.days, 30, now)
  const sections = buildSectionLifetime(analytics.bySection)
  const stacked = buildStackedSectionDays(analytics.days, 14, now)
  const vocabStats = aggregateStatsMap(state.vocab.stats)
  const memory = aggregateMemoryStates(
    state.vocab.memory,
    state.vocab.preferences.targetRetention ?? 0.9,
    now,
  )
  const kanji = aggregateKanjiLearned(state.kanji.learned)
  const kana = aggregateKana(state.kana.history, state.kana.stats)
  const numbers = aggregateStatsMap(state.numbers.stats)

  return {
    overview: {
      todayMs: today?.totalActiveMs ?? 0,
      weekMs: sumLastDays(analytics.days, 7, now),
      lifetimeMs: analytics.lifetimeActiveMs,
      streak: analytics.activeDayStreak,
      todayAnswers: today?.answers ?? 0,
    },
    activity,
    sections,
    stacked,
    historyRows: [...analytics.days].sort((a, b) => b.dayKey.localeCompare(a.dayKey)).slice(0, 14),
    vocab: {
      ...vocabStats,
      memory,
      myWords: state.vocab.myWords.length,
      learned: state.vocab.learnedWordIds.length,
      problem: state.vocab.problemWordIds.length,
      newToday: state.vocab.reviewDay.newIntroduced,
    },
    kanji,
    kana,
    numbers,
  }
}

export type AnalyticsViewModel = ReturnType<typeof buildAnalyticsViewModel>
