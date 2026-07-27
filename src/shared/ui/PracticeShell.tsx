import type { ReactNode } from 'react'
import type { FeedbackState, SessionStats } from '../lib/types'
import { SessionChips } from './SessionChips'

export interface PracticeShellProps {
  onStop: () => void
  sessionStats: SessionStats & { accuracy?: number }
  feedbackType?: FeedbackState['type']
  className?: string
  stageClassName?: string
  children?: ReactNode
}

export function PracticeShell({
  onStop,
  sessionStats,
  feedbackType = 'idle',
  className = '',
  stageClassName = '',
  children,
}: PracticeShellProps) {
  return (
    <section className={`practice-panel ${className}`.trim()}>
      <div className="practice-topline">
        <button type="button" className="text-button" onClick={onStop}>
          ← К настройкам
        </button>
        <SessionChips sessionStats={sessionStats} />
      </div>

      <div className={`practice-layout ${stageClassName}`.trim()}>
        <div className={`practice-stage ${feedbackType ? `is-${feedbackType}` : ''}`.trim()}>
          {children}
        </div>
      </div>
    </section>
  )
}
