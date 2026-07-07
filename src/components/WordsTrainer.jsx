import { useMemo, useRef, useState } from 'react'
import {
  WORDS,
  WORD_HYPERPARAMS,
  getReadingAnswers,
  getTranslationAnswers,
  getWordById,
  normalizeRu,
} from '../data/words'
import {
  createInitialSession,
  createNextRoundState,
  evaluateInput,
  evaluateSubmission,
  pickNextCardId,
} from '../lib/trainer'
import { InfoTip } from './InfoTip'
import { SessionChips } from './SessionChips'

const answerModeOptions = [
  {
    id: 'reading',
    label: 'Чтение',
    hint: 'Введите чтение слова ромадзи.',
  },
  {
    id: 'translation',
    label: 'Перевод',
    hint: 'Введите перевод по-русски. Перевод в карточке скрыт до ответа.',
  },
]

const inputModeOptions = [
  {
    id: 'instant',
    label: 'Автозачет',
    hint: 'Ответ принимается сразу, как только введён. Ошибка — на первой неверной букве.',
  },
  {
    id: 'submit',
    label: 'По Enter',
    hint: 'Ответ отправляется клавишей Enter. При ошибке покажем правильный вариант.',
  },
]

const displayKanaOptions = [
  { id: 'hiragana', label: 'Хирагана' },
  { id: 'katakana', label: 'Катакана' },
  { id: 'both', label: 'Обе' },
]

const pickModeOptions = [
  { id: 'adaptive', label: 'Адаптивный', hint: 'Чаще слабые, медленные и новые слова' },
  { id: 'even', label: 'Равномерный', hint: 'Все слова с одинаковой частотой' },
]

const emptySessionStats = { answered: 0, clean: 0, streak: 0 }

