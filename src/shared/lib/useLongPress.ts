import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'

const DEFAULT_DELAY_MS = 480
const DEFAULT_MOVE_THRESHOLD_PX = 12

export interface LongPressOptions {
  delayMs?: number
  moveThresholdPx?: number
  /** When false, handlers are no-ops (still safe to spread). */
  enabled?: boolean
}

export interface LongPressHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void
  /** Suppress the synthetic click that follows a successful long-press. */
  onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void
}

/**
 * Press-and-hold gesture (mobile analog of middle-click).
 * Cancels if the pointer moves too far or another pointer interferes.
 */
export function useLongPress(
  onLongPress: (() => void) | undefined,
  options: LongPressOptions = {},
): LongPressHandlers {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  const moveThresholdPx = options.moveThresholdPx ?? DEFAULT_MOVE_THRESHOLD_PX
  const enabled = options.enabled !== false && Boolean(onLongPress)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const originRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const suppressClickRef = useRef(false)

  function clearTimer() {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function cancel() {
    clearTimer()
    originRef.current = null
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !onLongPress) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!event.isPrimary) return

    cancel()
    suppressClickRef.current = false
    originRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (!originRef.current) return
      suppressClickRef.current = true
      originRef.current = null
      onLongPress()
    }, delayMs)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const origin = originRef.current
    if (!origin || origin.pointerId !== event.pointerId) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    if (dx * dx + dy * dy > moveThresholdPx * moveThresholdPx) {
      cancel()
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (originRef.current?.pointerId === event.pointerId) {
      cancel()
    }
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
    if (originRef.current?.pointerId === event.pointerId) {
      cancel()
    }
  }

  function onContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (!enabled) return
    // Avoid the native callout / context menu competing with long-press.
    if (suppressClickRef.current || timerRef.current != null) {
      event.preventDefault()
    }
  }

  function onClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    onClickCapture,
  }
}
