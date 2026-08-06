import type { MemoryState, ReviewPlanKnobs, VocabCard } from '../types'
import {
  itemValueFromHints,
  memoryKey,
  migrateFromMastery,
  type PriorDifficultyHints,
  retentionAt,
  urgency,
} from './memory'
import type { StatsRecord } from '../types'
import type { ReviewAspect } from '../types'

export const DEFAULT_REVIEW_KNOBS: ReviewPlanKnobs = {
  targetRetention: 0.9,
  newPerDay: 10,
  sessionMinutes: 15,
}

export function clampReviewKnobs(raw: Partial<ReviewPlanKnobs> | undefined): ReviewPlanKnobs {
  const base = DEFAULT_REVIEW_KNOBS
  const targetRetention =
    typeof raw?.targetRetention === 'number' && Number.isFinite(raw.targetRetention)
      ? Math.min(0.95, Math.max(0.85, raw.targetRetention))
      : base.targetRetention
  const newPerDay =
    typeof raw?.newPerDay === 'number' && Number.isFinite(raw.newPerDay)
      ? Math.min(50, Math.max(0, Math.round(raw.newPerDay)))
      : base.newPerDay
  const sessionMinutes =
    typeof raw?.sessionMinutes === 'number' && Number.isFinite(raw.sessionMinutes)
      ? Math.min(60, Math.max(5, Math.round(raw.sessionMinutes)))
      : base.sessionMinutes
  return { targetRetention, newPerDay, sessionMinutes }
}

export interface PlanCardMeta {
  id: string
  hints?: PriorDifficultyHints
  /** Earliest time this card entered «Мои слова» (ms). Orders new-card intake. */
  addedAt?: number
}

export interface BuildPlanInput {
  scope: PlanCardMeta[]
  memory: Record<string, MemoryState>
  stats?: Record<string, StatsRecord>
  aspect: ReviewAspect
  knobs: ReviewPlanKnobs
  now?: number
  /** New cards already introduced today (persisted counter). */
  newUsedToday?: number
  /** Optional per-card session multipliers (0 excludes). */
  weightMultipliers?: Record<string, number>
  /** Average answer latency for converting minutes → answer budget. */
  avgLatencyMs?: number
  /** even mode: ignore retention urgency, keep scope order. */
  even?: boolean
}

export interface SessionPlan {
  planIds: string[]
  dueCount: number
  newCount: number
  learningCount: number
  targetAnswers: number
  backlog: number
  /** True when nothing due and no new intake. */
  empty: boolean
}

function resolveMemory(
  memory: Record<string, MemoryState>,
  stats: Record<string, StatsRecord> | undefined,
  cardId: string,
  aspect: ReviewAspect,
  now: number,
  createdAt?: number,
): MemoryState {
  const key = memoryKey(cardId, aspect)
  if (memory[key]) return memory[key]!
  // Fallback: shared key without aspect, then mastery migration.
  if (memory[cardId]) return memory[cardId]!
  if (stats?.[cardId]) return migrateFromMastery(stats[cardId]!, now)
  return {
    s: 0,
    d: 0.3,
    lastAt: 0,
    lastPresentedAt: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    uncertain: false,
    modelVersion: 1,
    createdAt: createdAt && createdAt > 0 ? createdAt : now,
  }
}

export function estimateTargetAnswers(sessionMinutes: number, avgLatencyMs = 2800): number {
  // Include think/UI overhead so a 15‑minute session is ~40–60 answers, not 200+.
  const perAnswerSec = Math.max(8, (avgLatencyMs || 2800) / 1000 + 6)
  return Math.max(8, Math.round((sessionMinutes * 60) / perAnswerSec))
}

export function buildSessionPlan(input: BuildPlanInput): SessionPlan {
  const now = input.now ?? Date.now()
  const knobs = clampReviewKnobs(input.knobs)
  const weights = input.weightMultipliers ?? {}
  const newUsedToday = Math.max(0, input.newUsedToday ?? 0)
  const targetAnswers = estimateTargetAnswers(knobs.sessionMinutes, input.avgLatencyMs)

  if (input.even) {
    const planIds = input.scope
      .map((card) => card.id)
      .filter((id) => (weights[id] ?? 1) > 0)
    return {
      planIds,
      dueCount: 0,
      newCount: planIds.length,
      learningCount: 0,
      targetAnswers,
      backlog: 0,
      empty: planIds.length === 0,
    }
  }

  type Ranked = { id: string; urgency: number; kind: 'due' | 'learning' | 'new'; addedAt: number }
  const due: Ranked[] = []
  const learning: Ranked[] = []
  const fresh: Ranked[] = []

  for (const card of input.scope) {
    if ((weights[card.id] ?? 1) <= 0) continue
    const addedAt =
      typeof card.addedAt === 'number' && Number.isFinite(card.addedAt) ? card.addedAt : Number.POSITIVE_INFINITY
    const mem = resolveMemory(input.memory, input.stats, card.id, input.aspect, now, card.addedAt)
    const value = itemValueFromHints(card.hints) * (weights[card.id] ?? 1)
    if (mem.state === 'leech' && mem.leechUntil && mem.leechUntil > now) continue

    if (mem.state === 'new') {
      fresh.push({ id: card.id, urgency: value, kind: 'new', addedAt })
      continue
    }

    if (mem.state === 'learning' || mem.state === 'relearning') {
      learning.push({
        id: card.id,
        urgency: urgency(mem, now, knobs.targetRetention, value),
        kind: 'learning',
        addedAt,
      })
      continue
    }

    const R = retentionAt(mem, now)
    if (R < knobs.targetRetention) {
      due.push({
        id: card.id,
        urgency: urgency(mem, now, knobs.targetRetention, value),
        kind: 'due',
        addedAt,
      })
    }
  }

  due.sort((a, b) => b.urgency - a.urgency)
  learning.sort((a, b) => b.urgency - a.urgency)

  const backlog = due.length + learning.length
  let newIntake = Math.max(0, knobs.newPerDay - newUsedToday)
  // Pause new cards when the review pile is already a heavy day.
  if (backlog > Math.max(15, knobs.newPerDay * 1.5)) newIntake = 0
  // Cap new cards relative to session length (no tiny hard ceiling of 5 —
  // that left mine sessions looping a handful of cards for the whole run).
  const sessionNewCap = Math.max(6, Math.floor(targetAnswers / 3))
  newIntake = Math.min(newIntake, sessionNewCap)

  // New intake: oldest «Мои слова» first, then higher item value.
  fresh.sort((a, b) => {
    if (a.addedAt !== b.addedAt) return a.addedAt - b.addedAt
    return b.urgency - a.urgency
  })
  const takenNew = fresh.slice(0, newIntake)

  // Interleave: learning first (active), then due by urgency, then new.
  const planIds = [
    ...learning.map((item) => item.id),
    ...due.map((item) => item.id),
    ...takenNew.map((item) => item.id),
  ]

  // Cap plan size roughly to what fits in the session (with reintroductions).
  const capped = planIds.slice(0, Math.max(targetAnswers, IN_FLIGHT_SOFT_CAP))

  return {
    planIds: capped,
    dueCount: due.length,
    newCount: takenNew.length,
    learningCount: learning.length,
    targetAnswers,
    backlog,
    empty: capped.length === 0,
  }
}

const IN_FLIGHT_SOFT_CAP = 40

export function cardHintsFromVocab(card: VocabCard): PriorDifficultyHints {
  return {
    jlpt: card.jlpt,
    readingsCount: card.readings?.length || card.answers.length || 1,
    popularity: card.jlpt ? (6 - card.jlpt) / 5 : 0.5,
  }
}
