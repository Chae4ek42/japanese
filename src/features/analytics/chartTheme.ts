import type { AnalyticsSection } from '../../shared/lib/types'

export const CHART_COLORS = {
  primary: '#2563eb',
  secondary: '#0f766e',
  accent: '#c2410c',
  muted: '#94a3b8',
  weak: '#dc2626',
  learning: '#d97706',
  strong: '#16a34a',
  grid: 'rgba(17, 17, 17, 0.08)',
  text: '#334155',
}

export const SECTION_LABELS: Record<AnalyticsSection, string> = {
  home: 'Прочее',
  kana: 'Кана',
  kanji: 'Кандзи',
  numbers: 'Числа',
  train: 'Слова',
  vocab: 'Словарь',
  mine: 'Мои слова',
  context: 'Контекст',
}

export const SECTION_COLORS: Record<AnalyticsSection, string> = {
  home: '#94a3b8',
  kana: '#2563eb',
  kanji: '#7c3aed',
  numbers: '#0f766e',
  train: '#c2410c',
  vocab: '#0891b2',
  mine: '#db2777',
  context: '#ca8a04',
}

export function formatDurationMs(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours <= 0) return `${minutes} мин`
  return `${hours} ч ${minutes} мин`
}

export function formatMinutes(ms: number): number {
  return Math.round(Math.max(0, ms) / 60_000)
}

export function shortDayLabel(dayKey: string): string {
  const [, m, d] = dayKey.split('-')
  return `${Number(d)}.${Number(m)}`
}
