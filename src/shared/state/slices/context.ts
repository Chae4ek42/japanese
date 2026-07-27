import type {
  ContextHistoryPage,
  ContextPreferences,
  ContextSentence,
  ContextSession,
  ContextState,
  ContextTrainingLogEntry,
} from '../../lib/types'

export const DEFAULT_CONTEXT_PREFERENCES: ContextPreferences = {
  groupId: 'family',
  allowOneNewGrammar: true,
  batchSize: 3,
  maxNewPerSentence: 1,
}

const MAX_SESSION_PAGES = 40
const MAX_TRAINING_LOG = 30

function sanitizeStringIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((item): item is string => typeof item === 'string' && item.length > 0))]
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

function sanitizeContextPreferences(raw: unknown, fallback: ContextPreferences): ContextPreferences {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const batchSize = clampInt(source.batchSize, 1, 5, fallback.batchSize)
  const maxNewPerSentence = clampInt(source.maxNewPerSentence, 1, batchSize, fallback.maxNewPerSentence)
  return {
    groupId:
      typeof source.groupId === 'string' && source.groupId.length > 0 ? source.groupId : fallback.groupId,
    allowOneNewGrammar:
      typeof source.allowOneNewGrammar === 'boolean' ? source.allowOneNewGrammar : fallback.allowOneNewGrammar,
    batchSize,
    maxNewPerSentence: Math.min(maxNewPerSentence, batchSize),
  }
}

export function sanitizeOneSentence(item: Record<string, unknown>, fallbackId: string): ContextSentence | null {
  const id = typeof item.id === 'string' ? item.id : fallbackId
  const text = typeof item.text === 'string' ? item.text.trim() : ''
  const glossRu = typeof item.glossRu === 'string' ? item.glossRu.trim() : ''
  if (!text || !glossRu) return null
  return {
    id,
    text,
    reading: typeof item.reading === 'string' ? item.reading : undefined,
    glossRu,
    wordIds: sanitizeStringIdList(item.wordIds),
    grammarIds: sanitizeStringIdList(item.grammarIds),
    themeHints: Array.isArray(item.themeHints)
      ? item.themeHints.filter((hint): hint is string => typeof hint === 'string')
      : undefined,
    source: item.source === 'seed' || item.source === 'tatoeba' || item.source === 'llm' ? item.source : 'llm',
  }
}

function sanitizeGeneratedCache(raw: unknown): Record<string, ContextSentence[]> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, ContextSentence[]> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key) continue
    const list: ContextSentence[] = []
    const seen = new Set<string>()
    const push = (sentence: ContextSentence | null) => {
      if (!sentence || seen.has(sentence.id)) return
      seen.add(sentence.id)
      list.push(sentence)
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!entry || typeof entry !== 'object') continue
        push(sanitizeOneSentence(entry as Record<string, unknown>, key))
      }
    } else if (value && typeof value === 'object') {
      push(sanitizeOneSentence(value as Record<string, unknown>, key))
    }
    if (list.length) result[key] = list.slice(-12)
  }
  return result
}

function sanitizeHistoryPage(raw: unknown): ContextHistoryPage | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const sentenceRaw = source.sentence
  if (!sentenceRaw || typeof sentenceRaw !== 'object') return null
  const sentence = sanitizeOneSentence(sentenceRaw as Record<string, unknown>, 'page')
  if (!sentence) return null
  return {
    sentence,
    revealed: source.revealed === true,
  }
}

export function sanitizeContextSession(raw: unknown): ContextSession | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const groupId = typeof source.groupId === 'string' ? source.groupId : ''
  if (!groupId) return null
  const pagesRaw = Array.isArray(source.pages)
    ? source.pages.map(sanitizeHistoryPage).filter((page): page is ContextHistoryPage => Boolean(page))
    : []
  const pages = pagesRaw.slice(-MAX_SESSION_PAGES)
  const pageIndex = pages.length
    ? clampInt(source.pageIndex, 0, pages.length - 1, pages.length - 1)
    : 0
  const startedAt =
    typeof source.startedAt === 'number' && Number.isFinite(source.startedAt) ? source.startedAt : Date.now()
  const status = source.status === 'done' ? 'done' : 'active'
  return {
    groupId,
    batchIds: sanitizeStringIdList(source.batchIds),
    pages,
    pageIndex,
    recentSentenceIds: sanitizeStringIdList(source.recentSentenceIds).slice(0, 12),
    wordsLearnedIds: sanitizeStringIdList(source.wordsLearnedIds),
    startedAt,
    status,
  }
}

function sanitizeTrainingLogEntry(raw: unknown): ContextTrainingLogEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const id = typeof source.id === 'string' ? source.id : ''
  const groupId = typeof source.groupId === 'string' ? source.groupId : ''
  if (!id || !groupId) return null
  const startedAt =
    typeof source.startedAt === 'number' && Number.isFinite(source.startedAt) ? source.startedAt : Date.now()
  const outcome =
    source.outcome === 'completed' || source.outcome === 'abandoned' || source.outcome === 'active'
      ? source.outcome
      : 'abandoned'
  return {
    id,
    groupId,
    startedAt,
    endedAt:
      typeof source.endedAt === 'number' && Number.isFinite(source.endedAt) ? source.endedAt : undefined,
    wordsLearnedIds: sanitizeStringIdList(source.wordsLearnedIds),
    sentencesSeen: clampInt(source.sentencesSeen, 0, 10_000, 0),
    outcome,
  }
}

export function sanitizeTrainingLog(raw: unknown): ContextTrainingLogEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(sanitizeTrainingLogEntry)
    .filter((entry): entry is ContextTrainingLogEntry => Boolean(entry))
    .slice(-MAX_TRAINING_LOG)
}

export function sanitizeContextState(raw: unknown, fallback: ContextState): ContextState {
  const source = raw && typeof raw === 'object' ? (raw as Partial<ContextState>) : {}
  const knownGrammarIds = sanitizeStringIdList(source.knownGrammarIds)
  return {
    knownWordIds: sanitizeStringIdList(source.knownWordIds),
    knownGrammarIds: knownGrammarIds.length ? knownGrammarIds : [...fallback.knownGrammarIds],
    preferences: sanitizeContextPreferences(source.preferences, fallback.preferences),
    generatedCache: sanitizeGeneratedCache(source.generatedCache),
    session: sanitizeContextSession(source.session),
    trainingLog: sanitizeTrainingLog(source.trainingLog),
  }
}
