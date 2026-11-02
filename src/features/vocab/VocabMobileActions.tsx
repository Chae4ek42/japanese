import type { ReactNode } from 'react'

interface VocabMobileActionsProps {
  currentInMyWords: boolean
  currentLearned: boolean
  currentExcluded: boolean
  sessionWordCount: number
  onEdit?: () => void
  onAddToMine?: () => void
  onToggleLearned?: () => void
  onExclude?: () => void
  onRestore?: () => void
  onAddSessionToMine?: () => void
}

function Action({ label, testId, pressed, disabled, onClick, children }: {
  label: string
  testId: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="vocab-mobile-action"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

export function VocabMobileActions({
  currentInMyWords, currentLearned, currentExcluded, sessionWordCount,
  onEdit, onAddToMine, onToggleLearned, onExclude, onRestore, onAddSessionToMine,
}: VocabMobileActionsProps) {
  return (
    <div className="vocab-mobile-tools" role="group" aria-label="Действия со словом" data-testid="vocab-mobile-tools">
      {onEdit ? (
        <Action label="Изменить слово" testId="vocab-edit-card" onClick={onEdit}>
          <path d="m15 4 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-5-4L4 15Z" />
        </Action>
      ) : null}
      {onAddToMine ? (
        <Action label={currentInMyWords ? 'Уже в моих словах' : 'Добавить в мои слова'} testId="vocab-add-current-to-mine" onClick={onAddToMine} pressed={currentInMyWords} disabled={currentInMyWords}>
          <path d="M6 4h12v17l-6-4-6 4Z" />
          {currentInMyWords ? <path d="m9 9 2 2 4-4" /> : <path d="M9 9h6m-3-3v6" />}
        </Action>
      ) : null}
      {onToggleLearned ? (
        <Action label={currentLearned ? 'Вернуть в изучение' : 'Отметить выученным'} testId="vocab-toggle-learned" onClick={onToggleLearned} pressed={currentLearned}>
          <circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />
        </Action>
      ) : null}
      {currentExcluded && onRestore ? (
        <Action label="Вернуть в тренировку" testId="vocab-restore-session" onClick={onRestore} pressed>
          <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
        </Action>
      ) : onExclude ? (
        <Action label="Исключить из этой тренировки" testId="vocab-exclude-session" onClick={onExclude}>
          <circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" />
        </Action>
      ) : null}
      {onAddSessionToMine ? (
        <Action label={`Всю сессию в мои слова (${sessionWordCount})`} testId="vocab-add-session-to-mine" onClick={onAddSessionToMine}>
          <path d="M3 7h7l2 2h9v11H3ZM3 7V4h7l2 3h9M9 14h6m-3-3v6" />
        </Action>
      ) : null}
    </div>
  )
}
