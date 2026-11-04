import { useLayoutEffect } from 'react'

/** Lock the page for the lifetime of mobile practice, restoring its previous position on exit. */
export function usePracticeFocus(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return
    const { scrollX, scrollY } = window
    document.documentElement.classList.add('vocab-focus-mode')
    return () => {
      document.documentElement.classList.remove('vocab-focus-mode')
      window.scrollTo(scrollX, scrollY)
    }
  }, [enabled])
}
