import type { LatencyModel, ReviewGrade, VocabDrillMode } from '../types'
import { clamp } from './math'

export const DEFAULT_LATENCY_MODEL: LatencyModel = {
  mu: { romaji: Math.log(1800), choice: Math.log(3200), mixed: Math.log(2800) },
  beta: { romaji: 0.08, choice: 0.04, mixed: 0.05 },
  samples: 0,
  zSamples: [],
}

const MAX_Z_SAMPLES = 120
const EMA = 0.08

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = new Array<number>(b.length + 1)
  const cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j]!
  }
  return prev[b.length]!
}

/** Soft typo: edit distance 1 and same length → hard, not again. */
export function isForgivableTypo(answers: string[], input: string): boolean {
  const normalized = input.trim().toLowerCase()
  if (!normalized) return false
  for (const answer of answers) {
    const target = answer.trim().toLowerCase()
    if (!target || target.length !== normalized.length) continue
    if (levenshtein(normalized, target) === 1) return true
  }
  return false
}

export function expectedLatencyMs(
  model: LatencyModel,
  mode: VocabDrillMode,
  answerLength: number,
): number {
  const mu = model.mu[mode] ?? model.mu.romaji
  const beta = model.beta[mode] ?? model.beta.romaji
  return Math.exp(mu + beta * Math.max(0, answerLength))
}

export function latencyZ(
  model: LatencyModel,
  mode: VocabDrillMode,
  latencyMs: number,
  answerLength: number,
): number {
  const expected = expectedLatencyMs(model, mode, answerLength)
  if (expected <= 0 || latencyMs <= 0) return 0
  return Math.log(latencyMs) - Math.log(expected)
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const idx = clamp(q, 0, 1) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  const t = idx - lo
  return sorted[lo]! * (1 - t) + sorted[hi]! * t
}

export function updateLatencyModel(
  model: LatencyModel,
  mode: VocabDrillMode,
  latencyMs: number,
  answerLength: number,
  clean: boolean,
): LatencyModel {
  if (!clean || latencyMs < 200) return model
  const logT = Math.log(latencyMs)
  const len = Math.max(0, answerLength)
  const mu = { ...model.mu }
  const beta = { ...model.beta }
  const predicted = mu[mode] + beta[mode] * len
  const err = logT - predicted
  // Online updates: shift intercept; lightly adapt slope with length.
  mu[mode] = mu[mode] + EMA * err
  if (len > 0) {
    beta[mode] = clamp(beta[mode] + EMA * 0.25 * err * (len / (len + 4)), 0.01, 0.25)
  }
  const z = err
  const zSamples = [...model.zSamples, z].slice(-MAX_Z_SAMPLES)
  return { mu, beta, samples: model.samples + 1, zSamples }
}

export interface GradeContext {
  wrong: boolean
  hintUsed: boolean
  dontKnow: boolean
  typoForgiven: boolean
  mistakesOnCard: number
  latencyMs: number
  answerLength: number
  mode: VocabDrillMode
  latencyModel: LatencyModel
  /** Recent lapse on this card (within ~8h) blocks easy. */
  hadRecentLapse?: boolean
}

export function deriveGrade(ctx: GradeContext): ReviewGrade {
  if (ctx.wrong || ctx.hintUsed || ctx.dontKnow) return 1
  if (ctx.typoForgiven || ctx.mistakesOnCard > 0) return 2

  const z = latencyZ(ctx.latencyModel, ctx.mode, ctx.latencyMs, ctx.answerLength)
  const sorted = [...ctx.latencyModel.zSamples].sort((a, b) => a - b)
  const p25 = sorted.length >= 8 ? quantile(sorted, 0.25) : -0.35
  const p85 = sorted.length >= 8 ? quantile(sorted, 0.85) : 0.55

  if (z > p85) return 2
  if (z < p25 && !ctx.hadRecentLapse) return 4
  return 3
}

export function drillModeToAspect(mode: VocabDrillMode): 0 | 1 {
  // 0 = recognition (choice/meaning), 1 = production (romaji)
  if (mode === 'romaji') return 1
  if (mode === 'choice') return 0
  return 1
}

export function answerLengthForCard(answers: string[], mode: VocabDrillMode): number {
  if (mode === 'choice') return 6
  const longest = answers.reduce((max, item) => Math.max(max, item.length), 0)
  return Math.max(1, longest)
}
