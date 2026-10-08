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

const HINT_FOCUS_BLOCK_MS = 400
let hintTapAt = 0

/** A hint control was just touched; ignore focus that the tap would move onto an input. */
export function markHintTap(): void {
  hintTapAt = Date.now()
}

export function hintTapJustHappened(): boolean {
  return hintTapAt > 0 && Date.now() - hintTapAt < HINT_FOCUS_BLOCK_MS
}

function blurFocusedField(): void {
  const active = document.activeElement
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  ) {
    active.blur()
  }
}

/** Close the software keyboard if a hint tap (or the following focus move) opened it. */
export function dismissMobileKeyboard(): void {
  blurFocusedField()
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(blurFocusedField)
  window.setTimeout(blurFocusedField, 0)
  window.setTimeout(blurFocusedField, 60)
}
