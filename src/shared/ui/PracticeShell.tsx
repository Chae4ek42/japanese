import type { PracticeShellProps } from '../../shared/lib/component-props'
import { SessionChips } from './SessionChips'

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
