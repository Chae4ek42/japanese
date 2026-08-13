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

function clampText(value: string): string {
  return value.length > MAX_READER_TEXT_LENGTH ? value.slice(0, MAX_READER_TEXT_LENGTH) : value
}

export function sanitizeReaderSavedText(raw: unknown, now = Date.now()): ReaderSavedText | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const text = typeof source.text === 'string' ? clampText(source.text) : ''
  if (!id || !text.trim()) return null
  const titleRaw = typeof source.title === 'string' ? source.title.trim() : ''
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
