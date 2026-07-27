import type {
  ContextHistoryPage,
  ContextSession,
  ContextSentence,
  ContextTrainingLogEntry,
  KanjiWord,
} from '../../shared/lib/types'
import type { GrammarPoint } from './grammar'

export const MAX_SESSION_PAGES = 40

export function createEmptySession(groupId: string, batchIds: string[], now = Date.now()): ContextSession {
  return {
    groupId,
    batchIds,
    pages: [],
    pageIndex: 0,
    recentSentenceIds: [],
    wordsLearnedIds: [],
    startedAt: now,
    status: 'active',
  }
}

export function createTrainingLogEntry(
  session: ContextSession,
  outcome: ContextTrainingLogEntry['outcome'],
  now = Date.now(),
): ContextTrainingLogEntry {
  return {
    id: `ctx-${session.startedAt}`,
    groupId: session.groupId,
    startedAt: session.startedAt,
    endedAt: outcome === 'active' ? undefined : now,
    wordsLearnedIds: [...session.wordsLearnedIds],
    sentencesSeen: session.pages.length,
    outcome,
  }
}

export function currentPage(session: ContextSession): ContextHistoryPage | null {
  if (!session.pages.length) return null
  const index = Math.min(Math.max(0, session.pageIndex), session.pages.length - 1)
  return session.pages[index] ?? null
}

export function canGoPrev(session: ContextSession): boolean {
  return session.pageIndex > 0 && session.pages.length > 0
}

export function canGoNextInHistory(session: ContextSession): boolean {
  return session.pageIndex >= 0 && session.pageIndex < session.pages.length - 1
}

/** Move to previous page; preserves revealed flags. */
export function goPrevPage(session: ContextSession): ContextSession {
  if (!canGoPrev(session)) return session
  return { ...session, pageIndex: session.pageIndex - 1 }
}

/** Move forward within existing history (no new pick). */
export function goNextInHistory(session: ContextSession): ContextSession {
  if (!canGoNextInHistory(session)) return session
  return { ...session, pageIndex: session.pageIndex + 1 }
}

export function setPageRevealed(session: ContextSession, revealed: boolean): ContextSession {
  if (!session.pages.length) return session
  const index = Math.min(Math.max(0, session.pageIndex), session.pages.length - 1)
  const pages = session.pages.map((page, i) => (i === index ? { ...page, revealed } : page))
  return { ...session, pages }
}

export function togglePageRevealed(session: ContextSession): ContextSession {
  const page = currentPage(session)
  if (!page) return session
  return setPageRevealed(session, !page.revealed)
}

/**
 * Append a new sentence at the tip without truncating earlier pages.
 * Jumps pageIndex to the new tip.
 */
export function appendSentencePage(
  session: ContextSession,
  sentence: ContextSentence,
  { revealed = false }: { revealed?: boolean } = {},
): ContextSession {
  const tip = session.pages[session.pages.length - 1]
  const pages =
    tip?.sentence.id === sentence.id
      ? session.pages
      : [...session.pages, { sentence, revealed }].slice(-MAX_SESSION_PAGES)
  const recentSentenceIds = [
    sentence.id,
    ...session.recentSentenceIds.filter((id) => id !== sentence.id),
  ].slice(0, 12)
  return {
    ...session,
    pages,
    pageIndex: pages.length - 1,
    recentSentenceIds,
    status: 'active',
  }
}

export function withBatchIds(session: ContextSession, batchIds: string[]): ContextSession {
  return { ...session, batchIds }
}

export function recordWordsLearned(session: ContextSession, wordIds: string[]): ContextSession {
  const learned = new Set(session.wordsLearnedIds)
  for (const id of wordIds) {
    if (id) learned.add(id)
  }
  return { ...session, wordsLearnedIds: [...learned] }
}

export function markSessionDone(session: ContextSession): ContextSession {
  return { ...session, status: 'done', batchIds: [] }
}

/**
 * After marking some words known: if the current sentence still has unknowns
 * from the (updated) batch relative to knownSet, stay on the same page.
 */
export function sentenceStillHasBatchUnknowns(
  sentence: ContextSentence,
  batchIds: string[],
  knownWordIds: Iterable<string>,
): boolean {
  const known = new Set(knownWordIds)
  const batch = new Set(batchIds)
  return sentence.wordIds.some((id) => !known.has(id) && batch.has(id))
}

export function pickRandomUnknownWord(
  groupWords: KanjiWord[],
  knownWordIds: Iterable<string>,
  batchIds: string[],
): KanjiWord | null {
  const known = new Set(knownWordIds)
  const inBatch = new Set(batchIds)
  const candidates = groupWords.filter((word) => word.id && !known.has(word.id) && !inBatch.has(word.id))
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null
}

/** Add word to batch; if full (cap 5), replace a random slot not in protectIds. */
export function addWordToBatch(
  batchIds: string[],
  wordId: string,
  {
    maxSize = 5,
    protectIds = [],
  }: { maxSize?: number; protectIds?: string[] } = {},
): string[] {
  if (!wordId || batchIds.includes(wordId)) return batchIds
  if (batchIds.length < maxSize) return [...batchIds, wordId]
  const protectedSet = new Set(protectIds)
  const replaceable = batchIds
    .map((id, index) => ({ id, index }))
    .filter((item) => !protectedSet.has(item.id))
  const pick = replaceable.length
    ? replaceable[Math.floor(Math.random() * replaceable.length)]
    : { id: batchIds[0], index: 0 }
  if (!pick) return batchIds
  const next = [...batchIds]
  next[pick.index] = wordId
  return next
}

export function pickRandomUnknownGrammar(
  catalog: GrammarPoint[],
  knownGrammarIds: Iterable<string>,
): GrammarPoint | null {
  const known = new Set(knownGrammarIds)
  const candidates = catalog.filter((item) => !known.has(item.id))
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null
}
