import type { VocabState } from './types'

/** Saved membership is independent of sets, learned status, definitions and statistics. */
export function setSavedWords(
  vocab: VocabState,
  wordIds: string[],
  saved: boolean,
  now = Date.now(),
): VocabState {
  const ids = new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))
  if (!ids.size) return vocab
  const known = new Set(vocab.myWords)
  const changedIds = [...ids].filter((id) => known.has(id) !== saved)
  if (!changedIds.length) return vocab
  const myWordAddedAt = { ...(vocab.myWordAddedAt ?? {}) }
  for (const id of changedIds) {
    if (saved) myWordAddedAt[id] = now
    else delete myWordAddedAt[id]
  }
  return {
    ...vocab,
    myWords: saved
      ? [...vocab.myWords, ...changedIds]
      : vocab.myWords.filter((id) => !ids.has(id)),
    myWordAddedAt,
  }
}
