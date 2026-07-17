import { useCallback, useEffect, useState } from 'react'

export function useWordCarousel<T>(items: T[], { resetKey }: { resetKey?: unknown } = {}) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const length = items.length

  useEffect(() => {
    setIndex(0)
    setRevealed(false)
  }, [resetKey, length])

  const activeItem = items[index] ?? null

  const next = useCallback(() => {
    if (!length) {
      return
    }
    setRevealed(false)
    setIndex((prev) => (prev + 1) % length)
  }, [length])

  const prev = useCallback(() => {
    if (!length) {
      return
    }
    setRevealed(false)
    setIndex((prevIndex) => (prevIndex - 1 + length) % length)
  }, [length])

  const toggleReveal = useCallback(() => {
    setRevealed((value) => !value)
  }, [])

  return {
    index,
    setIndex,
    revealed,
    setRevealed,
    activeItem,
    next,
    prev,
    toggleReveal,
  }
}
