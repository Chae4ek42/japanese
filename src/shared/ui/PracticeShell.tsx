import { useRef, type ReactNode } from 'react'
import type { FeedbackState, SessionStats } from '../lib/types'
import { useSwipeGestures, type SwipeGestureHandlers } from '../lib/useSwipeGestures'
import { SessionChips } from './SessionChips'

export interface PracticeShellProps {
  onStop: () => void
  sessionStats: SessionStats & { accuracy?: number }
  feedbackType?: FeedbackState['type']
  className?: string
  stageClassName?: string
  children?: ReactNode
  /** Mobile swipe shortcuts (←→ Space Enter). Ignored on desktop. */
  swipes?: SwipeGestureHandlers
  swipesEnabled?: boolean
}

export function PracticeShell({
  onStop,
  sessionStats,
  feedbackType = 'idle',
  className = '',
  stageClassName = '',
  children,
  swipes,
  swipesEnabled = true,
}: PracticeShellProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const swipesActive = useSwipeGestures(stageRef, swipes ?? {}, Boolean(swipes) && swipesEnabled)

  return (
    <section
      className={`practice-panel ${swipesActive ? 'has-mobile-swipes' : ''} ${className}`.trim()}
    >
      <div className="practice-topline">
        <button type="button" className="text-button" onClick={onStop}>
          ← К настройкам
        </button>
        <SessionChips sessionStats={sessionStats} />
      </div>

      <div className={`practice-layout ${stageClassName}`.trim()}>
        <div
          ref={stageRef}
          className={`practice-stage ${feedbackType ? `is-${feedbackType}` : ''}`.trim()}
        >
          {children}
        </div>
      </div>
    </section>
  )
}
