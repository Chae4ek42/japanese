import type { SessionStats } from '../../shared/lib/types'
import { SessionChips } from '../../shared/ui/SessionChips'

export function VocabMobileHeader({ sessionStats, onSettings }: {
  sessionStats: SessionStats & { accuracy?: number }
  onSettings: () => void
}) {
  return (
    <div className="vocab-mobile-card-head">
      <div className="vocab-mobile-card-title">
        <span>Слова</span>
        <SessionChips sessionStats={sessionStats} compact />
      </div>
      <button type="button" className="vocab-mobile-action" aria-label="Настройки тренировки" title="Настройки тренировки" data-testid="vocab-practice-settings" onClick={onSettings}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="white" /><circle cx="15" cy="17" r="3" fill="white" />
        </svg>
      </button>
    </div>
  )
}
