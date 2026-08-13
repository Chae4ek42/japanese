import { useCallback } from 'react'
import type { ReaderSavedText } from '../lib/types'
import {
  DEFAULT_READER_STATE,
  MAX_READER_TEXT_LENGTH,
  MAX_SAVED_READER_TEXTS,
  newReaderTextId,
  titleFromReaderText,
} from './slices/reader'
import { useAppStateContext } from './core'

function clampText(value: string): string {
  return value.length > MAX_READER_TEXT_LENGTH ? value.slice(0, MAX_READER_TEXT_LENGTH) : value
}

export function useReaderState() {
  const { appState, setAppState } = useAppStateContext()

  const setDraft = useCallback(
    (draft: string, activeTextId?: string | null) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        return {
          ...prevState,
          reader: {
            ...reader,
            draft: clampText(draft),
            activeTextId: activeTextId === undefined ? reader.activeTextId : activeTextId,
          },
        }
      })
    },
    [setAppState],
  )

  const saveText = useCallback(
    (input: { id?: string | null; title?: string; text: string }): ReaderSavedText | null => {
      const text = clampText(input.text)
      if (!text.trim()) return null
      const now = Date.now()
      const title = (input.title?.trim() || titleFromReaderText(text)).slice(0, 48)
      const id = input.id?.trim() || newReaderTextId(now)
      const saved: ReaderSavedText = {
        id,
        title,
        text,
        createdAt: now,
        updatedAt: now,
      }

      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        const existing = reader.texts.find((item) => item.id === id)
        if (existing) {
          const updated = { ...existing, title, text, updatedAt: now }
          saved.createdAt = existing.createdAt
          saved.updatedAt = updated.updatedAt
          saved.title = updated.title
          return {
            ...prevState,
            reader: {
              ...reader,
              texts: reader.texts.map((item) => (item.id === id ? updated : item)),
              activeTextId: id,
              draft: text,
            },
          }
        }
        if (reader.texts.length >= MAX_SAVED_READER_TEXTS) return prevState
        return {
          ...prevState,
          reader: {
            ...reader,
            texts: [saved, ...reader.texts],
            activeTextId: id,
            draft: text,
          },
        }
      })

      return saved
    },
    [setAppState],
  )

  const renameText = useCallback(
    (id: string, title: string) => {
      const nextTitle = title.trim().slice(0, 48)
      if (!nextTitle) return
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        return {
          ...prevState,
          reader: {
            ...reader,
            texts: reader.texts.map((item) =>
              item.id === id ? { ...item, title: nextTitle, updatedAt: Date.now() } : item,
            ),
          },
        }
      })
    },
    [setAppState],
  )

  const deleteText = useCallback(
    (id: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        return {
          ...prevState,
          reader: {
            ...reader,
            texts: reader.texts.filter((item) => item.id !== id),
            activeTextId: reader.activeTextId === id ? null : reader.activeTextId,
          },
        }
      })
    },
    [setAppState],
  )

  if (!appState) return null

  const reader = appState.reader ?? DEFAULT_READER_STATE
  return {
    texts: reader.texts,
    activeTextId: reader.activeTextId,
    draft: reader.draft,
    setDraft,
    saveText,
    renameText,
    deleteText,
  }
}
