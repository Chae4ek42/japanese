export function formatLatency(latencyMs) {
  if (!latencyMs) {
    return '—'
  }
  return `${(latencyMs / 1000).toFixed(1)} с`
}

/**
 * Точка в кунъёми (い.やす) — не опечатка: отделяет чтение кандзи от окуриганы.
 * Показываем как «и·yasu», префиксы/суффиксы «-» → «～».
 */
export function formatKanjiReading(reading) {
  return String(reading ?? '')
    .replace(/^-/, '～')
    .replace(/-$/, '～')
    .replace(/\./g, '·')
}

export function formatKanjiReadings(readings) {
  if (!readings?.length) {
    return '—'
  }
  return readings.map(formatKanjiReading).join('、')
}
