export function formatLatency(latencyMs: number): string {
  if (!latencyMs) {
    return '—'
  }
  return `${(latencyMs / 1000).toFixed(1)} с`
}

export function formatKanjiReading(reading: string | null | undefined): string {
  return String(reading ?? '')
    .replace(/^-/, '～')
    .replace(/-$/, '～')
    .replace(/\./g, '·')
}

export function formatKanjiReadings(readings: string[] | null | undefined): string {
  if (!readings?.length) {
    return '—'
  }
  return readings.map(formatKanjiReading).join('、')
}
