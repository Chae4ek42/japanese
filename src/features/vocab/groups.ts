import type { KanjiWord } from '../../shared/lib/types'
import { getWordsByIds } from '../../data/words/bank'
import groupsData from './groups.json' with { type: 'json' }

export interface VocabGroup {
  id: string
  label: string
  wordIds: string[]
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
