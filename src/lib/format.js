export function formatLatency(latencyMs) {
  if (!latencyMs) {
    return '—'
  }
  return `${(latencyMs / 1000).toFixed(1)} с`
}
