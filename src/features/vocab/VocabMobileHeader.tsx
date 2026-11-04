import type { SessionStats } from '../../shared/lib/types'
import { SessionChips } from '../../shared/ui/SessionChips'

export function VocabMobileHeader({ sessionStats, onSettings, onOpenWords, wordCount, editing = false, wordsOpen = false }: {
  sessionStats: SessionStats & { accuracy?: number }
  onSettings: () => void
  onOpenWords: () => void
  wordCount: number
  editing?: boolean
  wordsOpen?: boolean
}) {
  return (
    <div className="vocab-mobile-card-head">
      <button type="button" className="vocab-mobile-action" aria-label={editing ? 'Отменить редактирование' : 'Выйти из тренировки'} data-testid="vocab-practice-exit" onClick={onSettings}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
      </button>
      <div className="vocab-mobile-card-title">
        <SessionChips sessionStats={sessionStats} compact />
      </div>
      <button type="button" className="vocab-mobile-action vocab-open-words" aria-label={`Слова тренировки: ${wordCount}`} aria-haspopup="dialog" aria-expanded={wordsOpen} data-testid="vocab-open-words" onClick={onOpenWords} disabled={editing}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      </button>
    </div>
  )
}
