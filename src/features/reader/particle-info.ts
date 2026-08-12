import { PARTICLE_LABELS, PARTICLE_ROMAJI, type CoreParticle } from '../../data/particles'
import { PARTICLE_TOPICS } from '../../data/cheatSheets'
import type { CheatSheetTopic } from '../../data/cheatSheets'

const TOPIC_BY_BADGE = new Map(PARTICLE_TOPICS.map((topic) => [topic.badge, topic]))

export interface ParticleInfo {
  surface: string
  reading: string
  shortLabel: string
  title: string
  lead: string
  topic: CheatSheetTopic | null
  /** Up to a few showcase examples for the side panel. */
  examples: { jp: string; gloss: string }[]
}

function isCoreParticle(surface: string): surface is CoreParticle {
  return Object.prototype.hasOwnProperty.call(PARTICLE_LABELS, surface)
}

/** Resolve particle gloss for the reader side panel. */
export function lookupParticleInfo(surface: string): ParticleInfo | null {
  const trimmed = surface.trim()
  if (!trimmed) return null

  const topic = TOPIC_BY_BADGE.get(trimmed) ?? null
  const core = isCoreParticle(trimmed)

  if (!topic && !core) return null

  const examples =
    topic?.senses
      .flatMap((sense) => sense.examples)
      .slice(0, 4)
      .map((example) => ({ jp: example.jp, gloss: example.gloss })) ?? []

  return {
    surface: trimmed,
    reading: topic?.reading || (core ? PARTICLE_ROMAJI[trimmed] : ''),
    shortLabel: core ? PARTICLE_LABELS[trimmed] : topic?.title || trimmed,
    title: topic?.title || (core ? PARTICLE_LABELS[trimmed] : 'Частица'),
    lead: topic?.lead || '',
    topic,
    examples,
  }
}
