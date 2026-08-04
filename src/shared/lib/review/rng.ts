/** Mulberry32 — deterministic PRNG for reproducible session picks/tests. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0
  if (state === 0) state = 0x9e3779b9
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sessionSeed(now = Date.now()): number {
  return (now ^ 0xa5a5a5a5) >>> 0
}
