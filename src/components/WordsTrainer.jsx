import { useEffect, useMemo, useRef, useState } from 'react'
import { isCustomWordId } from '../data/custom-words'
import {
  WORDS,
  WORD_DATASET_LABEL,
  WORD_GROUP_PRESETS,
  WORD_GROUPS,
  WORD_THEME_CATEGORIES,
  WORD_HYPERPARAMS,
  buildWordPool,
  getDictionaryWords,
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

function formatWordAnswer(word) {
  const romaji = word.romaji || getReadingAnswers(word)[0] || ''
  const meaning = word.meanings?.[0]
  if (romaji && meaning) {
    return `${romaji} · ${meaning}`
  }
  if (meaning) {
    return meaning
  }
  if (romaji) {
    return romaji
  }
  return word.kanji || word.kana || '—'
}

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

const studySourceOptions = [
  { id: 'groups', label: 'По темам', hint: 'Выберите темы и пачки из базы.' },
  { id: 'dictionary', label: 'Мой словарь', hint: 'Тренируйте только слова из вашего словаря.' },
]

const emptyCustomForm = {
  kanji: '',
  kana: '',
  romaji: '',
  meanings: '',
  audio: '',
  en: '',
}

const emptySessionStats = { answered: 0, clean: 0, streak: 0 }

export function WordsTrainer({
  onAddCustomWord,
  onAddGroupToDictionary,
  onPatchPreferences,
  onRemoveCustomWord,
  onToggleDictionary,
  onUpdateStats,
  wordsState,
}) {
  const { preferences, dictionary, customWords, stats } = wordsState
  const [view, setView] = useState('setup')
  const [currentWordId, setCurrentWordId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [session, setSession] = useState(() => createInitialSession())
  const [feedback, setFeedback] = useState({ type: 'idle', text: '' })
  const [sessionStats, setSessionStats] = useState(emptySessionStats)
  const [revealed, setRevealed] = useState(false)
  const [search, setSearch] = useState('')
  const [listExpanded, setListExpanded] = useState(false)
  const [dictionaryExpanded, setDictionaryExpanded] = useState(true)
  const [customFormOpen, setCustomFormOpen] = useState(false)
  const [customForm, setCustomForm] = useState(emptyCustomForm)
  const [customFormError, setCustomFormError] = useState('')
  const roundRef = useRef(createNextRoundState())
  const inputRef = useRef(null)
  const pendingAdvanceRef = useRef(null)
  const audioRef = useRef(null)
  const practiceRef = useRef({})

  const isDictionaryMode = preferences.studySource === 'dictionary'
  const dictionarySet = useMemo(() => new Set(dictionary), [dictionary])
  const selectedWordGroups = preferences.selectedWordGroups ?? []
  const dictionaryWords = useMemo(
    () => getDictionaryWords(dictionary, customWords),
    [customWords, dictionary],
  )
  const activePool = useMemo(
    () =>
      buildWordPool({
        studySource: preferences.studySource,
        selectedGroups: selectedWordGroups,
        dictionary,
        customWords,
      }),
    [customWords, dictionary, preferences.studySource, selectedWordGroups],
  )
  const selectedWordIds = useMemo(
    () =>
      new Set(
        buildWordPool({
          studySource: 'groups',
          selectedGroups: selectedWordGroups,
        }).map((word) => word.id),
      ),
    [selectedWordGroups],
  )
  const activeWord = currentWordId ? getWordById(currentWordId, customWords) : null
  const isTranslation = preferences.answerMode === 'translation'
  const isSubmitInput = isTranslation || preferences.inputMode === 'submit'

  const activeGroupLabel = useMemo(() => {
    if (isDictionaryMode) {
      return 'Мой словарь'
    }
    if (!activeWord) {
      return WORD_THEME_CATEGORIES[0]?.label ?? 'Слова'
    }
    const group = WORD_GROUPS.find((item) => item.wordIds.includes(activeWord.id))
    return group?.shortLabel ?? group?.label ?? 'Слова'
  }, [activeWord, isDictionaryMode])

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

  function showWord(wordId) {
    const now = Date.now()
    roundRef.current = createNextRoundState(now)
    setCurrentWordId(wordId)
    setInputValue('')
    setRevealed(false)
    setFeedback({ type: 'idle', text: '' })
    onUpdateStats(wordId, 'seen', { now })
    inputRef.current?.focus()
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
    showWord(nextId)
    setSession({
      ...nextSession,
      sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
    })
  }

  function navigatePool(step) {
    if (!activePool.length || !currentWordId || pendingAdvanceRef.current) {
      return
    }

    const currentIndex = activePool.findIndex((word) => word.id === currentWordId)
    if (currentIndex === -1) {
      return
    }

    const nextIndex = (currentIndex + step + activePool.length) % activePool.length
    showWord(activePool[nextIndex].id)
  }

  function startPractice() {
    if (!isDictionaryMode && !selectedWordGroups.length) {
      setFeedback({ type: 'error', text: 'Выберите тему или пачку слов для тренировки.' })
      return
    }

    if (!activePool.length) {
      setFeedback({
        type: 'error',
        text: isDictionaryMode
          ? 'Словарь пуст — добавьте слова из базы или создайте свои.'
          : 'В наборе пока нет слов для практики.',
      })
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
      text: formatWordAnswer(activeWord),
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
    if (!answers.length) {
      setInputValue(value)
      return
    }

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
          ? { type: 'hint', text: formatWordAnswer(activeWord) }
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
    if (!answers.length) {
      finalizeOutcome('correct')
      return
    }

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
      text: `Правильно: ${formatWordAnswer(activeWord)}. Введите верное чтение.`,
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

    const answers = getTranslationAnswers(activeWord)
    if (!answers.length) {
      finalizeOutcome('correct')
      return
    }

    if (answers.includes(input)) {
      finalizeOutcome(roundRef.current.hintUsed ? 'hint' : 'correct')
      return
    }

    registerWrongAttempt()
    roundRef.current = { ...roundRef.current, hintUsed: true }
    setRevealed(true)
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: `Правильно: ${formatWordAnswer(activeWord)}. Введите верный перевод.`,
    })
  }

  function handlePracticeKeyDown(event) {
    const ctx = practiceRef.current
    if (ctx.view !== 'practice' || !ctx.activeWord || ctx.pendingAdvance) {
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      ctx.navigatePool(-1)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      ctx.navigatePool(1)
      return
    }

    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      event.preventDefault()
      ctx.playAudio(ctx.activeWord)
      return
    }

    if (event.code === 'Space') {
      event.preventDefault()
      ctx.revealHint()
      return
    }

    if (ctx.isSubmitInput && event.key === 'Enter') {
      event.preventDefault()
      ctx.handleSubmitAnswer()
    }
  }

  practiceRef.current = {
    view,
    activeWord,
    inputValue,
    isSubmitInput,
    isTranslation,
    pendingAdvance: pendingAdvanceRef.current,
    navigatePool,
    playAudio,
    handleSubmitAnswer,
    revealHint,
  }

  useEffect(() => {
    const handleWindowKeyDown = (event) => handlePracticeKeyDown(event)
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [])

  function playAudio(word) {
    if (!word.audio) {
      return
    }
    audioRef.current?.pause()
    audioRef.current = new Audio(word.audio)
    audioRef.current.play().catch(() => {})
  }

  function applyWordGroups(groupIds) {
    onPatchPreferences({ selectedWordGroups: groupIds, studySource: 'groups' })
    setFeedback({ type: 'idle', text: '' })
  }

  function enableDictionaryMode() {
    onPatchPreferences({ studySource: 'dictionary' })
    setFeedback({ type: 'idle', text: '' })
  }

  function setStudySource(studySource) {
    onPatchPreferences({ studySource })
    setFeedback({ type: 'idle', text: '' })
  }

  function toggleWordGroup(groupId) {
    const nextGroups = selectedWordGroups.includes(groupId)
      ? selectedWordGroups.filter((id) => id !== groupId)
      : [...selectedWordGroups, groupId]
    applyWordGroups(nextGroups)
  }

  function handleAddCustomWord(event) {
    event.preventDefault()
    const error = onAddCustomWord(customForm)
    if (error) {
      setCustomFormError(error)
      return
    }
    setCustomForm(emptyCustomForm)
    setCustomFormError('')
    setCustomFormOpen(false)
    setFeedback({ type: 'idle', text: '' })
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

  function renderDictionaryRow(word) {
    const meaning = word.meanings?.[0] || word.en || '—'
    return (
      <div key={word.id} className="word-row">
        <button
          type="button"
          className="star-button is-active"
          data-testid={`dict-${word.id}`}
          aria-label="Убрать из словаря"
          onClick={() =>
            isCustomWordId(word.id) ? onRemoveCustomWord(word.id) : onToggleDictionary(word.id)
          }
        >
          ★
        </button>
        <span className="word-row-kanji">{word.kanji}</span>
        <span className="word-row-kana">{word.kana}</span>
        <span className="word-row-meaning">{meaning}</span>
        {word.custom ? <span className="word-row-tag">своё</span> : null}
      </div>
    )
  }

  if (view === 'setup') {
    return (
      <section className="panel controls-panel">
        <div className="section-heading">
          <h2>Тренажёр слов</h2>
          <p className="subsection-note">
            База {WORD_DATASET_LABEL}: учитесь по темам или по своему словарю.
          </p>
        </div>

        <div className="control-group">
          <span className="group-label">Источник слов</span>
          <div className="segmented">
            {studySourceOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`word-source-${option.id}`}
                className={preferences.studySource === option.id ? 'segmented-button is-active' : 'segmented-button'}
                onClick={() => setStudySource(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="control-hint">
            {studySourceOptions.find((option) => option.id === preferences.studySource)?.hint}
          </p>
        </div>

        {isDictionaryMode ? (
          <div className="control-group word-dictionary-block">
            <div className="row-heading">
              <span className="group-label">
                Мой словарь ({dictionaryWords.length}){' '}
                <InfoTip text="Слова из базы и ваши записи. Все поля при добавлении необязательны — достаточно хотя бы одного." />
              </span>
              <div className="inline-actions">
                <button
                  type="button"
                  className="text-button"
                  data-testid="toggle-custom-word-form"
                  onClick={() => setCustomFormOpen((value) => !value)}
                >
                  {customFormOpen ? 'Скрыть форму' : 'Добавить слово'}
                </button>
                <button
                  type="button"
                  className="text-button"
                  data-testid="toggle-dictionary-list"
                  onClick={() => setDictionaryExpanded((value) => !value)}
                >
                  {dictionaryExpanded ? 'Свернуть' : 'Показать'}
                </button>
              </div>
            </div>

            {customFormOpen ? (
              <form className="custom-word-form" data-testid="custom-word-form" onSubmit={handleAddCustomWord}>
                <div className="custom-word-grid">
                  <label>
                    <span>Кандзи</span>
                    <input
                      type="text"
                      data-testid="custom-kanji"
                      value={customForm.kanji}
                      onChange={(event) => setCustomForm((prev) => ({ ...prev, kanji: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Кана</span>
                    <input
                      type="text"
                      data-testid="custom-kana"
                      value={customForm.kana}
                      onChange={(event) => setCustomForm((prev) => ({ ...prev, kana: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Ромадзи</span>
                    <input
                      type="text"
                      data-testid="custom-romaji"
                      value={customForm.romaji}
                      onChange={(event) => setCustomForm((prev) => ({ ...prev, romaji: event.target.value }))}
                    />
                  </label>
                  <label className="custom-word-wide">
                    <span>Перевод</span>
                    <input
                      type="text"
                      data-testid="custom-meanings"
                      placeholder="через запятую"
                      value={customForm.meanings}
                      onChange={(event) => setCustomForm((prev) => ({ ...prev, meanings: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>English</span>
                    <input
                      type="text"
                      data-testid="custom-en"
                      value={customForm.en}
                      onChange={(event) => setCustomForm((prev) => ({ ...prev, en: event.target.value }))}
                    />
                  </label>
                  <label className="custom-word-wide">
                    <span>Аудио URL</span>
                    <input
                      type="text"
                      data-testid="custom-audio"
                      placeholder="необязательно"
                      value={customForm.audio}
                      onChange={(event) => setCustomForm((prev) => ({ ...prev, audio: event.target.value }))}
                    />
                  </label>
                </div>
                {customFormError ? <p className="feedback is-error">{customFormError}</p> : null}
                <button type="submit" className="secondary-button" data-testid="custom-word-save">
                  Сохранить в словарь
                </button>
              </form>
            ) : null}

            {dictionaryExpanded ? (
              <div className="word-browser" data-testid="dictionary-browser">
                {dictionaryWords.map(renderDictionaryRow)}
                {!dictionaryWords.length ? (
                  <div className="chart-empty">Словарь пуст. Добавьте слова из базы или создайте свои.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="control-group">
            <div className="row-heading">
              <span className="group-label">Категории</span>
              <div className="inline-actions">
                <button
                  type="button"
                  className="text-button"
                  data-testid="word-groups-all"
                  onClick={() => applyWordGroups(WORD_GROUPS.map((group) => group.id))}
                >
                  Все
                </button>
                {WORD_GROUP_PRESETS.filter((preset) => preset.id !== 'all' && preset.id !== 'dictionary').map(
                  (preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="text-button"
                      data-testid={`word-preset-${preset.id}`}
                      onClick={() => applyWordGroups(preset.groups)}
                    >
                      {preset.label}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="text-button"
                  data-testid="word-preset-dictionary"
                  onClick={enableDictionaryMode}
                >
                  Словарь
                </button>
                <button
                  type="button"
                  className="text-button"
                  data-testid="word-groups-clear"
                  onClick={() => applyWordGroups([])}
                >
                  Ничего
                </button>
              </div>
            </div>

            <p className="control-hint" data-testid="word-pool-count">
              Выбрано {activePool.length} из {WORDS.length} слов
            </p>

            <div className="word-theme-board">
              {WORD_THEME_CATEGORIES.map((category) => (
                <section key={category.id} className="word-theme-section">
                  <div className="word-theme-heading">
                    <button
                      type="button"
                      className="text-button"
                      data-testid={`word-theme-${category.id}`}
                      onClick={() => applyWordGroups(category.groups.map((group) => group.id))}
                    >
                      {category.label}
                    </button>
                    <span className="word-theme-count">{category.groups.length} пач.</span>
                  </div>
                  <div className="word-group-board" role="group" aria-label={category.label}>
                    {category.groups.map((group) => {
                      const selected = selectedWordGroups.includes(group.id)
                      const allInDictionary = group.wordIds.every((wordId) => dictionarySet.has(wordId))
                      return (
                        <div key={group.id} className="word-group-card">
                          <button
                            type="button"
                            data-testid={`word-group-${group.id}`}
                            className={selected ? 'word-group-toggle is-active' : 'word-group-toggle'}
                            onClick={() => toggleWordGroup(group.id)}
                          >
                            <strong>{group.label}</strong>
                            <span className="word-group-preview">{group.preview}</span>
                          </button>
                          <button
                            type="button"
                            className={allInDictionary ? 'text-button is-muted' : 'text-button'}
                            data-testid={`word-group-add-dict-${group.id}`}
                            disabled={allInDictionary}
                            onClick={() => onAddGroupToDictionary(group.id)}
                          >
                            {allInDictionary ? 'В словаре' : 'В словарь'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

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

        <div className="primary-actions">
          <button type="button" className="primary-button" onClick={startPractice}>
            <span data-testid="start-words">Практиковаться</span>
          </button>
        </div>

        {feedback.type === 'error' ? <p className="feedback is-error">{feedback.text}</p> : null}

        {!isDictionaryMode ? (
          <div className="control-group word-list-block">
            <div className="row-heading">
              <span className="group-label">
                Список слов <InfoTip text="Звездочка добавляет слово в словарь. Серым отмечены слова вне выбранных пачек." />
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
                    <div
                      key={word.id}
                      className={selectedWordIds.has(word.id) ? 'word-row' : 'word-row is-outside-pool'}
                    >
                      <button
                        type="button"
                        className={dictionarySet.has(word.id) ? 'star-button is-active' : 'star-button'}
                        data-testid={`dict-${word.id}`}
                        aria-label={dictionarySet.has(word.id) ? 'Убрать из словаря' : 'В словарь'}
                        onClick={() => onToggleDictionary(word.id)}
                      >
                        {dictionarySet.has(word.id) ? '★' : '☆'}
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
        ) : null}
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
              <p className="question-script">{activeGroupLabel}</p>
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
                  <kbd>←</kbd> <kbd>→</kbd> — листать · <kbd>Shift</kbd> — произношение · <kbd>Space</kbd> — ответ
                  {isTranslation || preferences.inputMode === 'submit' ? (
                    <>
                      {' '}
                      · <kbd>Enter</kbd> — проверить
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          <aside className="word-info-panel" data-testid="word-info">
            <div className="word-info-head">
              <button
                type="button"
                className={dictionarySet.has(activeWord.id) ? 'star-button is-active' : 'star-button'}
                data-testid="practice-dict"
                aria-label={dictionarySet.has(activeWord.id) ? 'Убрать из словаря' : 'В словарь'}
                onClick={() => onToggleDictionary(activeWord.id)}
              >
                {dictionarySet.has(activeWord.id) ? '★' : '☆'}
              </button>
              {activeWord.audio ? (
                <button type="button" className="audio-button" data-testid="word-audio" onClick={() => playAudio(activeWord)}>
                  ▶ Произношение
                </button>
              ) : null}
            </div>

            <div className="word-info-section">
              <span className="group-label">Перевод</span>
              {!isTranslation || revealed ? (
                activeWord.meanings?.length ? (
                  <ul className="word-meanings" data-testid="word-meanings">
                    {activeWord.meanings.slice(0, 4).map((meaning) => (
                      <li key={meaning}>{meaning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="word-hidden-note" data-testid="word-meanings-empty">Не указан</p>
                )
              ) : (
                <p className="word-hidden-note" data-testid="word-meanings-hidden">Скрыт до ответа</p>
              )}
            </div>

            {activeWord.en ? (
              <div className="word-info-section">
                <span className="group-label">English</span>
                {!isTranslation || revealed ? (
                  <p className="word-en">{activeWord.en}</p>
                ) : (
                  <p className="word-hidden-note">Скрыт до ответа</p>
                )}
              </div>
            ) : null}

            {activeWord.pos?.length ? (
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
