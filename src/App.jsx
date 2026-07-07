import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { KANA_STATS_CARDS, buildPool } from './data/kana'
import {
  createInitialSession,
  createNextRoundState,
  evaluateInput,
  evaluateSubmission,
  getGlobalStats,
  pickNextCardId,
  recordConfusion,
  recordHistoryEvent,
  updateCardStats,
} from './lib/trainer'
import {
  bootstrapAppState,
  createDefaultAppState,
  createCustomWordFromInput,
  ensureWordStats,
  isRemoteStorageEnabled,
  resetStoredState,
  saveAppState,
} from './lib/storage'
import { isCustomWordId } from './data/custom-words'
import { WORD_GROUPS } from './data/words'
import { SetupPanel } from './components/SetupPanel'
import { PracticePanel } from './components/PracticePanel'
import { StatsPanel } from './components/StatsPanel'
import { WordsTrainer } from './components/WordsTrainer'
import { WORD_HYPERPARAMS } from './data/words'

const emptySessionStats = { answered: 0, clean: 0, streak: 0 }

function App() {
  const [appState, setAppState] = useState(null)
  const [storageReady, setStorageReady] = useState(false)
  const [remoteStorage, setRemoteStorage] = useState(false)
  const [currentTab, setCurrentTab] = useState('trainer')
  const [practiceState, setPracticeState] = useState('setup')
  const [currentCardId, setCurrentCardId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [session, setSession] = useState(() => createInitialSession())
  const [round, setRound] = useState(() => createNextRoundState())
  const [feedback, setFeedback] = useState({ type: 'idle', text: '' })
  const [showFineTuning, setShowFineTuning] = useState(false)
  const [sessionStats, setSessionStats] = useState(emptySessionStats)
  const inputRef = useRef(null)
  const pendingAdvanceRef = useRef(null)
  const roundRef = useRef(createNextRoundState())
  const practiceStateRef = useRef(practiceState)
  const activeCardRef = useRef(null)

  const { preferences, stats, history } = appState ?? createDefaultAppState()

  useEffect(() => {
    let cancelled = false
    bootstrapAppState().then((state) => {
      if (cancelled) {
        return
      }
      setAppState(state)
      setRemoteStorage(isRemoteStorageEnabled())
      setStorageReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !appState) {
      return
    }
    saveAppState(appState)
  }, [appState, storageReady])

  const activePool = useMemo(
    () => buildPool(preferences.scriptMode, preferences.selectedGroups),
    [preferences.scriptMode, preferences.selectedGroups],
  )
  const activeCard = currentCardId
    ? activePool.find((card) => card.id === currentCardId) ??
      KANA_STATS_CARDS.find((card) => card.id === currentCardId) ??
      null
    : null
  const globalStats = useMemo(
    () => getGlobalStats(KANA_STATS_CARDS, stats, preferences.hyperparams),
    [preferences.hyperparams, stats],
  )

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

  function patchWordsPreferences(patch) {
    setAppState((prevState) => ({
      ...prevState,
      words: {
        ...prevState.words,
        preferences: {
          ...prevState.words.preferences,
          ...patch,
        },
      },
    }))
  }

  function toggleDictionaryWord(wordId) {
    setAppState((prevState) => {
      const inDictionary = prevState.words.dictionary.includes(wordId)
      const dictionary = inDictionary
        ? prevState.words.dictionary.filter((id) => id !== wordId)
        : [...prevState.words.dictionary, wordId]
      const customWords = inDictionary && isCustomWordId(wordId)
        ? prevState.words.customWords.filter((word) => word.id !== wordId)
        : prevState.words.customWords

      return {
        ...prevState,
        words: {
          ...prevState.words,
          dictionary,
          customWords,
          stats: inDictionary
            ? prevState.words.stats
            : {
                ...prevState.words.stats,
                [wordId]: ensureWordStats(prevState.words.stats, wordId),
              },
        },
      }
    })
  }

  function addGroupToDictionary(groupId) {
    const group = WORD_GROUPS.find((item) => item.id === groupId)
    if (!group) {
      return
    }

    setAppState((prevState) => {
      const nextDictionary = new Set(prevState.words.dictionary)
      const nextStats = { ...prevState.words.stats }
      for (const wordId of group.wordIds) {
        nextDictionary.add(wordId)
        nextStats[wordId] = ensureWordStats(nextStats, wordId)
      }
      return {
        ...prevState,
        words: {
          ...prevState.words,
          dictionary: [...nextDictionary],
          stats: nextStats,
        },
      }
    })
  }

  function addCustomWord(input) {
    const result = createCustomWordFromInput(input)
    if (result.error) {
      return result.error
    }

    setAppState((prevState) => {
      const word = result.word
      if (prevState.words.dictionary.includes(word.id)) {
        return prevState
      }
      return {
        ...prevState,
        words: {
          ...prevState.words,
          dictionary: [...prevState.words.dictionary, word.id],
          customWords: [
            ...prevState.words.customWords,
            {
              id: word.id,
              kanji: String(input.kanji ?? '').trim(),
              kana: String(input.kana ?? '').trim(),
              romaji: String(input.romaji ?? '').trim(),
              meanings: word.meanings,
              audio: String(input.audio ?? '').trim(),
              en: String(input.en ?? '').trim(),
              pos: word.pos,
            },
          ],
          stats: {
            ...prevState.words.stats,
            [word.id]: ensureWordStats(prevState.words.stats, word.id),
          },
        },
      }
    })
    return null
  }

  function removeCustomWord(wordId) {
    if (!isCustomWordId(wordId)) {
      return
    }
    toggleDictionaryWord(wordId)
  }

  function updateWordStats(wordId, outcome, context) {
    setAppState((prevState) => ({
      ...prevState,
      words: {
        ...prevState.words,
        stats: {
          ...prevState.words.stats,
          [wordId]: updateCardStats(
            ensureWordStats(prevState.words.stats, wordId),
            outcome,
            context,
            WORD_HYPERPARAMS,
          ),
        },
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

    const pickedFromQueue = nextSession.mistakeQueue.includes(nextId)
    revealNextCard(nextId, {
      ...nextSession,
      sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
    })
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
    setSessionStats(emptySessionStats)
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
    const latencyMs = now - activeRound.shownAt
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

    const clean = kind === 'correct' && activeRound.mistakes === 0
    setSessionStats((prevStats) => ({
      answered: prevStats.answered + 1,
      clean: prevStats.clean + (clean ? 1 : 0),
      streak: clean ? prevStats.streak + 1 : 0,
    }))

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
            latencyMs,
            mistakesOnCard: activeRound.mistakes,
            hintUsed: activeRound.hintUsed,
            inputMode: prevState.preferences.inputMode,
          },
          prevState.preferences.hyperparams,
        ),
      },
      history: recordHistoryEvent(prevState.history, kind, { now, latencyMs }),
    }))

    setFeedback({ type: 'success', text: '' })

    queueAdvance(() => {
      advanceToNextCard(nextSession)
    }, kind === 'correct' ? 220 : 280)
  }

  function detectConfusion(value) {
    if (!activeCard || !value || roundRef.current.confusionLogged) {
      return
    }

    const confusedWith = activePool.find(
      (card) => card.id !== activeCard.id && card.answers.includes(value),
    )
    if (!confusedWith) {
      return
    }

    roundRef.current = { ...roundRef.current, confusionLogged: true }
    setAppState((prevState) => ({
      ...prevState,
      history: recordConfusion(prevState.history, activeCard.id, confusedWith.id),
    }))
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
          { now, inputMode: prevState.preferences.inputMode },
          prevState.preferences.hyperparams,
        ),
      },
      history: recordHistoryEvent(prevState.history, 'wrong', { now }),
    }))
  }

  function handleInputChange(event) {
    if (!activeCard || practiceState !== 'practice') {
      return
    }

    const value = event.target.value.toLowerCase().replace(/\s+/g, '')

    if (preferences.inputMode === 'submit') {
      setInputValue(value)
      return
    }

    const previousResult = evaluateInput(activeCard.answers, inputValue)
    setInputValue(value)

    const result = evaluateInput(activeCard.answers, value)
    if (result === 'wrong') {
      if (previousResult !== 'wrong') {
        registerWrongAttempt()
        setFeedback({ type: 'wrong', text: '' })
      }
      detectConfusion(value)
      return
    }

    if (feedback.type === 'wrong') {
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

  function handleSubmitAnswer() {
    if (!activeCard || practiceState !== 'practice' || pendingAdvanceRef.current) {
      return
    }

    const result = evaluateSubmission(activeCard.answers, inputValue)
    if (result === 'empty') {
      return
    }

    if (result === 'correct') {
      finalizeOutcome(roundRef.current.hintUsed ? 'hint' : 'correct')
      return
    }

    registerWrongAttempt()
    detectConfusion(inputValue)
    // Раскрытый после ошибки ответ приравнивается к подсказке.
    roundRef.current = { ...roundRef.current, hintUsed: true }
    setRound((prevRound) => ({ ...prevRound, hintUsed: true }))
    setInputValue('')
    setFeedback({
      type: 'wrong',
      text: `Правильно: ${activeCard.answers.join(' / ')}. Введите верный ответ.`,
    })
  }

  function handleInputKeyDown(event) {
    if (event.code === 'Space') {
      event.preventDefault()
      revealHint()
      return
    }

    if (event.key === 'Enter' && preferences.inputMode === 'submit') {
      event.preventDefault()
      handleSubmitAnswer()
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
    inputRef.current?.focus()
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

  async function resetStats() {
    await resetStoredState()
    const freshState = createDefaultAppState()
    setAppState(freshState)
    setRemoteStorage(isRemoteStorageEnabled())
    setSession(createInitialSession())
    setSessionStats(emptySessionStats)
    setPracticeState('setup')
    setCurrentCardId(null)
    setInputValue('')
    setFeedback({ type: 'idle', text: '' })
  }

  const sessionAccuracy = sessionStats.answered
    ? Math.round((sessionStats.clean / sessionStats.answered) * 100)
    : 100

  if (!appState) {
    return (
      <div className="app-shell app-loading">
        <p>Загрузка прогресса…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Хирагана и катакана</h1>
          <p className="subtitle">
            {remoteStorage ? 'Прогресс сохраняется в PostgreSQL. ' : ''}
            {currentTab === 'words'
              ? 'Слова: тренируйте по темам или по своему словарю. Добавляйте пачки и свои записи без обязательных полей.'
              : preferences.inputMode === 'submit'
                ? 'Ответ отправляется по Enter. Пробел показывает подсказку — карточка сменится только после верного ввода.'
                : 'Автозачет без Enter. Пробел показывает подсказку — карточка сменится только после верного ввода.'}
          </p>
        </div>

        <nav className="tabs" aria-label="Навигация">
          <button
            type="button"
            data-testid="tab-trainer"
            className={currentTab === 'trainer' ? 'tab is-active' : 'tab'}
            onClick={() => setCurrentTab('trainer')}
          >
            Кана
          </button>
          <button
            type="button"
            data-testid="tab-words"
            className={currentTab === 'words' ? 'tab is-active' : 'tab'}
            onClick={() => setCurrentTab('words')}
          >
            Слова
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
            <SetupPanel
              errorText={feedback.type === 'error' ? feedback.text : ''}
              onApplyGroups={(groups) => patchPreferences({ selectedGroups: [...groups] })}
              onPatchHyperparam={patchHyperparam}
              onPatchPreferences={patchPreferences}
              onStart={startPractice}
              onToggleFineTuning={() => setShowFineTuning((value) => !value)}
              onToggleGroup={toggleGroup}
              preferences={preferences}
              showFineTuning={showFineTuning}
            />
          ) : (
            <PracticePanel
              activeCard={activeCard}
              feedback={feedback}
              inputMode={preferences.inputMode}
              inputRef={inputRef}
              inputValue={inputValue}
              onInputChange={handleInputChange}
              onInputKeyDown={handleInputKeyDown}
              onRevealHint={revealHint}
              onStop={stopPractice}
              round={round}
              sessionStats={{ ...sessionStats, accuracy: sessionAccuracy }}
              showScriptLabel={preferences.scriptMode === 'both'}
            />
          )}
        </main>
      ) : currentTab === 'words' ? (
        <main className="trainer-layout">
          <WordsTrainer
            onAddCustomWord={addCustomWord}
            onAddGroupToDictionary={addGroupToDictionary}
            onPatchPreferences={patchWordsPreferences}
            onRemoveCustomWord={removeCustomWord}
            onToggleDictionary={toggleDictionaryWord}
            onUpdateStats={updateWordStats}
            wordsState={appState.words}
          />
        </main>
      ) : (
        <StatsPanel
          globalStats={globalStats}
          history={history}
          hyperparams={preferences.hyperparams}
          onResetStats={resetStats}
          stats={stats}
        />
      )}
    </div>
  )
}

export default App
