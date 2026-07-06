import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import md5 from 'blueimp-md5'
import './App.css'
import {
  GROUP_IDS,
  KANA_GROUPS,
  KANA_STATS_CARDS,
  WORD_BANK,
  buildPool,
  getCardById,
} from './data/kana'
import {
  DEFAULT_HYPERPARAMS,
  createInitialSession,
  createNextRoundState,
  evaluateInput,
  getAdaptiveWeight,
  getCardProblemScore,
  getGlobalStats,
  pickNextCardId,
  updateCardStats,
} from './lib/trainer'
import {
  createDefaultAppState,
  loadAppState,
  resetStoredState,
  saveAppState,
} from './lib/storage'

const modeOptions = [
  { id: 'adaptive', label: 'Адаптивный' },
  { id: 'even', label: 'Равномерный' },
  { id: 'problem', label: 'Проблемные' },
  { id: 'mistakes', label: 'Повтор подсказанных' },
]

const scriptOptions = [
  { id: 'hiragana', label: 'Хирагана' },
  { id: 'katakana', label: 'Катакана' },
  { id: 'both', label: 'Обе азбуки' },
]

const helperOptions = [
  { id: 'hidden', label: 'Скрыть' },
  { id: 'stroke', label: 'Штрихи' },
  { id: 'words', label: 'Слова' },
]

const settingsFields = [
  { id: 'masteryGain', label: 'Рост мастерства', min: 0.05, max: 0.4, step: 0.01, hint: 'Скорость роста после чистого ответа.' },
  { id: 'hintPenalty', label: 'Штраф за подсказку', min: 0.05, max: 0.4, step: 0.01, hint: 'Насколько подсказка ослабляет карточку.' },
  { id: 'retireStreak', label: 'Серия до ослабления', min: 3, max: 12, step: 1, hint: 'После этой серии карточка выпадает реже.' },
  { id: 'masteredWeight', label: 'Вес выученных', min: 0.05, max: 0.7, step: 0.01, hint: 'Нижний вес для устойчивых карточек.' },
  { id: 'recentMistakeBoost', label: 'Буст слабых', min: 1, max: 5, step: 0.1, hint: 'Насколько сильнее поднимать слабые карточки.' },
  { id: 'problemThreshold', label: 'Порог проблемности', min: 0.2, max: 0.8, step: 0.01, hint: 'Что считать проблемной карточкой.' },
]

