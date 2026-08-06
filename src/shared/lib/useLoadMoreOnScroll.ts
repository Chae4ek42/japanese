import { useEffect, useRef, type RefObject } from 'react'

/**
 * When `sentinelRef` enters the viewport (with rootMargin), call `onLoadMore`.
 * Used for dictionary / mine infinite lists.
 */
export function useLoadMoreOnScroll(
  sentinelRef: RefObject<HTMLElement | null>,
  {
    hasMore,
    onLoadMore,
    enabled = true,
    rootMargin = '320px',
  }: {
    hasMore: boolean
    onLoadMore: () => void
    enabled?: boolean
    rootMargin?: string
  },
) {
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    const node = sentinelRef.current
    if (!enabled || !hasMore || !node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current()
        }
      },
      { root: null, rootMargin, threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, hasMore, rootMargin, sentinelRef])
}
