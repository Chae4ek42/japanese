import { useRef, type ReactNode } from 'react'
import type { FeedbackState, SessionStats } from '../lib/types'
import { useSwipeGestures, type SwipeGestureHandlers } from '../lib/useSwipeGestures'
import { SessionChips } from './SessionChips'

export interface PracticeShellProps {
  onStop: () => void
  sessionStats: SessionStats & { accuracy?: number }
  unit?: 'cards' | 'sentences'
  feedbackType?: FeedbackState['type']
  className?: string
  stageClassName?: string
  aside?: ReactNode
  asideClassName?: string
  testId?: string
  stopTestId?: string
  stopLabel?: string
  children?: ReactNode
  /** Mobile swipe shortcuts (←→ Space Enter). Ignored on desktop. */
  swipes?: SwipeGestureHandlers
  swipesEnabled?: boolean
}

export function PracticeShell({
  onStop,
  sessionStats,
  unit = 'cards',
  feedbackType = 'idle',
  className = '',
  stageClassName = '',
  aside,
  asideClassName = '',
  testId,
  stopTestId,
  stopLabel = '← К настройкам',
  children,
  swipes,
  swipesEnabled = true,
}: PracticeShellProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const swipesActive = useSwipeGestures(stageRef, swipes ?? {}, Boolean(swipes) && swipesEnabled)

  return (
    <section
      className={`practice-panel ${swipesActive ? 'has-mobile-swipes' : ''} ${className}`.trim()}
      data-testid={testId}
    >
      <div className="practice-topline">
        <button type="button" className="text-button" data-testid={stopTestId} onClick={onStop}>
          {stopLabel}
        </button>
        <SessionChips sessionStats={sessionStats} unit={unit} />
      </div>

      <div className={`practice-layout ${aside ? 'has-aside' : ''} ${stageClassName}`.trim()}>
        <div
          ref={stageRef}
          className={`practice-stage ${feedbackType ? `is-${feedbackType}` : ''}`.trim()}
        >
          {children}
        </div>
        {aside ? <aside className={`practice-aside ${asideClassName}`.trim()}>{aside}</aside> : null}
      </div>
    </section>
  )
}
