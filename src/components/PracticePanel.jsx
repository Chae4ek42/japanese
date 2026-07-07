import { SessionChips } from './SessionChips'

export function PracticePanel({
  activeCard,
  feedback,
  inputMode,
  inputRef,
  inputValue,
  onInputChange,
  onInputKeyDown,
  onRevealHint,
  onStop,
  round,
  sessionStats,
  showScriptLabel = false,
}) {
  return (
    <section className="panel practice-panel">
      <div className="practice-topline">
        <button type="button" className="text-button" onClick={onStop}>
          ← Назад
        </button>

        <SessionChips sessionStats={sessionStats} />
      </div>

      {activeCard ? (
        <div className="practice-layout">
          <div className={`practice-stage ${feedback.type ? `is-${feedback.type}` : ''}`}>
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
                placeholder={round.hintUsed ? activeCard.answers[0] : 'romaji'}
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
                  Показать ответ
                </button>
                <p className="question-note">
                  <kbd>Space</kbd> — ответ{inputMode === 'submit' ? (
                    <>
                      {' · '}
                      <kbd>Enter</kbd> — проверить
                    </>
                  ) : ' · зачет автоматом'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
