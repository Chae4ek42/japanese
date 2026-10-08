import { useEffect, useState } from 'react'

/** True for touch-first / phone-sized viewports (coarse pointer or narrow screen). */
export function useIsMobileTouch(): boolean {
  const [isMobile, setIsMobile] = useState(() => readIsMobileTouch())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const queries = [
      window.matchMedia('(hover: none) and (pointer: coarse)'),
      window.matchMedia('(max-width: 820px)'),
    ]

    const sync = () => setIsMobile(readIsMobileTouch())
    for (const query of queries) {
      query.addEventListener('change', sync)
    }
    sync()
    return () => {
      for (const query of queries) {
        query.removeEventListener('change', sync)
      }
    }
  }, [])

  return isMobile
}

export function readIsMobileTouch(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 820px)').matches
  return coarse || narrow
}

/** Text fields keep the caret and the keyboard; swipes may start everywhere else. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], .vocab-card-editor, .custom-word-form'),
  )
}

/** Keep a tap from focusing a control, so a closed mobile keyboard stays closed. */
export function preventTouchFocus(event: { pointerType: string; preventDefault: () => void }): void {
  if (event.pointerType === 'mouse') return
  event.preventDefault()
}
