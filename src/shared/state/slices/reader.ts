import type { ReaderSavedText, ReaderState } from '../../lib/types'

export const MAX_SAVED_READER_TEXTS = 40
export const MAX_READER_TEXT_LENGTH = 12_000
export const MAX_READER_TITLE_LENGTH = 48

export const DEFAULT_READER_STATE: ReaderState = {
  texts: [],
  activeTextId: null,
  draft: '',
}

export function newReaderTextId(now = Date.now()): string {
  return `rt_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function titleFromReaderText(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return 'Текст'
  return compact.slice(0, MAX_READER_TITLE_LENGTH)
}

export function displayReaderTitle(item: Pick<ReaderSavedText, 'title' | 'text'>): string {
  const title = item.title.trim()
  return title || titleFromReaderText(item.text)
}

export function isAutoReaderTitle(item: Pick<ReaderSavedText, 'title' | 'text'>): boolean {
  return item.title.trim() === titleFromReaderText(item.text)
}

function clampText(value: string): string {
  return value.length > MAX_READER_TEXT_LENGTH ? value.slice(0, MAX_READER_TEXT_LENGTH) : value
}

function copyReaderTitle(title: string): string {
  const suffix = ' · копия'
  if (title.endsWith(suffix)) return title.slice(0, MAX_READER_TITLE_LENGTH)
  const base = title.slice(0, Math.max(1, MAX_READER_TITLE_LENGTH - suffix.length)).trimEnd()
  return `${base}${suffix}`.slice(0, MAX_READER_TITLE_LENGTH)
}

export function persistReaderDraft(state: ReaderState, text: string, now = Date.now()): ReaderState {
  const draft = clampText(text)
  const active = state.texts.find((item) => item.id === state.activeTextId) ?? null

  if (active) {
    const title = (isAutoReaderTitle(active) ? titleFromReaderText(draft) : active.title).slice(
      0,
      MAX_READER_TITLE_LENGTH,
    )
    if (active.text === draft && active.title === title && state.draft === draft) return state
    return {
      ...state,
      draft,
      activeTextId: active.id,
      texts: state.texts.map((item) =>
        item.id === active.id ? { ...item, text: draft, title, updatedAt: now } : item,
      ),
    }
  }

  if (!draft.trim()) {
    if (state.draft === draft && state.activeTextId === null) return state
    return { ...state, draft, activeTextId: null }
  }

  if (state.texts.length >= MAX_SAVED_READER_TEXTS) {
    if (state.draft === draft) return state
    return { ...state, draft }
  }

  const saved: ReaderSavedText = {
    id: newReaderTextId(now),
    title: titleFromReaderText(draft),
    text: draft,
    createdAt: now,
    updatedAt: now,
  }
  return {
    texts: [saved, ...state.texts],
    activeTextId: saved.id,
    draft,
  }
}

export function openReaderText(
  state: ReaderState,
  id: string,
  currentDraft: string,
  now = Date.now(),
): ReaderState {
  const flushed = persistReaderDraft(state, currentDraft, now)
  if (!flushed.activeTextId && flushed.draft.trim() && flushed.texts.length >= MAX_SAVED_READER_TEXTS) {
    return flushed
  }
  const item = flushed.texts.find((entry) => entry.id === id)
  if (!item) return flushed
  if (flushed.activeTextId === id && flushed.draft === item.text) return flushed
  return { ...flushed, activeTextId: id, draft: item.text }
}

export function startNewReaderText(state: ReaderState, currentDraft: string, now = Date.now()): ReaderState {
  const flushed = persistReaderDraft(state, currentDraft, now)
  if (!flushed.activeTextId) return flushed
  return { ...flushed, activeTextId: null, draft: '' }
}

export function duplicateReaderText(
  state: ReaderState,
  id: string,
  currentDraft: string,
  now = Date.now(),
): ReaderState {
  const flushed = persistReaderDraft(state, currentDraft, now)
  if (flushed.texts.length >= MAX_SAVED_READER_TEXTS) return flushed
  const item = flushed.texts.find((entry) => entry.id === id)
  if (!item?.text.trim()) return flushed
  const copy: ReaderSavedText = {
    id: newReaderTextId(now),
    title: copyReaderTitle(displayReaderTitle(item)),
    text: item.text,
    createdAt: now,
    updatedAt: now,
  }
  return {
    texts: [copy, ...flushed.texts],
    activeTextId: copy.id,
    draft: copy.text,
  }
}

export function renameReaderText(state: ReaderState, id: string, title: string, now = Date.now()): ReaderState {
  const nextTitle = title.slice(0, MAX_READER_TITLE_LENGTH)
  return {
    ...state,
    texts: state.texts.map((item) =>
      item.id === id ? { ...item, title: nextTitle, updatedAt: now } : item,
    ),
  }
}

export function deleteReaderText(state: ReaderState, id: string): ReaderState {
  const texts = state.texts.filter((item) => item.id !== id)
  if (state.activeTextId !== id) return { ...state, texts }
  const pick = [...texts].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (!pick) return { texts: [], activeTextId: null, draft: '' }
  return { texts, activeTextId: pick.id, draft: pick.text }
}

export function sanitizeReaderSavedText(raw: unknown, now = Date.now()): ReaderSavedText | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const text = typeof source.text === 'string' ? clampText(source.text) : ''
  const titleRaw = typeof source.title === 'string' ? source.title.trim() : ''
  if (!id || (!text.trim() && !titleRaw)) return null
  const createdAt =
    typeof source.createdAt === 'number' && Number.isFinite(source.createdAt) ? source.createdAt : now
  const updatedAt =
    typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt) ? source.updatedAt : createdAt
  return {
    id,
    title: (titleRaw || titleFromReaderText(text)).slice(0, MAX_READER_TITLE_LENGTH),
    text,
    createdAt,
    updatedAt,
  }
}

export function sanitizeReaderState(raw: unknown, fallback: ReaderState = DEFAULT_READER_STATE): ReaderState {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const texts = Array.isArray(source.texts)
    ? source.texts
        .map((item) => sanitizeReaderSavedText(item))
        .filter((item): item is ReaderSavedText => item !== null)
        .slice(0, MAX_SAVED_READER_TEXTS)
    : [...fallback.texts]

  const seen = new Set<string>()
  const unique: ReaderSavedText[] = []
  for (const item of texts) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }

  const activeTextId =
    typeof source.activeTextId === 'string' && unique.some((item) => item.id === source.activeTextId)
      ? source.activeTextId
      : null
  const draft = typeof source.draft === 'string' ? clampText(source.draft) : fallback.draft

  return { texts: unique, activeTextId, draft }
}
