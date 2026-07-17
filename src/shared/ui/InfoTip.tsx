import type { InfoTipProps } from '../../shared/lib/component-props'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Подсказка рендерится в document.body, чтобы не обрезалась overflow у карточек и таблиц.
export function InfoTip({ text, align = 'center' }: InfoTipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState({ top: 0, left: 0, transform: '' })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const gap = 8
    let left = rect.left + rect.width / 2
    let transform = 'translateX(-50%)'

    if (align === 'start') {
      left = rect.left
      transform = 'none'
    } else if (align === 'end') {
      left = rect.right
      transform = 'translateX(-100%)'
    }

    setStyle({
      top: rect.bottom + gap,
      left,
      transform,
    })
  }, [align])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  return (
    <>
      <span
        ref={triggerRef}
        className="info-tip"
        tabIndex={0}
        aria-label={text}
        onMouseEnter={() => {
          updatePosition()
          setOpen(true)
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          updatePosition()
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
      >
        ?
      </span>
      {open
        ? createPortal(
            <span
              className={`info-tip-bubble is-${align} is-portal`}
              role="tooltip"
              style={style}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
