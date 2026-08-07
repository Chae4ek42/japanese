import type { KanjiWord } from '../../shared/lib/types'
import { getWordsByIds } from '../../data/words/bank'
import groupsData from './groups.json' with { type: 'json' }

export type VocabGroupKind = 'reading' | 'theme'

/** Standalone catalog/training entity — browse, train-by-group, or add whole set. */
export interface VocabGroup {
  id: string
  label: string
  wordIds: string[]
  kind?: VocabGroupKind
  description?: string
}

export const VOCAB_GROUPS = groupsData as VocabGroup[]

export function getVocabGroup(id: string): VocabGroup | null {
  return VOCAB_GROUPS.find((group) => group.id === id) ?? null
}

export function getWordsForGroup(groupId: string): KanjiWord[] {
  const group = getVocabGroup(groupId)
  if (!group) return []
  return getWordsByIds(group.wordIds)
}

export function groupKind(group: VocabGroup): VocabGroupKind {
  if (group.kind === 'reading' || group.kind === 'theme') return group.kind
  return group.id.startsWith('reading-') ? 'reading' : 'theme'
}

export function getVocabGroupsByKind(kind: VocabGroupKind): VocabGroup[] {
  return VOCAB_GROUPS.filter((group) => groupKind(group) === kind)
}

/** Expand group membership to include all variant ids of each word (for training set). */
export function collectGroupTrainingIds(group: VocabGroup): string[] {
  const words = getWordsForGroup(group.id)
  const ids = new Set<string>()
  for (const word of words) {
    if (word.id) ids.add(word.id)
    for (const id of word.variantIds ?? []) {
      if (id) ids.add(id)
    }
    for (const reading of word.readings ?? []) {
      if (reading.id) ids.add(reading.id)
    }
  }
  // Fallback when bank resolution failed for some stored ids.
  for (const id of group.wordIds) {
    if (id) ids.add(id)
  }
  return [...ids]
}
