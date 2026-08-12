import type {
  ParticlesPickMode,
  ParticlesPreferences,
  PracticeSession,
  PracticeView,
  StatsRecord,
} from '../../shared/lib/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import {
  PARTICLE_GROUPS,
  PARTICLE_HYPERPARAMS,
  PARTICLE_LABELS,
  PARTICLE_ROMAJI,
  buildParticlePool,
  ensureParticleStats,
  formatParticlePrompt,
  getParticleCard,
  particleBlankFill,
  particleCardSurface,
  particleChoiceOptions,
  splitParticlePrompt,
  type CoreParticle,
  type ParticleClozeCard,
} from '../../data/particles'
import { PARTICLES_CHEAT_SHEET } from '../../data/cheatSheets'
import {
  bumpSessionShow,
  pickNextCardId,
  pushRecentCard,
  setCardCooldown,
  successCooldownTurns,
} from '../../shared/lib/trainer'
import {
  contentTokens,
  isTokenInMyWords,
  sentenceKnownByMine,
  tokenizeJapanese,
  tokenWordIds,
} from '../../shared/lib/jp-tokenize'
import { useIsMobileTouch } from '../../shared/lib/media'
import { usePracticeSession } from '../../shared/lib/usePracticeSession'
import {
  useAnalyticsState,
  useParticlesState,
  useVocabState,
} from '../../shared/state/AppStateContext'
import { CheatSheetPopup, CheatSheetTrigger } from '../../shared/ui/CheatSheetPopup'
import { PracticeShell } from '../../shared/ui/PracticeShell'
import { ShortcutNote } from '../../shared/ui/ShortcutNote'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { KanjiWritingHotspots } from '../kanji/KanjiWritingHotspots'

export function ParticlesTrainer() {
  const particles = useParticlesState()
  const vocab = useVocabState()
  if (!particles) return null
  return (
    <ParticlesTrainerView
      particlesState={{ preferences: particles.preferences, stats: particles.stats }}
      onPatchPreferences={particles.patchPreferences}
      onUpdateStats={particles.updateStats}
      myWords={vocab?.myWords ?? []}
      trainingWordIds={vocab?.trainingWordIds ?? []}
      onToggleMyWord={vocab?.toggleMyWord}
      onAddMyWords={vocab?.addMyWords}
      onToggleTrainingWord={vocab?.toggleTrainingWord}
    />
  )
}

interface ParticlesTrainerViewProps {
  particlesState: { preferences: ParticlesPreferences; stats: Record<string, StatsRecord> }
  onPatchPreferences: (patch: Partial<ParticlesPreferences>) => void
  onUpdateStats: (
    cardId: string,
    outcome: 'correct' | 'wrong' | 'hint' | 'seen',
    context: {
      now: number
      latencyMs?: number
      mistakesOnCard?: number
      hintUsed?: boolean
      inputMode?: 'instant' | 'submit'
    },
  ) => void
  myWords: string[]
  trainingWordIds: string[]
  onToggleMyWord?: (wordId: string) => void
  onAddMyWords?: (wordIds: string[]) => void
  onToggleTrainingWord?: (wordId: string) => void
}

type ChoiceFlash = { pick: CoreParticle; correct: boolean } | null

function ParticleClozeLine({
  text,
  fill,
  emptyLabel,
  className,
  blankClassName,
  testId,
  kanjiInfo,
  onOpenKanjiInfo,
}: {
  text: string
  fill: string | null
  emptyLabel: string
  className: string
  blankClassName?: string
  testId?: string
  kanjiInfo?: boolean
  onOpenKanjiInfo?: (character: string) => void
}) {
  const parts = splitParticlePrompt(text)
  const renderText = (segment: string, key: string) => {
    if (kanjiInfo && onOpenKanjiInfo) {
      return (
        <KanjiWritingHotspots
          key={key}
          writing={segment}
          className="particles-sentence-text"
          onOpenInfo={onOpenKanjiInfo}
        />
      )
    }
    return (
      <span key={key} className="particles-sentence-text">
        {segment}
      </span>
    )
  }

  return (
    <div className={className} data-testid={testId}>
      {renderText(parts.before, 'before')}
      <span className={`particles-blank ${fill ? 'is-filled' : ''} ${blankClassName ?? ''}`.trim()}>
        {fill ?? emptyLabel}
      </span>
      {renderText(parts.after, 'after')}
    </div>
  )
}

