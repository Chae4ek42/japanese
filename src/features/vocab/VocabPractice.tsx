import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import type { FeedbackState, RoundState, SessionStats, VocabCard, VocabDrillMode, InputMode } from '../../shared/lib/types'
import { PracticeShell } from '../../shared/ui/PracticeShell'

export interface VocabPracticeProps {
  activeCard: VocabCard | null
  drillMode: VocabDrillMode
  inputMode: InputMode
  inputRef: RefObject<HTMLInputElement | null>
  inputValue: string
  choiceOptions: string[]
  selectedChoice: string | null
  feedback: FeedbackState
  round: RoundState
  sessionStats: SessionStats & { accuracy?: number }
  canGoPrev: boolean
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onRevealHint: () => void
  onChoose: (meaning: string) => void
  onSkipPrev: () => void
  onSkipNext: () => void
  onStop: () => void
}

export function VocabPractice({
  activeCard,
  drillMode,
  inputMode,
  inputRef,
  inputValue,
  choiceOptions,
  selectedChoice,
  feedback,
  round,
  sessionStats,
  canGoPrev,
  onInputChange,
  onInputKeyDown,
  onRevealHint,
  onChoose,
  onSkipPrev,
  onSkipNext,
  onStop,
}: VocabPracticeProps) {
  if (!activeCard) {
    return <PracticeShell onStop={onStop} sessionStats={sessionStats} feedbackType={feedback.type} />
  }

  return (
    <PracticeShell
      className="vocab-practice"
      onStop={onStop}
      sessionStats={sessionStats}
      feedbackType={feedback.type}
    >
      <div className="question-block">
        <p className="script-badge">{drillMode === 'romaji' ? 'Ромадзи' : 'Перевод'}</p>
        <div className="question-symbol vocab-question-writing" aria-live="polite">
          <span data-testid="vocab-current-writing">{activeCard.writing}</span>
        </div>
        {drillMode === 'romaji' ? (
          round.hintUsed ? (
            <p className="vocab-question-kana" data-testid="vocab-current-kana">
              {activeCard.kana}
            </p>
          ) : (
            <p className="question-note">Введите ромадзи чтения</p>
          )
        ) : (
          <p className="question-note">Выберите верный перевод</p>
        )}
      </div>

      <div className="answer-block">
        {drillMode === 'romaji' ? (
          <>
            <input
              ref={inputRef}
              type="text"
              className="answer-input"
              data-testid="vocab-answer-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              enterKeyHint={inputMode === 'submit' ? 'go' : 'done'}
              value={inputValue}
              onChange={onInputChange}
              onKeyDown={onInputKeyDown}
              placeholder={round.hintUsed ? activeCard.romaji : 'ромадзи'}
            />
            <div className="feedback-row">
              <p className={`feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>{feedback.text || ' '}</p>
            </div>
            <div className="answer-actions">
              <button
                type="button"
                className="hint-button"
                data-testid="vocab-hint-button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onRevealHint}
              >
                Подсказка
              </button>
              <p className="question-note">
                <kbd>Space</kbd> — подсказка
                {inputMode === 'submit' ? (
                  <>
                    {' · '}
                    <kbd>Enter</kbd> — проверить
                  </>
                ) : (
                  ' · автозачёт'
                )}
                {' · '}
                <kbd>←</kbd>/<kbd>→</kbd> — пропуск
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="vocab-choice-grid" data-testid="vocab-choice-grid">
              {choiceOptions.map((option, index) => {
                const isSelected = selectedChoice === option
                const isCorrect = option === activeCard.meaning
                const showResult = Boolean(selectedChoice)
                let className = 'vocab-choice-button'
                if (showResult && isCorrect) className += ' is-correct'
                if (showResult && isSelected && !isCorrect) className += ' is-wrong'
                return (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    className={className}
                    data-testid={`vocab-choice-${index}`}
                    disabled={Boolean(selectedChoice)}
                    onClick={() => onChoose(option)}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            <div className="feedback-row">
              <p className={`feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>{feedback.text || ' '}</p>
            </div>
          </>
        )}

        <div className="vocab-skip-row" role="group" aria-label="Переход без ответа">
          <button
            type="button"
            className="ghost-button"
            data-testid="vocab-skip-prev"
            disabled={!canGoPrev}
            onClick={onSkipPrev}
          >
            ← Предыдущее
          </button>
          <button type="button" className="ghost-button" data-testid="vocab-skip-next" onClick={onSkipNext}>
            Следующее →
          </button>
        </div>
        <p className="question-note vocab-skip-note">Пропуск не влияет на статистику и очередь.</p>
      </div>
    </PracticeShell>
  )
}
