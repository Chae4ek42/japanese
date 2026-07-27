import type { ContextSentence } from '../../../shared/lib/types'
import sentencesBundle from './sentences.json' with { type: 'json' }
import sentencesByWord from './sentences-by-word.json' with { type: 'json' }

interface SentencesBundle {
  builtAt: string
  counts: Record<string, number>
  sentences: ContextSentence[]
}

const bundle = sentencesBundle as SentencesBundle
const byWordIndex = sentencesByWord as Record<string, string[]>

export const CONTEXT_SENTENCES: ContextSentence[] = bundle.sentences
export const CONTEXT_SENTENCES_META = {
  builtAt: bundle.builtAt,
  counts: bundle.counts,
}

const byId = new Map(CONTEXT_SENTENCES.map((item) => [item.id, item]))

export function getContextSentence(id: string): ContextSentence | null {
  return byId.get(id) ?? null
}

export function getSentencesForWord(wordId: string): ContextSentence[] {
  const ids = byWordIndex[wordId] ?? []
  return ids.map((id) => byId.get(id)).filter((item): item is ContextSentence => Boolean(item))
}

export function listAllContextSentences(): ContextSentence[] {
  return CONTEXT_SENTENCES
}