function App() {
  const [appState, setAppState] = useState(() => loadAppState(createDefaultAppState))
  const [currentTab, setCurrentTab] = useState('trainer')
  const [practiceState, setPracticeState] = useState('setup')
  const [currentCardId, setCurrentCardId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [session, setSession] = useState(() => createInitialSession())
  const [round, setRound] = useState(() => createNextRoundState())
  const [feedback, setFeedback] = useState({ type: 'idle', text: '' })
  const [showFineTuning, setShowFineTuning] = useState(false)
  const [helperMode, setHelperMode] = useState('stroke')
  const [lastVisibleHelperMode, setLastVisibleHelperMode] = useState('stroke')
  const inputRef = useRef(null)
  const pendingAdvanceRef = useRef(null)
  const roundRef = useRef(createNextRoundState())
  const practiceStateRef = useRef(practiceState)
  const activeCardRef = useRef(null)

  const { preferences, stats } = appState

  const activePool = useMemo(
    () => buildPool(preferences.scriptMode, preferences.selectedGroups),
    [preferences.scriptMode, preferences.selectedGroups],
  )
  const activeCard = currentCardId ? getCardById(currentCardId) : null
  const helperVisible = helperMode !== 'hidden'
  const globalStats = useMemo(
    () => getGlobalStats(KANA_STATS_CARDS, stats, preferences.hyperparams),
    [preferences.hyperparams, stats],
  )
  const totalCards = KANA_STATS_CARDS.length
  const activeSymbolSet = useMemo(() => new Set(activePool.map((card) => card.symbol)), [activePool])

  const helperWords = useMemo(() => {
    if (!activeCard) {
      return []
    }

    return WORD_BANK.filter((word) => {
      if (word.script !== activeCard.script) {
        return false
      }

      return [...word.kana].every((symbol) => activeSymbolSet.has(symbol) || symbol === 'ー')
    }).slice(0, 10)
  }, [activeCard, activeSymbolSet])

  const sortedHardCards = useMemo(() => {
    return [...KANA_STATS_CARDS]
      .sort((left, right) => {
        const rightScore = getCardProblemScore(stats[right.id], preferences.hyperparams, Date.now())
        const leftScore = getCardProblemScore(stats[left.id], preferences.hyperparams, Date.now())
        return rightScore - leftScore
      })
      .slice(0, 12)
  }, [preferences.hyperparams, stats])
  const infographicItems = useMemo(
    () => [
      { label: 'Точность', value: globalStats.accuracy, suffix: '%', percent: globalStats.accuracy },
      { label: 'Мастерство', value: globalStats.mastery, suffix: '%', percent: globalStats.mastery },
      {
        label: 'Стабильные',
        value: globalStats.retiredCount,
        suffix: ` / ${totalCards}`,
        percent: Math.round((globalStats.retiredCount / totalCards) * 100),
      },
      {
        label: 'Проблемные',
        value: globalStats.problemCount,
        suffix: ` / ${totalCards}`,
        percent: Math.round((globalStats.problemCount / totalCards) * 100),
      },
    ],
    [globalStats, totalCards],
  )

  useEffect(() => {
    saveAppState(appState)
  }, [appState])

  useEffect(() => {
    if (practiceState === 'practice') {
      inputRef.current?.focus()
    }
  }, [practiceState, currentCardId])

  useEffect(() => {
    practiceStateRef.current = practiceState
    activeCardRef.current = activeCard
  }, [practiceState, activeCard])

  useEffect(() => {
    const handleWindowKeyDown = (event) => {
      if (event.code === 'Space' && practiceStateRef.current === 'practice' && activeCardRef.current) {
        event.preventDefault()
        revealHint()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pendingAdvanceRef.current) {
        clearTimeout(pendingAdvanceRef.current)
      }
    }
  }, [])

  function patchPreferences(patch) {
    setAppState((prevState) => ({
      ...prevState,
      preferences: {
        ...prevState.preferences,
        ...patch,
      },
    }))
  }

  function patchHyperparam(key, value) {
    setAppState((prevState) => ({
      ...prevState,
      preferences: {
        ...prevState.preferences,
        hyperparams: {
          ...prevState.preferences.hyperparams,
          [key]: value,
        },
      },
    }))
  }

  function handleHelperModeChange(nextMode) {
    setHelperMode(nextMode)
    if (nextMode !== 'hidden') {
      setLastVisibleHelperMode(nextMode)
    }
  }

  function queueAdvance(callback, delay = 220) {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
    }
    pendingAdvanceRef.current = setTimeout(() => {
      pendingAdvanceRef.current = null
      callback()
    }, delay)
  }

  function revealNextCard(nextId, nextSession) {
    const now = Date.now()
    startTransition(() => {
      const nextRound = createNextRoundState(now)
      roundRef.current = nextRound
      setCurrentCardId(nextId)
      setInputValue('')
      setRound(nextRound)
      setFeedback({ type: 'idle', text: '' })
      setSession(nextSession)
      setAppState((prevState) => ({
        ...prevState,
        stats: {
          ...prevState.stats,
          [nextId]: updateCardStats(prevState.stats[nextId], 'seen', { now }, prevState.preferences.hyperparams),
        },
      }))
    })
  }

  function advanceToNextCard(nextSessionOverride) {
    const pool = buildPool(preferences.scriptMode, preferences.selectedGroups)
    if (!pool.length) {
      setPracticeState('setup')
      setCurrentCardId(null)
      return
    }

    const nextSession = nextSessionOverride ?? session
    const nextId = pickNextCardId(pool, stats, nextSession, preferences.mode, preferences.hyperparams)
    if (!nextId) {
      setPracticeState('setup')
      setCurrentCardId(null)
      return
    }

    revealNextCard(nextId, nextSession)
  }

  function startPractice() {
    if (!activePool.length) {
      setFeedback({ type: 'error', text: 'Нужно выбрать хотя бы один столбец.' })
      return
    }

    const nextSession = createInitialSession({
      poolIds: activePool.map((card) => card.id),
      mode: preferences.mode,
    })

    setCurrentTab('trainer')
    setPracticeState('practice')
    advanceToNextCard(nextSession)
  }

  function stopPractice() {
    if (pendingAdvanceRef.current) {
      clearTimeout(pendingAdvanceRef.current)
      pendingAdvanceRef.current = null
    }
    setPracticeState('setup')
    setCurrentCardId(null)
    setInputValue('')
    const nextRound = createNextRoundState()
    roundRef.current = nextRound
    setRound(nextRound)
    setFeedback({ type: 'idle', text: '' })
  }

  function finalizeOutcome(kind) {
    if (!activeCard) {
      return
    }

    const now = Date.now()
    const activeRound = roundRef.current
    const nextSession = {
      ...session,
      recentHistory: [...session.recentHistory, activeCard.id].slice(-3),
      lastCardId: activeCard.id,
      mistakeQueue: session.mistakeQueue.filter((id) => id !== activeCard.id),
    }

    if (kind === 'hint' && preferences.retryQueueEnabled) {
      nextSession.mistakeQueue = [activeCard.id, ...nextSession.mistakeQueue].slice(
        0,
        preferences.hyperparams.queueSize,
      )
    }

    setSession(nextSession)
    setAppState((prevState) => ({
      ...prevState,
      stats: {
        ...prevState.stats,
        [activeCard.id]: updateCardStats(
          prevState.stats[activeCard.id],
          kind,
          {
            now,
            latencyMs: now - activeRound.shownAt,
            mistakesOnCard: activeRound.mistakes,
            hintUsed: activeRound.hintUsed,
          },
          prevState.preferences.hyperparams,
        ),
      },
    }))

    setFeedback({
      type: 'success',
      text: '',
    })

    queueAdvance(() => {
      advanceToNextCard(nextSession)
    }, kind === 'correct' ? 220 : 280)
  }

  function handleInputChange(event) {
    if (!activeCard || practiceState !== 'practice') {
      return
    }

    const value = event.target.value.toLowerCase().replace(/\s+/g, '')
    const previousResult = evaluateInput(activeCard.answers, inputValue)
    setInputValue(value)

    const result = evaluateInput(activeCard.answers, value)
    if (result === 'wrong' && previousResult !== 'wrong') {
      registerWrongAttempt()
      return
    }

    if (result !== 'wrong' && feedback.type === 'wrong') {
      setFeedback(
        round.hintUsed
          ? {
              type: 'hint',
              text: `Подсказка: ${activeCard.answers.join(' / ')}`,
            }
          : { type: 'idle', text: '' },
      )
    }

    if (result === 'correct') {
      finalizeOutcome(round.hintUsed ? 'hint' : 'correct')
    }
  }

  function registerWrongAttempt() {
    if (!activeCard) {
      return
    }

    const now = Date.now()
    setRound((prevRound) => ({
      ...prevRound,
      mistakes: prevRound.mistakes + 1,
    }))
    roundRef.current = {
      ...roundRef.current,
      mistakes: roundRef.current.mistakes + 1,
    }
    setFeedback({ type: 'wrong', text: '' })
    setSession((prevSession) => {
      if (!preferences.retryQueueEnabled) {
        return prevSession
      }

      return {
        ...prevSession,
        mistakeQueue: [activeCard.id, ...prevSession.mistakeQueue.filter((id) => id !== activeCard.id)].slice(
          0,
          preferences.hyperparams.queueSize,
        ),
      }
    })
    setAppState((prevState) => ({
      ...prevState,
      stats: {
        ...prevState.stats,
        [activeCard.id]: updateCardStats(
          prevState.stats[activeCard.id],
          'wrong',
          { now },
          prevState.preferences.hyperparams,
        ),
      },
    }))
  }

  function handleInputKeyDown(event) {
    if (event.code === 'Space') {
      event.preventDefault()
      revealHint()
    }
  }

  function revealHint() {
    const currentPracticeState = practiceStateRef.current
    const currentCard = activeCardRef.current
    if (currentPracticeState !== 'practice' || !currentCard) {
      return
    }

    roundRef.current = {
      ...roundRef.current,
      hintUsed: true,
    }
    setRound((prevRound) => ({
      ...prevRound,
      hintUsed: true,
    }))
    setFeedback({
      type: 'hint',
      text: `Подсказка: ${currentCard.answers.join(' / ')}`,
    })
  }

  function toggleGroup(groupId) {
    const selected = new Set(preferences.selectedGroups)
    if (selected.has(groupId)) {
      selected.delete(groupId)
    } else {
      selected.add(groupId)
    }
    patchPreferences({ selectedGroups: [...selected] })
  }

  function setAllGroups(nextValue) {
    patchPreferences({ selectedGroups: nextValue ? [...GROUP_IDS] : [] })
  }

  function resetStats() {
    resetStoredState()
    const freshState = createDefaultAppState()
    setAppState(freshState)
    setSession(createInitialSession())
    setPracticeState('setup')
    setCurrentCardId(null)
    setInputValue('')
    setFeedback({ type: 'idle', text: '' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Хирагана и катакана</h1>
          <p className="subtitle">Автозачет без Enter. Пробел показывает ответ, но карточка меняется только после правильного ввода.</p>
        </div>

        <nav className="tabs" aria-label="Навигация">
          <button
            type="button"
            data-testid="tab-trainer"
            className={currentTab === 'trainer' ? 'tab is-active' : 'tab'}
            onClick={() => setCurrentTab('trainer')}
          >
            Тренажер
          </button>
          <button
            type="button"
            data-testid="tab-stats"
            className={currentTab === 'stats' ? 'tab is-active' : 'tab'}
            onClick={() => setCurrentTab('stats')}
          >
            Статистика
          </button>
        </nav>
      </header>

      {currentTab === 'trainer' ? (
        <main className="trainer-layout">
          {practiceState === 'setup' ? (
            <section className="panel controls-panel">
              <div className="section-heading">
                <h2>Набор</h2>
              </div>

              <div className="control-group">
                <span className="group-label">Азбука</span>
                <div className="segmented">
                  {scriptOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={`script-${option.id}`}
                      className={preferences.scriptMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
                      onClick={() => patchPreferences({ scriptMode: option.id })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <div className="row-heading">
                  <span className="group-label">Столбцы</span>
                  <div className="inline-actions">
                    <button type="button" className="text-button" data-testid="select-all" onClick={() => setAllGroups(true)}>
                      Все
                    </button>
                    <button type="button" className="text-button" data-testid="clear-selection" onClick={() => setAllGroups(false)}>
                      Ничего
                    </button>
                  </div>
                </div>

                <div className="selection-board-wrap">
                  <div className="selection-board" role="grid" aria-label="Выбор слогов">
                    <div className="row-label placeholder-cell"></div>
                    {KANA_GROUPS.map((group) => {
                      const selected = preferences.selectedGroups.includes(group.id)
                      return (
                        <button
                          key={group.id}
                          type="button"
                          data-testid={`group-toggle-${group.id}`}
                          className={selected ? 'column-toggle is-active' : 'column-toggle'}
                          onClick={() => toggleGroup(group.id)}
                        >
                          {group.shortLabel}
                        </button>
                      )
                    })}

                    {['a', 'i', 'u', 'e', 'o', 'n'].map((slot) => (
                      <SelectionRow
                        key={slot}
                        slot={slot}
                        scriptMode={preferences.scriptMode}
                        selectedGroups={preferences.selectedGroups}
                        onToggle={toggleGroup}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="control-group">
                <span className="group-label">Режим</span>
                <div className="mode-list">
                  {modeOptions.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={preferences.mode === mode.id ? 'mode-card is-active' : 'mode-card'}
                      onClick={() => patchPreferences({ mode: mode.id })}
                    >
                      <strong>{mode.label}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-row control-row-compact">
                <button
                  type="button"
                  className="text-button settings-toggle"
                  onClick={() => setShowFineTuning((value) => !value)}
                >
                  {showFineTuning ? 'Скрыть настройку' : 'Показать настройку'}
                </button>

                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={preferences.retryQueueEnabled}
                    onChange={(event) => patchPreferences({ retryQueueEnabled: event.target.checked })}
                  />
                  <span>Повторять подсказанные</span>
                </label>
              </div>

              {showFineTuning ? (
                <div className="settings-grid">
                  {settingsFields.map((field) => (
                    <label key={field.id} className="setting-card">
                      <span>{field.label}</span>
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={preferences.hyperparams[field.id]}
                        onChange={(event) => patchHyperparam(field.id, Number(event.target.value))}
                      />
                      <small>{field.hint}</small>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => patchPreferences({ hyperparams: { ...DEFAULT_HYPERPARAMS } })}
                  >
                    Сбросить настройки
                  </button>
                </div>
              ) : null}

              <div className="primary-actions">
                <button type="button" className="primary-button" onClick={startPractice}>
                  <span data-testid="start-practice">Практиковаться</span>
                </button>
              </div>

              {feedback.type === 'error' ? <p className="feedback is-error">{feedback.text}</p> : null}
            </section>
          ) : (
            <section className="panel practice-panel">
              <div className="practice-topline">
                <button type="button" className="text-button" onClick={stopPractice}>
                  Назад
                </button>
              </div>

              {activeCard ? (
                <div className={helperVisible ? 'practice-layout has-helper' : 'practice-layout is-single'}>
                  <div className={`practice-stage ${feedback.type ? `is-${feedback.type}` : ''}`}>
                    {!helperVisible ? (
                      <button
                        type="button"
                        className="helper-restore-button"
                        onClick={() => handleHelperModeChange(lastVisibleHelperMode)}
                      >
                        Справа
                      </button>
                    ) : null}

                    <div className="question-block">
                      <p className="question-script">{activeCard.scriptLabel}</p>
                      <div className="question-symbol" aria-live="polite">
                        <span data-testid="current-symbol">{activeCard.symbol}</span>
                      </div>
                      <p className="question-note">
                        <kbd>Space</kbd> показывает ответ.
                      </p>
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
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        placeholder={round.hintUsed ? activeCard.answers[0] : 'romaji'}
                      />

                      <div className="feedback-row">
                        <p className={`feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>{feedback.text || ' '}</p>
                      </div>
                    </div>
                  </div>

                  {helperVisible ? (
                    <aside className="helper-panel">
                      <div className="helper-topline">
                        <button
                          type="button"
                          className="text-button helper-hide-button"
                          onClick={() => handleHelperModeChange('hidden')}
                        >
                          Скрыть
                        </button>
                      </div>

                      <div className="helper-head">
                        <div className="segmented helper-tabs">
                          {helperOptions.filter((option) => option.id !== 'hidden').map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={helperMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
                              onClick={() => handleHelperModeChange(option.id)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {helperMode === 'stroke' ? (
                        <div className="helper-section helper-card">
                          <div className="helper-card-title">
                            <h3>Порядок штрихов</h3>
                          </div>
                          <div className="helper-card-body helper-card-body-stroke">
                            <div className="stroke-card">
                              <img
                                className="stroke-image"
                                src={getStrokeOrderUrl(activeCard)}
                                alt={`Порядок штрихов для ${activeCard.symbol}`}
                                loading="eager"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                          <p className="helper-note">{activeCard.symbol} · {activeCard.primaryAnswer}</p>
                        </div>
                      ) : null}

                      {helperMode === 'words' ? (
                        <div className="helper-section helper-card">
                          <div className="helper-card-title">
                            <h3>Слова</h3>
                          </div>
                          <div className="helper-card-body helper-card-body-words">
                            {helperWords.length ? (
                              <div className="word-list">
                                {helperWords.map((word) => (
                                  <article key={`${word.script}-${word.kana}`} className="word-card">
                                    <strong>{word.kana}</strong>
                                    <span>{word.romaji}</span>
                                    <small>{word.meaning}</small>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <div className="helper-empty">Для текущего набора слов пока нет.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </aside>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}
        </main>
      ) : (
        <main className="panel stats-panel">
          <div className="section-heading">
            <h2>Статистика</h2>
          </div>

          <div className="metric-grid">
            <MetricCard label="Событий" value={globalStats.totalEvents} />
            <MetricCard label="Завершено" value={globalStats.totalResolved} />
            <MetricCard label="Чистых" value={globalStats.cleanAnswers} />
            <MetricCard label="Подсказок" value={globalStats.totalHints} />
            <MetricCard label="Среднее время" value={globalStats.avgLatencyMs ? `${globalStats.avgLatencyMs} мс` : '—'} />
            <MetricCard label="Макс. серия" value={globalStats.bestStreak} />
          </div>

          <section className="stats-subsection infographic-panel">
            <div className="subsection-heading">
              <h3>Инфографика</h3>
            </div>

            <div className="infographic-grid">
              {infographicItems.map((item) => (
                <article key={item.label} className="infographic-card">
                  <div className="infographic-head">
                    <span>{item.label}</span>
                    <strong>
                      {item.value}
                      {item.suffix}
                    </strong>
                  </div>
                  <div className="infographic-track" aria-hidden="true">
                    <div className="infographic-fill" style={{ width: `${item.percent}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="stats-sections">
            <section className="stats-subsection">
              <div className="subsection-heading">
                <h3>Проблемные карточки</h3>
              </div>

              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Символ</th>
                      <th>Скрипт</th>
                      <th>Ответ</th>
                      <th>Точность</th>
                      <th>Мастерство</th>
                      <th>Серия</th>
                      <th>Вес</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHardCards.map((card) => {
                      const cardStats = stats[card.id]
                      return (
                        <tr key={card.id}>
                          <td className="kana-cell">{card.symbol}</td>
                          <td>{card.scriptLabel}</td>
                          <td>{card.primaryAnswer}</td>
                          <td>{cardStats.eventAccuracy}%</td>
                          <td>{Math.round(cardStats.mastery * 100)}%</td>
                          <td>{cardStats.streak}</td>
                          <td>{getAdaptiveWeight(cardStats, preferences.hyperparams, Date.now()).toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="footer-actions">
            <button type="button" className="ghost-button danger" onClick={resetStats}>
              Сбросить всю статистику
            </button>
          </div>
        </main>
      )}
    </div>
  )
}

function SelectionRow({ onToggle, scriptMode, selectedGroups, slot }) {
  return (
    <>
      <div className="row-label">{slot.toUpperCase()}</div>
      {KANA_GROUPS.map((group) => {
        const selected = selectedGroups.includes(group.id)
        const cell = group.entries.find((entry) => entry.slot === slot)
        const preview = cell ? getCellPreview(cell, scriptMode) : '—'
        return (
          <button
            key={`${group.id}-${slot}`}
            type="button"
            className={selected ? 'selection-cell is-active' : 'selection-cell'}
            onClick={() => onToggle(group.id)}
            disabled={!cell}
          >
            {cell ? (
              <>
                <span className="cell-kana">{preview}</span>
                <span className="cell-romaji">{cell.primaryAnswer}</span>
              </>
            ) : (
              <span className="cell-empty">—</span>
            )}
          </button>
        )
      })}
    </>
  )
}

function getCellPreview(entry, scriptMode) {
  if (scriptMode === 'hiragana') {
    return entry.hiragana
  }

  if (scriptMode === 'katakana') {
    return entry.katakana
  }

  return `${entry.hiragana} / ${entry.katakana}`
}

function MetricCard({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function getStrokeOrderUrl(card) {
  const prefix = card.script === 'hiragana' ? 'Hiragana' : 'Katakana'
  const fileName = `${prefix}_${card.symbol}_stroke_order_animation.gif`
  const hash = md5(fileName)
  return `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(fileName)}`
}

export default App
