import { useEffect, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import type {
  FeedbackState,
  RoundState,
  SessionStats,
  VocabCard,
  VocabDrillMode,
  InputMode,
  KanjiWord,
} from '../../shared/lib/types'
import { PracticeShell } from '../../shared/ui/PracticeShell'
import { HighlightedReading } from '../kanji/HighlightedReading'
import { KanjiWritingHotspots } from '../kanji/KanjiWritingHotspots'
import {
  buildWordFromReadings,
  cardToReadingDrafts,
  createReadingDraft,
  type ReadingDraft,
} from './customWords'
import type { VocabMixedPrompt } from './mixed'

export interface VocabPracticeProps {
  activeCard: VocabCard | null
  drillMode: VocabDrillMode
  prompt: VocabMixedPrompt | null
  inputMode: InputMode
  inputRef: RefObject<HTMLInputElement | null>
  inputValue: string
  selectedChoice: string | null
  feedback: FeedbackState
  round: RoundState
  sessionStats: SessionStats & { accuracy?: number }
  canGoPrev: boolean
  currentInMyWords?: boolean
  showAddSessionToMyWords?: boolean
  sessionWordCount?: number
  currentLearned?: boolean
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onRevealHint: () => void
  onDontKnow?: () => void
  onChoose: (answer: string) => void
  onSkipPrev: () => void
  onSkipNext: () => void
  onStop: () => void
  onSubmitAnswer?: () => void
  onAddCurrentToMyWords?: () => void
  onAddSessionToMyWords?: () => void
  onToggleLearned?: () => void
  onExcludeFromSession?: () => void
  onRestoreToSession?: () => void
  currentExcluded?: boolean
  onSaveWordEdit?: (word: KanjiWord) => void
  onDeleteWord?: () => void
  onOpenKanjiInfo?: (character: string) => void
  aside?: ReactNode
}

function drillBadge(drillMode: VocabDrillMode, prompt: VocabMixedPrompt | null): string {
  if (drillMode === 'romaji') return 'Ромадзи'
  if (drillMode === 'choice') return 'Перевод'
  return prompt?.badge ?? 'Смешанный'
}

export function VocabPractice({
  activeCard,
  drillMode,
  prompt,
  inputMode,
  inputRef,
  inputValue,
  selectedChoice,
  feedback,
  round,
  sessionStats,
  canGoPrev,
  currentInMyWords = false,
  showAddSessionToMyWords = false,
  sessionWordCount = 0,
  currentLearned = false,
  currentExcluded = false,
  onInputChange,
  onInputKeyDown,
  onRevealHint,
  onDontKnow,
  onChoose,
  onSkipPrev,
  onSkipNext,
  onStop,
  onSubmitAnswer,
  onAddCurrentToMyWords,
  onAddSessionToMyWords,
  onToggleLearned,
  onExcludeFromSession,
  onRestoreToSession,
  onSaveWordEdit,
  onDeleteWord,
  onOpenKanjiInfo,
  aside,
}: VocabPracticeProps) {
  const [editing, setEditing] = useState(false)
  const [editWriting, setEditWriting] = useState('')
  const [editReadings, setEditReadings] = useState<ReadingDraft[]>([])
  const [editError, setEditError] = useState('')

  useEffect(() => {
    setEditing(false)
    setEditError('')
  }, [activeCard?.id])

  if (!activeCard) {
    return <PracticeShell onStop={onStop} sessionStats={sessionStats} feedbackType={feedback.type} />
  }

  const card = activeCard
  const isChoiceDrill = drillMode === 'choice' || drillMode === 'mixed'
  const choiceOptions = prompt?.options ?? []
  const correctAnswer = prompt?.correctAnswer ?? ''
  const swipeHandlers = {
    onSwipeLeft: onSkipPrev,
    onSwipeRight: onSkipNext,
    onSwipeDown: drillMode === 'romaji' ? onRevealHint : undefined,
    onSwipeUp:
      drillMode === 'romaji' && inputMode === 'submit' && onSubmitAnswer ? onSubmitAnswer : undefined,
  }

  function openEditor() {
    setEditWriting(card.writing)
    setEditReadings(cardToReadingDrafts(card))
    setEditError('')
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setEditError('')
  }

  function updateReading(key: string, patch: Partial<ReadingDraft>) {
    setEditReadings((prev) => prev.map((reading) => (reading.key === key ? { ...reading, ...patch } : reading)))
    if (editError) setEditError('')
  }

  function handleSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!onSaveWordEdit) return
    const word = buildWordFromReadings({
      writing: editWriting,
      readings: editReadings,
      id: card.id,
      jlpt: card.jlpt,
      variantIds: card.variantIds,
    })
    if (!word) {
      setEditError('Нужны написание и хотя бы одно полное чтение: кана, ромадзи и значение.')
      return
    }
    onSaveWordEdit(word)
    closeEditor()
  }

  return (
    <PracticeShell
      className="vocab-practice"
      onStop={onStop}
      sessionStats={sessionStats}
      feedbackType={feedback.type}
      swipes={swipeHandlers}
      aside={aside}
      asideClassName="vocab-practice-aside"
      stageClassName="vocab-practice-layout"
    >
      <div className="question-block">
        <p className="script-badge" data-testid="vocab-prompt-badge">
          {editing ? 'Правка слова' : drillBadge(drillMode, prompt)}
        </p>
        <div className="question-symbol" aria-live="polite">
          {isChoiceDrill && prompt?.stemMode === 'text' && !editing ? (
            <p className="vocab-question-stem" data-testid="vocab-current-stem">
              {prompt.stemText}
            </p>
          ) : (
            <KanjiWritingHotspots
              writing={editing ? editWriting || card.writing : isChoiceDrill && prompt ? prompt.stemText : card.writing}
              kana={
                !editing && round.hintUsed && activeCard && drillMode === 'romaji'
                  ? activeCard.kana
                  : null
              }
              colorize={!editing && round.hintUsed && drillMode === 'romaji'}
              className="vocab-question-writing"
              writingTestId="vocab-current-writing"
              onOpenInfo={onOpenKanjiInfo}
            />
          )}
        </div>
        {editing ? null : drillMode === 'romaji' ? (
          round.hintUsed && activeCard ? (
            <div className="vocab-hint-panel" data-testid="vocab-hint-panel">
              {activeCard.readings && activeCard.readings.length > 1 ? (
                <ul className="vocab-hint-readings" data-testid="vocab-hint-readings">
                  {activeCard.readings.map((reading) => (
                    <li key={`${reading.kana}-${reading.romaji}`} className="vocab-hint-reading">
                      <HighlightedReading
                        writing={activeCard.writing}
                        kana={reading.kana}
                        fallbackRomaji={reading.romaji}
                        colorize
                        testId={undefined}
                      />
                      <ul className="vocab-hint-meanings">
                        {(reading.meanings.length ? reading.meanings : [activeCard.meaning]).map((meaning) => (
                          <li key={meaning}>{meaning}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <HighlightedReading
                    writing={activeCard.writing}
                    kana={activeCard.kana}
                    fallbackRomaji={activeCard.romaji}
                    colorize
                    testId="vocab-current-reading"
                  />
                  <ul className="vocab-hint-meanings" data-testid="vocab-hint-meanings">
                    {(activeCard.meanings.length ? activeCard.meanings : [activeCard.meaning]).map((meaning) => (
                      <li key={meaning}>{meaning}</li>
                    ))}
                  </ul>
                </>
              )}
              {activeCard.jlpt ? (
                <p className="vocab-hint-meta" data-testid="vocab-hint-meta">
                  JLPT N{activeCard.jlpt}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="question-note">Введите ромадзи чтения (любой вариант)</p>
          )
        ) : (
          <p className="question-note">{prompt?.note ?? 'Выберите верный ответ'}</p>
        )}
      </div>

      <div className="answer-block">
        {editing && onSaveWordEdit ? (
          <form
            className="vocab-card-editor"
            data-testid="vocab-card-editor"
            onSubmit={handleSaveEdit}
          >
            <label className="vocab-edit-writing">
              Написание
              <input
                data-testid="vocab-edit-writing"
                value={editWriting}
                onChange={(event) => {
                  setEditWriting(event.target.value)
                  if (editError) setEditError('')
                }}
                autoComplete="off"
              />
            </label>

            <div className="vocab-edit-readings" data-testid="vocab-edit-readings">
              {editReadings.map((reading, index) => (
                <fieldset
                  key={reading.key}
                  className="vocab-edit-reading"
                  data-testid={`vocab-edit-reading-${index}`}
                >
                  <legend>Чтение {index + 1}</legend>
                  <div className="custom-word-grid">
                    <label>
                      Кана
                      <input
                        data-testid={`vocab-edit-kana-${index}`}
                        value={reading.kana}
                        onChange={(event) => updateReading(reading.key, { kana: event.target.value })}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      Ромадзи
                      <input
                        data-testid={`vocab-edit-romaji-${index}`}
                        value={reading.romaji}
                        onChange={(event) => updateReading(reading.key, { romaji: event.target.value })}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                    <label className="custom-word-wide">
                      Значения
                      <textarea
                        data-testid={`vocab-edit-meanings-${index}`}
                        value={reading.meanings}
                        onChange={(event) => updateReading(reading.key, { meanings: event.target.value })}
                        rows={2}
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  {editReadings.length > 1 ? (
                    <button
                      type="button"
                      className="text-button"
                      data-testid={`vocab-edit-remove-reading-${index}`}
                      onClick={() =>
                        setEditReadings((prev) => prev.filter((item) => item.key !== reading.key))
                      }
                    >
                      Убрать это чтение
                    </button>
                  ) : null}
                </fieldset>
              ))}
            </div>

            <button
              type="button"
              className="ghost-button"
              data-testid="vocab-edit-add-reading"
              onClick={() => setEditReadings((prev) => [...prev, createReadingDraft()])}
            >
              + Ещё чтение
            </button>

            {editError ? (
              <p className="feedback is-error" role="alert">
                {editError}
              </p>
            ) : null}

            <div className="vocab-card-editor-actions">
              <button type="submit" className="secondary-button" data-testid="vocab-edit-save">
                Сохранить
              </button>
              <button type="button" className="ghost-button" data-testid="vocab-edit-cancel" onClick={closeEditor}>
                Отмена
              </button>
              {onDeleteWord ? (
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="vocab-edit-delete"
                  onClick={() => {
                    if (window.confirm(`Удалить «${card.writing}» из словаря тренировок?`)) {
                      onDeleteWord()
                      closeEditor()
                    }
                  }}
                >
                  Удалить слово
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <>
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
              </>
            ) : (
              <>
                <div className="vocab-choice-grid" data-testid="vocab-choice-grid">
                  {choiceOptions.map((option, index) => {
                    const isSelected = selectedChoice === option
                    const isCorrect = option === correctAnswer
                    const showResult = Boolean(selectedChoice)
                    let className = 'vocab-choice-button'
                    if (showResult && isCorrect) className += ' is-correct'
                    if (showResult && isSelected && !isCorrect) className += ' is-wrong'
                    if (prompt?.kind === 'writing') className += ' is-writing'
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
              {onDontKnow ? (
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="vocab-dont-know"
                  onClick={onDontKnow}
                >
                  Не помню
                </button>
              ) : null}
              <button type="button" className="ghost-button" data-testid="vocab-skip-next" onClick={onSkipNext}>
                Следующее →
              </button>
            </div>

            <div className="vocab-mine-row" role="group" aria-label="Карточка и набор">
              {onSaveWordEdit ? (
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="vocab-edit-card"
                  onClick={openEditor}
                >
                  Изменить слово
                </button>
              ) : null}
              {onAddCurrentToMyWords ? (
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="vocab-add-current-to-mine"
                  disabled={currentInMyWords}
                  onClick={onAddCurrentToMyWords}
                >
                  {currentInMyWords ? 'Уже в моих словах' : 'Это слово в мои'}
                </button>
              ) : null}
              {onToggleLearned ? (
                <button
                  type="button"
                  className={currentLearned ? 'ghost-button is-learned-on' : 'ghost-button'}
                  data-testid="vocab-toggle-learned"
                  onClick={onToggleLearned}
                >
                  {currentLearned ? 'Выучено ✓' : 'Выучено'}
                </button>
              ) : null}
              {currentExcluded && onRestoreToSession ? (
                <button
                  type="button"
                  className="ghost-button is-excluded-on"
                  data-testid="vocab-restore-session"
                  onClick={onRestoreToSession}
                >
                  Вернуть в тренировку
                </button>
              ) : onExcludeFromSession ? (
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="vocab-exclude-session"
                  onClick={onExcludeFromSession}
                >
                  Исключить
                </button>
              ) : null}
              {showAddSessionToMyWords && onAddSessionToMyWords ? (
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="vocab-add-session-to-mine"
                  onClick={onAddSessionToMyWords}
                >
                  Набор в мои слова ({sessionWordCount})
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </PracticeShell>
  )
}
