import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import type { FeedbackState, InputMode, KanaCard, RoundState, SessionStats } from '../../shared/lib/types'
import { PracticeShell } from '../../shared/ui/PracticeShell'
import { ShortcutNote } from '../../shared/ui/ShortcutNote'

export interface PracticePanelProps {
  activeCard: KanaCard | null
  feedback: FeedbackState
  inputMode?: InputMode
  inputRef: RefObject<HTMLInputElement | null>
  inputValue: string
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onRevealHint: () => void
  onSubmitAnswer?: () => void
  onStop: () => void
  round: RoundState
  sessionStats: SessionStats & { accuracy?: number }
  showScriptLabel?: boolean
}

export function PracticePanel({
  activeCard,
  feedback,
  inputMode,
  inputRef,
  inputValue,
  onInputChange,
  onInputKeyDown,
  onRevealHint,
  onSubmitAnswer,
  onStop,
  round,
  sessionStats,
  showScriptLabel = false,
}: PracticePanelProps) {
  if (!activeCard) {
    return <PracticeShell onStop={onStop} sessionStats={sessionStats} feedbackType={feedback.type} />
  }

  return (
    <PracticeShell
      onStop={onStop}
      sessionStats={sessionStats}
      feedbackType={feedback.type}
      swipes={{
        onSwipeDown: onRevealHint,
        onSwipeUp: inputMode === 'submit' ? onSubmitAnswer : undefined,
      }}
    >
      <div className="question-block">
        {showScriptLabel ? (
          <p className="script-badge" data-testid="card-script-label">
            {activeCard.scriptLabel}
          </p>
        ) : null}
        <div className="question-symbol" aria-live="polite">
          <span data-testid="current-symbol">{activeCard.symbol}</span>
        </div>
      </div>

      <div className="answer-block">
        <input
          ref={inputRef}
          type="text"
          className="answer-input"
          data-testid="answer-input"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint={inputMode === 'submit' ? 'go' : 'done'}
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          placeholder={round.hintUsed ? activeCard.answers[0] : 'ромадзи'}
        />

        <div className="feedback-row">
          <p className={`feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>{feedback.text || ' '}</p>
        </div>

        <div className="answer-actions">
          <button
            type="button"
            className="hint-button"
            data-testid="hint-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onRevealHint}
          >
            Подсказка
          </button>
          <ShortcutNote
            keyboard={
              <>
                <kbd>Space</kbd> — подсказка
                {inputMode === 'submit' ? (
                  <>
                    {' · '}
                    <kbd>Enter</kbd> — проверить
                  </>
                ) : (
                  ' · автозачёт'
                )}
              </>
            }
            swipe={
              <>
                Свайп вниз — подсказка
                {inputMode === 'submit' ? ' · вверх — проверить' : ' · автозачёт'}
              </>
            }
          />
        </div>
      </div>
    </PracticeShell>
  )
}
