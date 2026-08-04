export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function hoursBetween(fromMs: number, toMs: number): number {
  if (!fromMs || !toMs || toMs < fromMs) return 0
  return (toMs - fromMs) / 3_600_000
}
