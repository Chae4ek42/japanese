import { useCallback } from 'react'
import {
  DEFAULT_READER_STATE,
  deleteReaderText,
  duplicateReaderText,
  openReaderText,
  persistReaderDraft,
  renameReaderText,
  startNewReaderText,
} from './slices/reader'
import { useAppStateContext } from './core'

export function useReaderState() {
  const { appState, setAppState } = useAppStateContext()

  const persistDraft = useCallback(
    (text: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        const next = persistReaderDraft(reader, text)
        if (next === reader) return prevState
        return { ...prevState, reader: next }
      })
    },
    [setAppState],
  )

  const openText = useCallback(
    (id: string, currentDraft: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        const next = openReaderText(reader, id, currentDraft)
        if (next === reader) return prevState
        return { ...prevState, reader: next }
      })
    },
    [setAppState],
  )

  const startNew = useCallback(
    (currentDraft: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        const next = startNewReaderText(reader, currentDraft)
        if (next === reader) return prevState
        return { ...prevState, reader: next }
      })
    },
    [setAppState],
  )

  const duplicateText = useCallback(
    (id: string, currentDraft: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        const next = duplicateReaderText(reader, id, currentDraft)
        if (next === reader) return prevState
        return { ...prevState, reader: next }
      })
    },
    [setAppState],
  )

  const renameText = useCallback(
    (id: string, title: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        const next = renameReaderText(reader, id, title)
        if (next === reader) return prevState
        return { ...prevState, reader: next }
      })
    },
    [setAppState],
  )

  const deleteText = useCallback(
    (id: string) => {
      setAppState((prevState) => {
        if (!prevState) return prevState
        const reader = prevState.reader ?? DEFAULT_READER_STATE
        const next = deleteReaderText(reader, id)
        if (next === reader) return prevState
        return { ...prevState, reader: next }
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
    persistDraft,
    openText,
    startNew,
    duplicateText,
    renameText,
    deleteText,
  }
}