export function WordsTrainer({ onPatchPreferences, onToggleFavorite, onUpdateStats, wordsState }) {
  const { preferences, favorites, stats } = wordsState
  const [view, setView] = useState('setup')
  const [currentWordId, setCurrentWordId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [session, setSession] = useState(() => createInitialSession())
  const [feedback, setFeedback] = useState({ type: 'idle', text: '' })
  const [sessionStats, setSessionStats] = useState(emptySessionStats)
  const [revealed, setRevealed] = useState(false)
  const [search, setSearch] = useState('')
  const [listExpanded, setListExpanded] = useState(false)
  const roundRef = useRef(createNextRoundState())
  const inputRef = useRef(null)
  const pendingAdvanceRef = useRef(null)
  const audioRef = useRef(null)

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const activePool = useMemo(
    () => (preferences.onlyFavorites ? WORDS.filter((word) => favoriteSet.has(word.id)) : WORDS),
    [favoriteSet, preferences.onlyFavorites],
  )
  const activeWord = currentWordId ? getWordById(currentWordId) : null
  const isTranslation = preferences.answerMode === 'translation'
  const isSubmitInput = isTranslation || preferences.inputMode === 'submit'

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return WORDS
    }
    return WORDS.filter(
      (word) =>
        word.kanji.includes(query) ||
        word.kana.includes(query) ||
        word.romaji.includes(query) ||
        word.meanings.some((meaning) => meaning.toLowerCase().includes(query)),
    )
  }, [search])

  function queueAdvance(callback, delay) {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
    }
    pendingAdvanceRef.current = setTimeout(() => {
      pendingAdvanceRef.current = null
      callback()
    }, delay)
  }

  function advanceToNextWord(nextSessionOverride) {
    const nextSession = nextSessionOverride ?? session
    if (!activePool.length) {
      stopPractice()
      return
    }

    const nextId = pickNextCardId(activePool, stats, nextSession, preferences.mode, WORD_HYPERPARAMS)
    if (!nextId) {
      stopPractice()
      return
    }

    const pickedFromQueue = nextSession.mistakeQueue.includes(nextId)
    const now = Date.now()
    roundRef.current = createNextRoundState(now)
    setCurrentWordId(nextId)
    setInputValue('')
    setRevealed(false)
    setFeedback({ type: 'idle', text: '' })
    setSession({
      ...nextSession,
      sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
    })
    onUpdateStats(nextId, 'seen', { now })
    inputRef.current?.focus()
  }

  function startPractice() {
    if (!activePool.length) {
      setFeedback({ type: 'error', text: 'В избранном пока нет слов — добавьте их звездочкой в списке ниже.' })
      return
    }

    setView('practice')
    setSessionStats(emptySessionStats)
    advanceToNextWord(
      createInitialSession({
        poolIds: activePool.map((word) => word.id),
        mode: preferences.mode,
      }),
    )
  }

  function stopPractice() {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
      pendingAdvanceRef.current = null
    }
    setView('setup')
    setCurrentWordId(null)
    setInputValue('')
    setFeedback({ type: 'idle', text: '' })
  }

  function getAnswers(word) {
    return isTranslation ? getTranslationAnswers(word) : getReadingAnswers(word)
  }

  function finalizeOutcome(kind) {
    if (!activeWord) {
      return
    }

    const now = Date.now()
    const activeRound = roundRef.current
    const nextSession = {
      ...session,
      recentHistory: [...session.recentHistory, activeWord.id].slice(-3),
      lastCardId: activeWord.id,
      mistakeQueue: session.mistakeQueue.filter((id) => id !== activeWord.id),
    }
    if (kind === 'hint') {
      nextSession.mistakeQueue = [activeWord.id, ...nextSession.mistakeQueue].slice(0, WORD_HYPERPARAMS.queueSize)
    }

    const clean = kind === 'correct' && activeRound.mistakes === 0
    setSessionStats((prev) => ({
      answered: prev.answered + 1,
      clean: prev.clean + (clean ? 1 : 0),
      streak: clean ? prev.streak + 1 : 0,
    }))
    setSession(nextSession)
    setRevealed(true)
    setFeedback({ type: 'success', text: '' })
    onUpdateStats(activeWord.id, kind, {
      now,
      latencyMs: now - activeRound.shownAt,
      mistakesOnCard: activeRound.mistakes,
      hintUsed: activeRound.hintUsed,
      inputMode: isSubmitInput ? 'submit' : 'instant',
    })

    // Пауза дольше, чем в кане: успеть увидеть перевод и прочую информацию.
    queueAdvance(() => advanceToNextWord(nextSession), kind === 'correct' ? 900 : 1200)
  }

  function registerWrongAttempt() {
    if (!activeWord) {
      return
    }
    roundRef.current = { ...roundRef.current, mistakes: roundRef.current.mistakes + 1 }
    setSession((prev) => ({
      ...prev,
      mistakeQueue: [activeWord.id, ...prev.mistakeQueue.filter((id) => id !== activeWord.id)].slice(
        0,
        WORD_HYPERPARAMS.queueSize,
      ),
    }))
    onUpdateStats(activeWord.id, 'wrong', {
      now: Date.now(),
      inputMode: isSubmitInput ? 'submit' : 'instant',
    })
  }

  function revealHint() {
    if (!activeWord || view !== 'practice') {
      return
    }
    roundRef.current = { ...roundRef.current, hintUsed: true }
    setRevealed(true)
    setFeedback({
      type: 'hint',
      text: isTranslation
        ? `Перевод: ${activeWord.meanings[0]}`
        : `Чтение: ${getReadingAnswers(activeWord)[0]}`,
    })
    inputRef.current?.focus()
  }

  function handleInputChange(event) {
    if (!activeWord || view !== 'practice') {
      return
    }

    if (isSubmitInput) {
      setInputValue(isTranslation ? event.target.value : event.target.value.toLowerCase().replace(/\s+/g, ''))
      return
    }

    const value = event.target.value.toLowerCase().replace(/\s+/g, '')
    const answers = getAnswers(activeWord)
    const previousResult = evaluateInput(answers, inputValue)
    setInputValue(value)

    const result = evaluateInput(answers, value)
    if (result === 'wrong') {
      if (previousResult !== 'wrong') {
        registerWrongAttempt()
        setFeedback({ type: 'wrong', text: '' })
      }
      return
    }

    if (feedback.type === 'wrong') {
      setFeedback(
        roundRef.current.hintUsed
          ? { type: 'hint', text: `Чтение: ${answers[0]}` }
          : { type: 'idle', text: '' },
      )
    }

    if (result === 'correct') {
      finalizeOutcome(roundRef.current.hintUsed ? 'hint' : 'correct')
    }
  }

  function handleSubmitAnswer() {
    if (!activeWord || pendingAdvanceRef.current) {
      return
    }

    if (isTranslation) {
      handleSubmitTranslation()
      return
    }

    const answers = getAnswers(activeWord)
    const result = evaluateSubmission(answers, inputValue)
    if (result === 'empty') {
      return
    }

    if (result === 'correct') {
      finalizeOutcome(roundRef.current.hintUsed ? 'hint' : 'correct')
      return
    }

    registerWrongAttempt()
    roundRef.current = { ...roundRef.current, hintUsed: true }
    setRevealed(true)
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: `Правильно: ${answers[0]}. Введите верное чтение.`,
    })
  }

  function handleSubmitTranslation() {
    if (!activeWord || pendingAdvanceRef.current) {
      return
    }
    const input = normalizeRu(inputValue)
    if (!input) {
      return
    }

    if (getTranslationAnswers(activeWord).includes(input)) {
      finalizeOutcome(roundRef.current.hintUsed ? 'hint' : 'correct')
      return
    }

    registerWrongAttempt()
    roundRef.current = { ...roundRef.current, hintUsed: true }
    setRevealed(true)
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: `Правильно: ${activeWord.meanings[0]}. Введите верный перевод.`,
    })
  }

  function handleInputKeyDown(event) {
    if (isSubmitInput && event.key === 'Enter') {
      event.preventDefault()
      handleSubmitAnswer()
      return
    }

    if (!isTranslation && event.code === 'Space') {
      event.preventDefault()
      revealHint()
    }
  }

  function playAudio(word) {
    audioRef.current?.pause()
    audioRef.current = new Audio(word.audio)
    audioRef.current.play().catch(() => {})
  }

  function getReadingLine(word) {
    if (preferences.displayKana === 'katakana') {
      return word.katakana
    }
    if (preferences.displayKana === 'both') {
      return `${word.kana} · ${word.katakana}`
    }
    return word.kana
  }

  if (view === 'setup') {
    return (
      <section className="panel controls-panel">
        <div className="section-heading">
          <h2>Слова JLPT N5</h2>
          <p className="subsection-note">300 базовых слов: чтение ромадзи или перевод на русский.</p>
        </div>

        <div className="control-group">
          <span className="group-label">Что вводить</span>
          <div className="segmented">
            {answerModeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`word-answer-${option.id}`}
                className={preferences.answerMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
                onClick={() => onPatchPreferences({ answerMode: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="control-hint">
            {answerModeOptions.find((option) => option.id === preferences.answerMode)?.hint}
          </p>
        </div>

        {preferences.answerMode === 'reading' ? (
          <div className="control-group">
            <span className="group-label">Ввод</span>
            <div className="segmented">
              {inputModeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`word-input-${option.id}`}
                  className={preferences.inputMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
                  onClick={() => onPatchPreferences({ inputMode: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="control-hint">
              {inputModeOptions.find((option) => option.id === preferences.inputMode)?.hint}
            </p>
          </div>
        ) : null}

        <div className="control-group">
          <span className="group-label">Кана в карточке</span>
          <div className="segmented">
            {displayKanaOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`word-kana-${option.id}`}
                className={preferences.displayKana === option.id ? 'segmented-button is-active' : 'segmented-button'}
                onClick={() => onPatchPreferences({ displayKana: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span className="group-label">Подбор</span>
          <div className="mode-list">
            {pickModeOptions.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={preferences.mode === mode.id ? 'mode-card is-active' : 'mode-card'}
                onClick={() => onPatchPreferences({ mode: mode.id })}
              >
                <strong>{mode.label}</strong>
                <small>{mode.hint}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="control-row control-row-compact">
          <label className="toggle-option">
            <input
              type="checkbox"
              data-testid="only-favorites"
              checked={preferences.onlyFavorites}
              onChange={(event) => onPatchPreferences({ onlyFavorites: event.target.checked })}
            />
            <span>Только избранные ({favorites.length})</span>
          </label>
        </div>

        <div className="primary-actions">
          <button type="button" className="primary-button" onClick={startPractice}>
            <span data-testid="start-words">Практиковаться</span>
          </button>
        </div>

        {feedback.type === 'error' ? <p className="feedback is-error">{feedback.text}</p> : null}

        <div className="control-group word-list-block">
          <div className="row-heading">
            <span className="group-label">
              Все слова <InfoTip text="Звездочка добавляет слово в избранное — их можно тренировать отдельно." />
            </span>
            <button
              type="button"
              className="text-button"
              data-testid="toggle-word-list"
              onClick={() => setListExpanded((value) => !value)}
            >
              {listExpanded ? 'Свернуть' : 'Показать список'}
            </button>
          </div>

          {listExpanded ? (
            <>
              <input
                type="text"
                className="word-search"
                data-testid="word-search"
                placeholder="Поиск: кандзи, кана, ромадзи или перевод"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="word-browser" data-testid="word-browser">
                {filteredWords.map((word) => (
                  <div key={word.id} className="word-row">
                    <button
                      type="button"
                      className={favoriteSet.has(word.id) ? 'star-button is-active' : 'star-button'}
                      data-testid={`fav-${word.id}`}
                      aria-label={favoriteSet.has(word.id) ? 'Убрать из избранного' : 'В избранное'}
                      onClick={() => onToggleFavorite(word.id)}
                    >
                      {favoriteSet.has(word.id) ? '★' : '☆'}
                    </button>
                    <span className="word-row-kanji">{word.kanji}</span>
                    <span className="word-row-kana">{word.kana}</span>
                    <span className="word-row-meaning">{word.meanings[0]}</span>
                  </div>
                ))}
                {!filteredWords.length ? <div className="chart-empty">Ничего не найдено.</div> : null}
              </div>
            </>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="panel practice-panel">
      <div className="practice-topline">
        <button type="button" className="text-button" onClick={stopPractice}>
          ← Назад
        </button>
        <SessionChips
          sessionStats={{
            ...sessionStats,
            accuracy: sessionStats.answered
              ? Math.round((sessionStats.clean / sessionStats.answered) * 100)
              : 100,
          }}
        />
      </div>

      {activeWord ? (
        <div className="practice-layout word-practice-layout">
          <div className={`practice-stage ${feedback.type ? `is-${feedback.type}` : ''}`}>
            <div className="question-block">
              <p className="question-script">JLPT N5</p>
              <div className="word-symbol" aria-live="polite">
                <span data-testid="current-word">{activeWord.kanji}</span>
              </div>
              {activeWord.kanji !== getReadingLine(activeWord) ? (
                <p className="word-reading" data-testid="word-reading">{getReadingLine(activeWord)}</p>
              ) : null}
            </div>

            <div className="answer-block">
              <input
                ref={inputRef}
                type="text"
                className="answer-input word-answer-input"
                data-testid="word-input"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint={isSubmitInput ? 'go' : 'done'}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                placeholder={isTranslation ? 'перевод по-русски' : 'romaji'}
              />

              <div className="feedback-row">
                <p className={`feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>{feedback.text || ' '}</p>
              </div>

              <div className="answer-actions">
                <button
                  type="button"
                  className="hint-button"
                  data-testid="word-hint-button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={revealHint}
                >
                  Показать ответ
                </button>
                <p className="question-note">
                  {isTranslation || preferences.inputMode === 'submit' ? (
                    <>
                      <kbd>Enter</kbd> — проверить
                    </>
                  ) : (
                    <>
                      <kbd>Space</kbd> — ответ · зачет автоматом
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <aside className="word-info-panel" data-testid="word-info">
            <div className="word-info-head">
              <button
                type="button"
                className={favoriteSet.has(activeWord.id) ? 'star-button is-active' : 'star-button'}
                data-testid="practice-fav"
                aria-label={favoriteSet.has(activeWord.id) ? 'Убрать из избранного' : 'В избранное'}
                onClick={() => onToggleFavorite(activeWord.id)}
              >
                {favoriteSet.has(activeWord.id) ? '★' : '☆'}
              </button>
              <button type="button" className="audio-button" data-testid="word-audio" onClick={() => playAudio(activeWord)}>
                ▶ Произношение
              </button>
            </div>

            <div className="word-info-section">
              <span className="group-label">Перевод</span>
              {!isTranslation || revealed ? (
                <ul className="word-meanings" data-testid="word-meanings">
                  {activeWord.meanings.slice(0, 4).map((meaning) => (
                    <li key={meaning}>{meaning}</li>
                  ))}
                </ul>
              ) : (
                <p className="word-hidden-note" data-testid="word-meanings-hidden">Скрыт до ответа</p>
              )}
            </div>

            <div className="word-info-section">
              <span className="group-label">English</span>
              {!isTranslation || revealed ? (
                <p className="word-en">{activeWord.en}</p>
              ) : (
                <p className="word-hidden-note">Скрыт до ответа</p>
              )}
            </div>

            {activeWord.pos.length ? (
              <div className="word-info-section">
                <span className="group-label">Часть речи</span>
                <div className="pos-chips">
                  {activeWord.pos.map((label) => (
                    <span key={label} className="pos-chip">{label}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  )
}
