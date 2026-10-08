import { useEffect, useRef, type ReactNode } from 'react'
import { dismissMobileKeyboard, hintTapJustHappened, markHintTap } from '../lib/media'

export interface HintButtonProps {
  children: ReactNode
  className?: string
  testId?: string
  disabled?: boolean
  pressed?: boolean
  onClick: () => void
}

/**
 * Hint control that must not open the mobile keyboard.
 * `touchstart` is non-passive so the tap never focuses the answer field.
 * The `disabled` attribute is avoided: Safari moves focus to the next input
 * when the tapped button becomes disabled, which opens the keyboard.
 */
export function HintButton({
  children,
  className = 'hint-button',
  testId,
  disabled = false,
  pressed,
  onClick,
}: HintButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const onClickRef = useRef(onClick)
  const disabledRef = useRef(disabled)
  onClickRef.current = onClick
  disabledRef.current = disabled

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const onTouchStart = (event: TouchEvent) => {
      if (disabledRef.current) return
      event.preventDefault()
      markHintTap()
      onClickRef.current()
      dismissMobileKeyboard()
    }
    node.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => node.removeEventListener('touchstart', onTouchStart)
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      data-testid={testId}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      onMouseDown={(event) => {
        if (event.button === 0) event.preventDefault()
      }}
      onClick={() => {
        if (disabled || hintTapJustHappened()) return
        onClick()
      }}
    >
      {children}
    </button>
  )
}
