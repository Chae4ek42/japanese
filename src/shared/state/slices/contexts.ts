import type { ContextState, WordContext } from '../../lib/types'

export const MAX_WORD_CONTEXTS = 500
export const DEFAULT_CONTEXT_STATE: ContextState = { examples: [], stats: {} }

export function sanitizeContextState(raw: unknown): ContextState {
  const source = raw && typeof raw === 'object' ? raw as Partial<ContextState> : {}
  const seen = new Set<string>()
  const examples: WordContext[] = []
  for (const item of Array.isArray(source.examples) ? source.examples : []) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || seen.has(item.id)) continue
    if (typeof item.wordId !== 'string' || !item.wordId || typeof item.sentence !== 'string' || !item.sentence.trim()) continue
    const sentence = item.sentence.slice(0, 2000)
    if (typeof item.surface !== 'string' || !item.surface || !sentence.includes(item.surface)) continue
    seen.add(item.id)
    examples.push({ id: item.id, wordId: item.wordId, sentence, surface: item.surface,
      sourceKind: item.sourceKind === 'reader' || item.sourceKind === 'theory' ? item.sourceKind : 'manual',
      createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? Math.max(0, item.createdAt) : 0,
      ...Object.fromEntries(['reading', 'meaning', 'translation', 'sourceId', 'sourceTitle'].flatMap((key) => {
        const value = item[key as keyof WordContext]
        return typeof value === 'string' && value.trim() ? [[key, value.slice(0, 2000)]] : []
      })),
    })
    if (examples.length >= MAX_WORD_CONTEXTS) break
  }
  const stats: ContextState['stats'] = {}
  for (const [id, item] of Object.entries(source.stats ?? {})) {
    if (!seen.has(id) || !item || typeof item !== 'object') continue
    const count = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
    const attempts = count(item.attempts)
    stats[id] = { attempts, correct: Math.min(attempts, count(item.correct)), lastAt: count(item.lastAt) }
  }
  return { examples, stats }
}
