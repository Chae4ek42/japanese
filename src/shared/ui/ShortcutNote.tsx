import type { ReactNode } from 'react'

export interface ShortcutNoteProps {
  /** Desktop / keyboard wording (may include <kbd>). */
  keyboard: ReactNode
  /** Mobile swipe wording. */
  swipe: ReactNode
  className?: string
}

/** Shows keyboard hints on desktop and swipe hints on touch/narrow viewports. */
export function ShortcutNote({ keyboard, swipe, className = '' }: ShortcutNoteProps) {
  return (
    <p className={`question-note shortcut-note ${className}`.trim()}>
      <span className="hint-kbd">{keyboard}</span>
      <span className="hint-swipe">{swipe}</span>
    </p>
  )
}
