import { useEffect, useRef, type RefObject } from 'react'
import { isTextEntryTarget, useIsMobileTouch } from './media'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export interface SwipeGestureHandlers {
  /** ← */
  onSwipeLeft?: () => void
  /** → */
  onSwipeRight?: () => void
  /** Space */
  onSwipeDown?: () => void
  /** Enter */
  onSwipeUp?: () => void
}

export const SWIPE_THRESHOLD_PX = 44
export const SWIPE_VERTICAL_THRESHOLD_PX = 56
export const SWIPE_MAX_DURATION_MS = 800
export const SWIPE_AXIS_RATIO = 1.2
const SWIPE_LOCK_PX = 10

interface TouchOrigin {
  x: number
  y: number
  at: number
}

/** Direction of a completed swipe, or null when the motion is a tap or a scroll. */
export function classifySwipe(dx: number, dy: number, elapsed: number): SwipeDirection | null {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > SWIPE_MAX_DURATION_MS) return null
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX >= absY * SWIPE_AXIS_RATIO && absX >= SWIPE_THRESHOLD_PX) {
    return dx < 0 ? 'left' : 'right'
  }
  if (absY >= absX * SWIPE_AXIS_RATIO && absY >= SWIPE_VERTICAL_THRESHOLD_PX) {
    return dy < 0 ? 'up' : 'down'
  }
  return null
}

/**
 * Mobile-only swipe gestures mapped to practice shortcuts:
 * left/right → arrows, down → Space, up → Enter.
 * The gesture starts anywhere on `targetRef` except text fields.
 */
export function useSwipeGestures(
  targetRef: RefObject<HTMLElement | null>,
  handlers: SwipeGestureHandlers,
  enabled = true,
): boolean {
  const isMobile = useIsMobileTouch()
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const active = enabled && isMobile

  useEffect(() => {
    const node = targetRef.current
    if (!active || !node) return

    let origin: TouchOrigin | null = null
    let trackingId: number | null = null
    let claimed = false
    let sawMove = false
    let scrollY = 0
    let blockClicksUntil = 0

    const clear = () => {
      origin = null
      trackingId = null
      claimed = false
      sawMove = false
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        clear()
        return
      }
      if (isTextEntryTarget(event.target)) {
        clear()
        return
      }
      const touch = event.touches[0]
      if (!touch) return
      trackingId = touch.identifier
      origin = { x: touch.clientX, y: touch.clientY, at: Date.now() }
      claimed = false
      sawMove = false
      scrollY = window.scrollY
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!origin || trackingId == null) return
      const touch = Array.from(event.touches).find((item) => item.identifier === trackingId)
      if (!touch) return
      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (Math.max(absX, absY) < SWIPE_LOCK_PX) return
      sawMove = true
      // Claim horizontal drags so the browser does not turn them into a scroll.
      if (absX < absY) return
      if (event.cancelable) event.preventDefault()
      claimed = true
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (!origin || trackingId == null) return
      const touch =
        Array.from(event.changedTouches).find((item) => item.identifier === trackingId) ?? null
      const started = origin
      const tookHorizontal = claimed
      const moved = sawMove
      const startedScrollY = scrollY
      clear()
      if (!touch) return

      const direction = classifySwipe(
        touch.clientX - started.x,
        touch.clientY - started.y,
        Date.now() - started.at,
      )
      if (!direction) return
      const pageScrolled = Math.abs(window.scrollY - startedScrollY) > 8
      if ((direction === 'left' || direction === 'right') && moved && !tookHorizontal) return
      if ((direction === 'up' || direction === 'down') && pageScrolled) return

      const current = handlersRef.current
      if (direction === 'left') current.onSwipeLeft?.()
      else if (direction === 'right') current.onSwipeRight?.()
      else if (direction === 'up') current.onSwipeUp?.()
      else current.onSwipeDown?.()

      blockClicksUntil = Date.now() + 500
      if (event.cancelable) event.preventDefault()
    }

    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() > blockClicksUntil) return
      blockClicksUntil = 0
      event.preventDefault()
      event.stopPropagation()
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    node.addEventListener('touchend', onTouchEnd, { passive: false })
    node.addEventListener('touchcancel', clear, { passive: true })
    node.addEventListener('click', onClickCapture, true)

    return () => {
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchmove', onTouchMove)
      node.removeEventListener('touchend', onTouchEnd)
      node.removeEventListener('touchcancel', clear)
      node.removeEventListener('click', onClickCapture, true)
    }
  }, [active, targetRef])

  return active
}
