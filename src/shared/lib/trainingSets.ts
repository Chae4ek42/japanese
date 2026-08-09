import type { VocabTrainingSet } from './types'

export const MAIN_TRAINING_SET_ID = 'main'

export function createMainTrainingSet(wordIds: string[] = [], now = Date.now()): VocabTrainingSet {
  return {
    id: MAIN_TRAINING_SET_ID,
    name: 'Основной',
    wordIds: [...new Set(wordIds.filter((id) => typeof id === 'string' && id.length > 0))],
    createdAt: now,
    updatedAt: now,
  }
}

export function newTrainingSetId(): string {
  return `set_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function sanitizeWordIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [
    ...new Set(raw.filter((item): item is string => typeof item === 'string' && item.length > 0)),
  ]
}

export function sanitizeTrainingSet(raw: unknown, now = Date.now()): VocabTrainingSet | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : ''
  if (!id) return null
  const nameRaw = typeof source.name === 'string' ? source.name.trim() : ''
  const name = nameRaw || (id === MAIN_TRAINING_SET_ID ? 'Основной' : 'Набор')
  const createdAt =
    typeof source.createdAt === 'number' && Number.isFinite(source.createdAt)
      ? source.createdAt
      : now
  const updatedAt =
    typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt)
      ? source.updatedAt
      : createdAt
  return {
    id,
    name,
    wordIds: sanitizeWordIdList(source.wordIds),
    createdAt,
    updatedAt,
  }
}

/** Ensure main exists; migrate legacy flat trainingWordIds when sets missing. */
export function sanitizeTrainingSets(
  rawSets: unknown,
  legacyTrainingWordIds: unknown,
  fallbackSets: VocabTrainingSet[],
  now = Date.now(),
): VocabTrainingSet[] {
  const parsed = Array.isArray(rawSets)
    ? rawSets
        .map((item) => sanitizeTrainingSet(item, now))
        .filter((item): item is VocabTrainingSet => item !== null)
    : []

  if (!parsed.length) {
    const legacy = sanitizeWordIdList(legacyTrainingWordIds)
    if (fallbackSets.length) {
      const main = fallbackSets.find((set) => set.id === MAIN_TRAINING_SET_ID)
      if (main && legacy.length && !main.wordIds.length) {
        return fallbackSets.map((set) =>
          set.id === MAIN_TRAINING_SET_ID ? { ...set, wordIds: legacy, updatedAt: now } : set,
        )
      }
      return fallbackSets.map((set) => ({ ...set, wordIds: [...set.wordIds] }))
    }
    return [createMainTrainingSet(legacy, now)]
  }

  const byId = new Map<string, VocabTrainingSet>()
  for (const set of parsed) {
    if (!byId.has(set.id)) byId.set(set.id, set)
  }
  if (!byId.has(MAIN_TRAINING_SET_ID)) {
    byId.set(MAIN_TRAINING_SET_ID, createMainTrainingSet([], now))
  }

  // Stable order: main first, then others by createdAt.
  const rest = [...byId.values()]
    .filter((set) => set.id !== MAIN_TRAINING_SET_ID)
    .sort((a, b) => a.createdAt - b.createdAt)
  return [byId.get(MAIN_TRAINING_SET_ID)!, ...rest]
}

export function resolveActiveTrainingSetId(
  rawId: unknown,
  sets: VocabTrainingSet[],
): string {
  if (typeof rawId === 'string' && sets.some((set) => set.id === rawId)) return rawId
  return MAIN_TRAINING_SET_ID
}

export function getTrainingSet(
  sets: VocabTrainingSet[],
  setId: string | null | undefined,
): VocabTrainingSet | null {
  if (!setId) return null
  return sets.find((set) => set.id === setId) ?? null
}

export function getTrainingSetWordIds(
  sets: VocabTrainingSet[],
  setId: string | null | undefined,
): string[] {
  return getTrainingSet(sets, setId)?.wordIds ?? []
}

export function patchTrainingSetWords(
  sets: VocabTrainingSet[],
  setId: string,
  wordIds: string[],
  now = Date.now(),
): VocabTrainingSet[] {
  return sets.map((set) =>
    set.id === setId ? { ...set, wordIds, updatedAt: now } : set,
  )
}

export function addWordsToTrainingSet(
  sets: VocabTrainingSet[],
  setId: string,
  wordIds: string[],
  now = Date.now(),
): VocabTrainingSet[] {
  const target = getTrainingSet(sets, setId)
  if (!target) return sets
  const known = new Set(target.wordIds)
  const toAdd = wordIds.filter((id) => id && !known.has(id))
  if (!toAdd.length) return sets
  return patchTrainingSetWords(sets, setId, [...target.wordIds, ...toAdd], now)
}

export function removeWordsFromTrainingSet(
  sets: VocabTrainingSet[],
  setId: string,
  wordIds: string[],
  now = Date.now(),
): VocabTrainingSet[] {
  const drop = new Set(wordIds)
  const target = getTrainingSet(sets, setId)
  if (!target || !drop.size) return sets
  const next = target.wordIds.filter((id) => !drop.has(id))
  if (next.length === target.wordIds.length) return sets
  return patchTrainingSetWords(sets, setId, next, now)
}

export function removeWordsFromAllTrainingSets(
  sets: VocabTrainingSet[],
  wordIds: string[],
  now = Date.now(),
): VocabTrainingSet[] {
  const drop = new Set(wordIds)
  if (!drop.size) return sets
  let changed = false
  const next = sets.map((set) => {
    const wordIdsNext = set.wordIds.filter((id) => !drop.has(id))
    if (wordIdsNext.length === set.wordIds.length) return set
    changed = true
    return { ...set, wordIds: wordIdsNext, updatedAt: now }
  })
  return changed ? next : sets
}

export function moveWordsBetweenTrainingSets(
  sets: VocabTrainingSet[],
  {
    fromSetId,
    toSetId,
    wordIds,
  }: {
    fromSetId: string
    toSetId: string
    wordIds: string[]
  },
  now = Date.now(),
): VocabTrainingSet[] {
  if (fromSetId === toSetId) return sets
  const ids = sanitizeWordIdList(wordIds)
  if (!ids.length) return sets
  const from = getTrainingSet(sets, fromSetId)
  const to = getTrainingSet(sets, toSetId)
  if (!from || !to) return sets
  const move = new Set(ids.filter((id) => from.wordIds.includes(id)))
  if (!move.size) return sets
  const knownTo = new Set(to.wordIds)
  return sets.map((set) => {
    if (set.id === fromSetId) {
      return {
        ...set,
        wordIds: set.wordIds.filter((id) => !move.has(id)),
        updatedAt: now,
      }
    }
    if (set.id === toSetId) {
      const extra = [...move].filter((id) => !knownTo.has(id))
      return extra.length
        ? { ...set, wordIds: [...set.wordIds, ...extra], updatedAt: now }
        : set
    }
    return set
  })
}

export function defaultNewSetName(sets: VocabTrainingSet[], base = 'Набор'): string {
  const used = new Set(sets.map((set) => set.name))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}
