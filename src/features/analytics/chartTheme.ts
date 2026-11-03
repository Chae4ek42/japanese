import type { AnalyticsSection } from '../../shared/lib/types'

export const CHART_COLORS = {
  primary: '#527398',
  secondary: '#557b67',
  accent: '#986464',
  muted: '#94a3b8',
  weak: '#a66d6d',
  learning: '#7c8fa5',
  strong: '#638873',
  grid: 'rgba(17, 17, 17, 0.08)',
  text: '#334155',
}

export const SECTION_LABELS: Record<AnalyticsSection, string> = {
  home: 'Прочее',
  kana: 'Кана',
  kanji: 'Кандзи',
  numbers: 'Числа',
  particles: 'Частицы',
  verbs: 'Глаголы',
  reader: 'Текст',
  train: 'Слова',
  vocab: 'Словарь',
  mine: 'Мои слова',
  theory: 'Теория',
}

export const SECTION_COLORS: Record<AnalyticsSection, string> = {
  home: '#94a3b8',
  kana: '#527398',
  kanji: '#798b9e',
  numbers: '#557b67',
  particles: '#8c949b',
  verbs: '#717b85',
  reader: '#647e96',
  train: '#986464',
  vocab: '#6c8b78',
  mine: '#a58080',
  theory: '#8a9c91',
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