function ParticleSentenceWords({
  surface,
  myWordIds,
  onToggleMyWord,
  onAddMyWords,
}: {
  surface: string
  myWordIds: Set<string>
  onToggleMyWord?: (wordId: string) => void
  onAddMyWords?: (wordIds: string[]) => void
}) {
  const words = useMemo(() => contentTokens(tokenizeJapanese(surface)), [surface])
  if (!words.length || (!onToggleMyWord && !onAddMyWords)) return null

  const missingIds = words.flatMap((token) => {
    if (isTokenInMyWords(token, myWordIds)) return []
    return tokenWordIds(token)
  })

  function toggleToken(token: (typeof words)[number]) {
    const ids = tokenWordIds(token)
    const primary = ids[0]
    if (!primary) return
    const inMine = isTokenInMyWords(token, myWordIds)
    if (inMine) {
      onToggleMyWord?.(primary)
      return
    }
    if (onAddMyWords) {
      onAddMyWords(ids)
      return
    }
    onToggleMyWord?.(primary)
  }

  return (
    <div className="particles-words" data-testid="particles-sentence-words">
      <div className="particles-words-head">
        <span className="particles-words-label">Слова предложения</span>
        {missingIds.length && onAddMyWords ? (
          <button
            type="button"
            className="text-button particles-words-add-all"
            data-testid="particles-add-all-words"
            onClick={() => onAddMyWords(missingIds)}
          >
            + Все в мои
          </button>
        ) : null}
      </div>
      <div className="particles-words-chips" role="list">
        {words.map((token, index) => {
          const ids = tokenWordIds(token)
          const primary = ids[0] ?? `${token.surface}-${index}`
          const inMine = isTokenInMyWords(token, myWordIds)
          const writing = token.word?.writing ?? token.surface
          const meaning = token.word?.meanings?.[0]
          return (
            <button
              key={`${primary}-${index}`}
              type="button"
              role="listitem"
              className={inMine ? 'particles-word-chip is-mine' : 'particles-word-chip'}
              data-testid={`particles-word-chip-${writing}`}
              title={meaning ? `${writing} — ${meaning}` : writing}
              onClick={() => toggleToken(token)}
            >
              <span className="particles-word-chip-writing">{writing}</span>
              <span className="particles-word-chip-action">{inMine ? 'В моих' : '+ В мои'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ParticlesTrainerView({
  particlesState,
  onPatchPreferences,
  onUpdateStats,
  myWords,
  trainingWordIds,
  onToggleMyWord,
  onAddMyWords,
  onToggleTrainingWord,
}: ParticlesTrainerViewProps) {
  const pickModeOptions = [
    { id: 'adaptive', label: 'Адаптивный' },
    { id: 'even', label: 'Равномерный' },
  ] as const

  const focusOptions = [
    { id: 'all' as const, label: 'Все 12' },
    { id: 'frame' as const, label: PARTICLE_GROUPS.frame.label },
    { id: 'connect' as const, label: PARTICLE_GROUPS.connect.label },
  ]

  const { preferences, stats } = particlesState
  const focus = preferences.focus ?? 'all'
  const mineOnly = preferences.mineOnly === true
  const myWordSet = useMemo(() => new Set(myWords), [myWords])
  const {
    view,
    setSession,
    sessionRef,
    roundRef,
    resetRound,
    sessionStats,
    feedback,
    setFeedback,
    pendingAdvanceRef,
    queueAdvance,
    clearPendingAdvance,
    beginPractice,
    endPractice,
    recordAnswered,
    sessionAccuracy,
  } = usePracticeSession()
  const { recordAnswer } = useAnalyticsState()
  const isMobile = useIsMobileTouch()

  const [currentCardId, setCurrentCardId] = useState<string | null>(null)
  const [choices, setChoices] = useState<CoreParticle[]>(() => particleChoiceOptions(focus))
  const [locked, setLocked] = useState(false)
  const [choiceFlash, setChoiceFlash] = useState<ChoiceFlash>(null)
  const [filledParticle, setFilledParticle] = useState<CoreParticle | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [canGoPrev, setCanGoPrev] = useState(false)
  const [cheatOpen, setCheatOpen] = useState(false)
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const navHistoryRef = useRef<string[]>([])
  const navIndexRef = useRef(-1)
  const skipToAdjacentRef = useRef<(direction: 'prev' | 'next') => void>(() => {})
  const toggleTranscriptRef = useRef<() => void>(() => {})
  const cheatOpenRef = useRef(false)
  const infoKanjiRef = useRef<string | null>(null)
  cheatOpenRef.current = cheatOpen
  infoKanjiRef.current = infoKanji

  const pool = useMemo(() => {
    let cards = buildParticlePool(focus)
    if (mineOnly) {
      cards = cards.filter((card) => sentenceKnownByMine(particleCardSurface(card), myWordSet))
    }
    return cards
  }, [focus, mineOnly, myWordSet])

  const statsMap = useMemo(() => {
    const map = { ...stats }
    for (const card of pool) {
      map[card.id] = ensureParticleStats(map, card.id)
    }
    return map
  }, [pool, stats])

  const activeCard: ParticleClozeCard | null = currentCardId
    ? getParticleCard(currentCardId)
    : null

  const activeSurface = activeCard ? particleCardSurface(activeCard) : ''

  const practiceRef = useRef<{ view: PracticeView; activeCard: ParticleClozeCard | null }>({
    view: 'setup',
    activeCard: null,
  })
  practiceRef.current = { view, activeCard }

  function showCard(
    cardId: string,
    baseSession?: PracticeSession,
    { countPresentation = true }: { countPresentation?: boolean } = {},
  ) {
    const card = getParticleCard(cardId)
    if (!card) return
    const now = Date.now()
    const base = baseSession ?? sessionRef.current
    const shownSession = countPresentation ? bumpSessionShow(base, cardId) : base
    sessionRef.current = shownSession
    setSession(shownSession)
    resetRound(now)
    setCurrentCardId(cardId)
    setChoices(particleChoiceOptions(focus))
    setLocked(false)
    setChoiceFlash(null)
    setFilledParticle(null)
    setShowTranscript(false)
    setFeedback({ type: 'idle', text: '' })
    if (countPresentation) {
      onUpdateStats(cardId, 'seen', { now })
    }
  }

  function rememberNavCard(cardId: string) {
    const trimmed = navHistoryRef.current.slice(0, navIndexRef.current + 1)
    trimmed.push(cardId)
    navHistoryRef.current = trimmed
    navIndexRef.current = trimmed.length - 1
    setCanGoPrev(navIndexRef.current > 0)
  }

  function advanceToNextCard(nextSessionOverride?: PracticeSession) {
    const nextSession = nextSessionOverride ?? sessionRef.current
    if (!pool.length) {
      stopPractice()
      return
    }

    const nextId = pickNextCardId(
      pool,
      statsMap,
      nextSession,
      preferences.pickMode,
      PARTICLE_HYPERPARAMS,
    )
    if (!nextId) {
      setFeedback({ type: 'error', text: 'Нет карточек для тренировки.' })
      return
    }

    const pickedFromQueue = nextSession.mistakeQueue.includes(nextId)
    rememberNavCard(nextId)
    showCard(nextId, {
      ...nextSession,
      sinceQueuePick: pickedFromQueue ? 0 : (nextSession.sinceQueuePick ?? 0) + 1,
    })
  }

  function startPractice() {
    if (!pool.length) {
      setFeedback({
        type: 'error',
        text: mineOnly
          ? 'Нет карточек только из ваших слов. Добавьте слова в «Мои» или снимите фильтр.'
          : 'В этом наборе нет карточек.',
      })
      return
    }
    clearPendingAdvance()
    navHistoryRef.current = []
    navIndexRef.current = -1
    setCanGoPrev(false)
    const nextSession = beginPractice({
      poolIds: pool.map((card) => card.id),
      mode: preferences.pickMode,
    })
    advanceToNextCard(nextSession)
  }

  function stopPractice() {
    clearPendingAdvance()
    endPractice()
    setCurrentCardId(null)
    setLocked(false)
    setChoiceFlash(null)
    setFilledParticle(null)
    setShowTranscript(false)
  }

  function toggleTranscript() {
    setShowTranscript((prev) => !prev)
  }

  toggleTranscriptRef.current = toggleTranscript

  function handleChoice(particle: CoreParticle) {
    if (!activeCard || view !== 'practice' || locked || pendingAdvanceRef.current) return
    const now = Date.now()
    const activeRound = roundRef.current
    const correct = particle === activeCard.answer
    setLocked(true)
    setChoiceFlash({ pick: particle, correct })

    if (!correct) {
      const withMistake = {
        ...sessionRef.current,
        mistakeQueue: [activeCard.id, ...sessionRef.current.mistakeQueue].slice(
          0,
          PARTICLE_HYPERPARAMS.queueSize,
        ),
      }
      sessionRef.current = withMistake
      setSession(withMistake)
      roundRef.current = {
        ...activeRound,
        mistakes: activeRound.mistakes + 1,
      }
      setFilledParticle(activeCard.answer)
      setFeedback({
        type: 'error',
        text: `Нужно «${activeCard.answer}» · ${PARTICLE_LABELS[activeCard.answer]}`,
      })
      onUpdateStats(activeCard.id, 'wrong', {
        now,
        latencyMs: now - activeRound.shownAt,
        mistakesOnCard: activeRound.mistakes + 1,
        inputMode: 'instant',
      })
      recordAnswer(false)
      queueAdvance(() => {
        setLocked(false)
        setChoiceFlash(null)
        setFilledParticle(null)
        setFeedback({ type: 'idle', text: '' })
      }, 1100)
      return
    }

    const poolSize = pool.length || 1
    let nextSession = pushRecentCard(sessionRef.current, activeCard.id)
    nextSession = {
      ...nextSession,
      mistakeQueue: nextSession.mistakeQueue.filter((id) => id !== activeCard.id),
    }
    const clean = activeRound.mistakes === 0 && !activeRound.hintUsed
    if (clean) {
      nextSession = setCardCooldown(nextSession, activeCard.id, successCooldownTurns(poolSize, true))
    }
    sessionRef.current = nextSession
    setSession(nextSession)
    setFilledParticle(particle)
    recordAnswered(clean ? 1 : 0)
    recordAnswer(clean)
    onUpdateStats(activeCard.id, 'correct', {
      now,
      latencyMs: now - activeRound.shownAt,
      mistakesOnCard: activeRound.mistakes,
      hintUsed: activeRound.hintUsed,
      inputMode: 'instant',
    })
    setFeedback({
      type: 'success',
      text: `${formatParticlePrompt(activeCard.prompt, activeCard.answer)} · ${activeCard.glossRu}`,
    })
    queueAdvance(() => advanceToNextCard(nextSession), 850)
  }

  function skipToAdjacent(direction: 'prev' | 'next') {
    if (view !== 'practice') return
    clearPendingAdvance()
    setLocked(false)
    setChoiceFlash(null)
    setFilledParticle(null)

    if (direction === 'prev') {
      if (navIndexRef.current <= 0) return
      navIndexRef.current -= 1
      setCanGoPrev(navIndexRef.current > 0)
      const prevId = navHistoryRef.current[navIndexRef.current]
      if (!prevId) return
      showCard(prevId, sessionRef.current, { countPresentation: false })
      return
    }

    if (navIndexRef.current >= 0 && navIndexRef.current < navHistoryRef.current.length - 1) {
      navIndexRef.current += 1
      setCanGoPrev(navIndexRef.current > 0)
      const nextId = navHistoryRef.current[navIndexRef.current]
      if (!nextId) return
      showCard(nextId, sessionRef.current, { countPresentation: false })
      return
    }

    const currentId = currentCardId
    const baseSession = currentId
      ? pushRecentCard(sessionRef.current, currentId)
      : sessionRef.current
    sessionRef.current = baseSession
    setSession(baseSession)
    advanceToNextCard(baseSession)
  }

  skipToAdjacentRef.current = skipToAdjacent

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (cheatOpenRef.current || infoKanjiRef.current) return
      const ctx = practiceRef.current
      if (ctx.view !== 'practice' || !ctx.activeCard) return
      if (event.code === 'Space' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        toggleTranscriptRef.current()
        return
      }
      if (event.code === 'ArrowLeft' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        skipToAdjacentRef.current('prev')
        return
      }
      if (event.code === 'ArrowRight' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        skipToAdjacentRef.current('next')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function choiceClass(particle: CoreParticle): string {
    const classes = ['particles-choice']
    if (!choiceFlash) return classes.join(' ')
    if (particle === choiceFlash.pick) {
      classes.push(choiceFlash.correct ? 'is-correct' : 'is-wrong')
    } else if (!choiceFlash.correct && particle === activeCard?.answer) {
      classes.push('is-reveal')
    }
    return classes.join(' ')
  }

  const cheatSheetPopup = cheatOpen ? (
    <CheatSheetPopup doc={PARTICLES_CHEAT_SHEET} onClose={() => setCheatOpen(false)} />
  ) : null

  const kanjiInfoPopup = infoKanji ? (
    <KanjiInfoCard
      character={infoKanji}
      myWords={myWords}
      trainingWordIds={trainingWordIds}
      onClose={() => setInfoKanji(null)}
      onToggleMyWord={onToggleMyWord}
      onToggleTrainingWord={onToggleTrainingWord}
    />
  ) : null

  if (view === 'setup') {
    return (
      <main className="particles-page" data-testid="particles-page">
        <header className="particles-hero">
          <div className="particles-hero-copy">
            <p className="particles-kicker">Тренажёр</p>
            <h2 className="particles-title">Частицы</h2>
            <p className="particles-lead">
              Вставьте частицу в предложение. В паде — все 12 основных: каркас и связки. Колёсико по
              кандзи — карточка знака; слова предложения можно добавить в «Мои».
            </p>
          </div>
          <CheatSheetTrigger
            label="Шпаргалка"
            testId="open-particles-cheatsheet"
            onClick={() => setCheatOpen(true)}
          />
        </header>

        <section className="particles-setup-shell">
          <div className="setup-panel particles-controls">
            <div className="control-group">
              <span className="group-label">Набор</span>
              <div className="segmented-control">
                {focusOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={
                      focus === option.id ? 'segmented-button is-active' : 'segmented-button'
                    }
                    data-testid={`particles-focus-${option.id}`}
                    onClick={() => onPatchPreferences({ focus: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <span className="group-label">Слова</span>
              <div className="segmented-control" role="group" aria-label="Фильтр по моим словам">
                <button
                  type="button"
                  className={!mineOnly ? 'segmented-button is-active' : 'segmented-button'}
                  data-testid="particles-mine-only-off"
                  onClick={() => onPatchPreferences({ mineOnly: false })}
                >
                  Все предложения
                </button>
                <button
                  type="button"
                  className={mineOnly ? 'segmented-button is-active' : 'segmented-button'}
                  data-testid="particles-mine-only-on"
                  onClick={() => onPatchPreferences({ mineOnly: true })}
                >
                  Только по моим словам
                </button>
              </div>
              {mineOnly ? (
                <p className="control-hint">
                  В предложениях не будет незнакомых слов — только из «Моих» (частицы и служебные не
                  считаются).
                </p>
              ) : null}
            </div>

            <div className="control-group">
              <span className="group-label">Подбор</span>
              <div className="segmented-control">
                {pickModeOptions.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={
                      preferences.pickMode === mode.id
                        ? 'segmented-button is-active'
                        : 'segmented-button'
                    }
                    onClick={() => onPatchPreferences({ pickMode: mode.id as ParticlesPickMode })}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="control-hint" data-testid="particles-pool-count">
              {pool.length} карточек · {choices.length || particleChoiceOptions(focus).length} в
              паде
              {mineOnly ? ` · из ${myWords.length} моих слов` : ''}
            </p>

            <div className="primary-actions">
              <button
                type="button"
                className="primary-button"
                data-testid="start-particles"
                onClick={startPractice}
                disabled={!pool.length}
              >
                Начать
              </button>
            </div>

            {feedback.type === 'error' ? <p className="feedback is-error">{feedback.text}</p> : null}
            {!pool.length && mineOnly ? (
              <p className="feedback is-error" data-testid="particles-mine-empty">
                Нет подходящих карточек. Добавьте слова в «Мои» или выберите «Все предложения».
              </p>
            ) : null}
          </div>

          <aside className="particles-roster" aria-label="Двенадцать частиц">
            {(Object.keys(PARTICLE_GROUPS) as Array<keyof typeof PARTICLE_GROUPS>).map((groupId) => {
              const group = PARTICLE_GROUPS[groupId]
              return (
                <div key={groupId} className="particles-roster-group">
                  <h3 className="particles-roster-title">{group.label}</h3>
                  <div className="particles-roster-grid">
                    {group.particles.map((particle) => (
                      <div key={particle} className="particles-roster-item">
                        <span className="particles-roster-glyph">{particle}</span>
                        <span className="particles-roster-meta">
                          <strong>{PARTICLE_ROMAJI[particle]}</strong>
                          <span>{PARTICLE_LABELS[particle].split(' · ')[1]}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </aside>
        </section>
        {cheatSheetPopup}
        {kanjiInfoPopup}
      </main>
    )
  }

  return (
    <>
      <PracticeShell
        className="particles-practice-panel"
        stageClassName="particles-practice-layout"
        onStop={stopPractice}
        sessionStats={{ ...sessionStats, accuracy: sessionAccuracy }}
        feedbackType={feedback.type}
        swipes={{
          onSwipeLeft: () => skipToAdjacent('prev'),
          onSwipeRight: () => skipToAdjacent('next'),
        }}
      >
        {activeCard ? (
          <>
            <div className="particles-stage">
              <p className="particles-stage-label">Вставьте частицу</p>
              <div
                className={`particles-prompt-stack ${feedback.type === 'success' ? 'is-ok' : ''} ${feedback.type === 'error' ? 'is-bad' : ''}`.trim()}
                aria-live="polite"
              >
                <ParticleClozeLine
                  text={activeCard.prompt}
                  fill={filledParticle}
                  emptyLabel="＿"
                  className="particles-sentence"
                  testId="particle-prompt"
                  kanjiInfo
                  onOpenKanjiInfo={setInfoKanji}
                />
                {showTranscript ? (
                  <>
                    <ParticleClozeLine
                      text={activeCard.kana}
                      fill={filledParticle ? particleBlankFill(filledParticle, 'kana') : null}
                      emptyLabel="＿"
                      className="particles-kana"
                      testId="particle-kana"
                    />
                    <ParticleClozeLine
                      text={activeCard.romaji}
                      fill={filledParticle ? particleBlankFill(filledParticle, 'romaji') : null}
                      emptyLabel="···"
                      className="particles-romaji"
                      blankClassName="is-romaji"
                      testId="particle-romaji"
                    />
                  </>
                ) : null}
              </div>
              {isMobile ? (
                <div className="particles-transcript-actions">
                  <button
                    type="button"
                    className={
                      showTranscript
                        ? 'hint-button particles-transcript-button is-on'
                        : 'hint-button particles-transcript-button'
                    }
                    data-testid="particles-transcript-button"
                    aria-pressed={showTranscript}
                    onClick={toggleTranscript}
                  >
                    {showTranscript ? 'Скрыть транскрипцию' : 'Транскрипция'}
                  </button>
                </div>
              ) : null}
              <p className="particles-gloss">{activeCard.glossRu}</p>
              <ParticleSentenceWords
                surface={activeSurface}
                myWordIds={myWordSet}
                onToggleMyWord={onToggleMyWord}
                onAddMyWords={onAddMyWords}
              />
            </div>

            <div className="particles-pad" role="group" aria-label="Выбор частицы">
              {choices.map((particle) => (
                <button
                  key={particle}
                  type="button"
                  className={choiceClass(particle)}
                  data-testid={`particle-choice-${particle}`}
                  disabled={locked}
                  onClick={() => handleChoice(particle)}
                >
                  <span className="particles-choice-glyph">{particle}</span>
                  <span className="particles-choice-romaji">{PARTICLE_ROMAJI[particle]}</span>
                </button>
              ))}
            </div>

            <div className="particles-footer">
              <p className={`particles-feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>
                {feedback.text ||
                  (isMobile
                    ? 'Выберите частицу · кнопка «Транскрипция» — кана и ромадзи'
                    : 'Выберите частицу · Space — транскрипция · колёсико — карточка знака')}
              </p>
              <div className="particles-footer-actions">
                <CheatSheetTrigger
                  label="Шпаргалка"
                  testId="open-particles-cheatsheet"
                  onClick={() => setCheatOpen(true)}
                />
                {canGoPrev ? (
                  <button
                    type="button"
                    className="ghost-button"
                    data-testid="particles-skip-prev"
                    onClick={() => skipToAdjacent('prev')}
                  >
                    ← Назад
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="particles-skip-next"
                  onClick={() => skipToAdjacent('next')}
                >
                  Дальше →
                </button>
              </div>
              <ShortcutNote
                keyboard={
                  <>
                    <kbd>Space</kbd> — транскрипция · <kbd>←</kbd>/<kbd>→</kbd> — назад/дальше
                  </>
                }
                swipe={<>Свайп ←/→ — назад/дальше · кнопка «Транскрипция»</>}
              />
            </div>
          </>
        ) : null}
      </PracticeShell>
      {cheatSheetPopup}
      {kanjiInfoPopup}
    </>
  )
}
