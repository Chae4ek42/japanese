import type {
  CardTrainerLiveSession,
  ParticlesPickMode,
  ParticlesPreferences,
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
  type CoreParticle,
  type ParticleClozeCard,
} from '../../data/particles'
import { choiceItemClass } from '../../shared/lib/choiceDrill'
import {
  contentTokens,
  isTokenInMyWords,
  sentenceKnownByMine,
  tokenizeJapanese,
  tokenWordIds,
} from '../../shared/lib/jp-tokenize'
import { useIsMobileTouch } from '../../shared/lib/media'
import { useChoiceDrill } from '../../shared/lib/useChoiceDrill'
import {
  useAnalyticsState,
  useParticlesState,
  useVocabState,
} from '../../shared/state/AppStateContext'
import { CheatSheetTriggers, CheatSheetPopups, useCheatSheets } from '../../shared/ui/CheatSheetsBar'
import { ClozeLine } from '../../shared/ui/ClozeLine'
import { ChoicePad } from '../../shared/ui/ChoicePad'
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
      liveSession={particles.liveSession}
      onSaveLiveSession={particles.saveLiveSession}
      onClearLiveSession={particles.clearLiveSession}
      onPatchPreferences={particles.patchPreferences}
      onUpdateStats={particles.updateStats}
      myWords={vocab?.myWords ?? []}
      trainingWordIds={vocab?.trainingWordIds ?? []}
      onToggleMyWord={vocab?.toggleMyWord}
      onAddMyWords={vocab?.addMyWords}
      onAddTrainingWords={vocab?.addTrainingWords}
      onRemoveTrainingWords={vocab?.removeTrainingWords}
      onToggleTrainingWord={vocab?.toggleTrainingWord}
    />
  )
}

interface ParticlesTrainerViewProps {
  particlesState: { preferences: ParticlesPreferences; stats: Record<string, StatsRecord> }
  liveSession?: CardTrainerLiveSession | null
  onSaveLiveSession?: (session: CardTrainerLiveSession | null) => void
  onClearLiveSession?: () => void
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
  onAddTrainingWords?: (wordIds: string[]) => void
  onRemoveTrainingWords?: (wordIds: string[]) => void
  onToggleTrainingWord?: (wordId: string) => void
}

function ParticleSentenceWords({
  surface,
  myWordIds,
  trainingWordIds,
  onToggleMyWord,
  onAddMyWords,
  onAddTrainingWords,
  onRemoveTrainingWords,
}: {
  surface: string
  myWordIds: Set<string>
  trainingWordIds: Set<string>
  onToggleMyWord?: (wordId: string) => void
  onAddMyWords?: (wordIds: string[]) => void
  onAddTrainingWords?: (wordIds: string[]) => void
  onRemoveTrainingWords?: (wordIds: string[]) => void
}) {
  const words = useMemo(() => contentTokens(tokenizeJapanese(surface)), [surface])
  if (!words.length || (!onToggleMyWord && !onAddMyWords && !onAddTrainingWords)) return null

  const missingMineIds = words.flatMap((token) => {
    if (isTokenInMyWords(token, myWordIds)) return []
    return tokenWordIds(token)
  })
  const missingTrainingIds = words.flatMap((token) => {
    if (isTokenInMyWords(token, trainingWordIds)) return []
    return tokenWordIds(token)
  })

  function toggleMine(token: (typeof words)[number]) {
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

  function toggleTraining(token: (typeof words)[number]) {
    const ids = tokenWordIds(token)
    if (!ids.length) return
    if (isTokenInMyWords(token, trainingWordIds)) {
      onRemoveTrainingWords?.(ids)
      return
    }
    onAddTrainingWords?.(ids)
  }

  return (
    <div className="particles-words" data-testid="particles-sentence-words">
      <div className="particles-words-head">
        <span className="particles-words-label">Слова предложения</span>
        <span className="particles-words-head-actions">
          {missingMineIds.length && onAddMyWords ? (
            <button
              type="button"
              className="text-button particles-words-add-all"
              data-testid="particles-add-all-words"
              onClick={() => onAddMyWords(missingMineIds)}
            >
              + Все в мои
            </button>
          ) : null}
          {missingTrainingIds.length && onAddTrainingWords ? (
            <button
              type="button"
              className="text-button particles-words-add-all"
              data-testid="particles-add-all-training"
              onClick={() => onAddTrainingWords(missingTrainingIds)}
            >
              + Все в набор
            </button>
          ) : null}
        </span>
      </div>
      <div className="particles-words-chips" role="list">
        {words.map((token, index) => {
          const ids = tokenWordIds(token)
          const primary = ids[0] ?? `${token.surface}-${index}`
          const inMine = isTokenInMyWords(token, myWordIds)
          const inTraining = isTokenInMyWords(token, trainingWordIds)
          const writing = token.word?.writing ?? token.surface
          const meaning = token.word?.meanings?.[0]
          const chipClass = [
            'particles-word-chip',
            inMine ? 'is-mine' : '',
            inTraining ? 'is-training' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div
              key={`${primary}-${index}`}
              role="listitem"
              className={chipClass}
              data-testid={`particles-word-chip-${writing}`}
              title={meaning ? `${writing} — ${meaning}` : writing}
            >
              <span className="particles-word-chip-writing">{writing}</span>
              <span className="particles-word-chip-actions">
                <button type="button" className="text-button" onClick={() => toggleMine(token)}>
                  {inMine ? 'В моих' : '+ В мои'}
                </button>
                {onAddTrainingWords ? (
                  <button
                    type="button"
                    className="text-button"
                    data-testid={`particles-word-train-${writing}`}
                    onClick={() => toggleTraining(token)}
                  >
                    {inTraining ? 'В наборе' : '+ В набор'}
                  </button>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ParticlesTrainerView({
  particlesState,
  liveSession = null,
  onSaveLiveSession,
  onClearLiveSession,
  onPatchPreferences,
  onUpdateStats,
  myWords,
  trainingWordIds,
  onToggleMyWord,
  onAddMyWords,
  onAddTrainingWords,
  onRemoveTrainingWords,
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
  const trainingWordSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])
  const { recordAnswer } = useAnalyticsState()
  const isMobile = useIsMobileTouch()

  const [choices, setChoices] = useState<CoreParticle[]>(() => particleChoiceOptions(focus))
  const [filledParticle, setFilledParticle] = useState<CoreParticle | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const cheats = useCheatSheets()
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const toggleTranscriptRef = useRef<() => void>(() => {})
  const cheatOpenRef = useRef(false)
  const infoKanjiRef = useRef<string | null>(null)
  cheatOpenRef.current = cheats.sheet !== null
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

  const drill = useChoiceDrill({
    pool,
    statsMap,
    pickMode: preferences.pickMode,
    hyperparams: PARTICLE_HYPERPARAMS,
    liveSession,
    onSaveLiveSession,
    onClearLiveSession,
    onUpdateStats,
    recordAnswer,
    emptyPoolMessage: mineOnly
      ? 'Нет карточек только из ваших слов. Добавьте слова в «Мои» или снимите фильтр.'
      : 'В этом наборе нет карточек.',
    onShowCard: () => {
      setChoices(particleChoiceOptions(focus))
      setFilledParticle(null)
      setShowTranscript(false)
    },
  })

  const {
    view,
    sessionStats,
    feedback,
    sessionAccuracy,
    currentCardId,
    locked,
    choiceFlash,
    canGoPrev,
    patchRound,
    startPractice,
    stopPractice,
    skipToAdjacent,
    handlePick,
    skipToAdjacentRef,
  } = drill

  const activeCard: ParticleClozeCard | null = currentCardId
    ? getParticleCard(currentCardId)
    : null

  const activeSurface = activeCard ? particleCardSurface(activeCard) : ''
  const revealedParticle =
    filledParticle ?? (showTranscript && activeCard ? activeCard.answer : null)

  const practiceRef = useRef<{ view: typeof view; activeCard: ParticleClozeCard | null }>({
    view: 'setup',
    activeCard: null,
  })
  practiceRef.current = { view, activeCard }

  function toggleTranscript() {
    if (!activeCard || view !== 'practice') return
    if (!showTranscript) patchRound({ hintUsed: true })
    setShowTranscript((prev) => !prev)
  }

  toggleTranscriptRef.current = toggleTranscript

  function handleChoice(particle: CoreParticle) {
    if (!activeCard) return
    handlePick({
      pick: particle,
      cardId: activeCard.id,
      correct: particle === activeCard.answer,
      successText: `${formatParticlePrompt(activeCard.prompt, activeCard.answer)} · ${activeCard.glossRu}`,
      errorText: `Нужно «${activeCard.answer}» · ${PARTICLE_LABELS[activeCard.answer]}`,
      onCorrect: () => setFilledParticle(particle),
      onWrong: () => setFilledParticle(activeCard.answer),
      onWrongUnlock: () => setFilledParticle(null),
    })
  }

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
  }, [skipToAdjacentRef])

  function choiceClass(particle: CoreParticle): string {
    return choiceItemClass('particles-choice', particle, choiceFlash, activeCard?.answer)
  }

  const cheatTriggers = (
    <CheatSheetTriggers state={cheats} testIdPrefix="" sheets={['particles']} wrap={false} />
  )
  const cheatSheetPopup = <CheatSheetPopups state={cheats} />

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
          {cheatTriggers}
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
                <ClozeLine
                  text={activeCard.prompt}
                  fill={revealedParticle}
                  emptyLabel="＿"
                  className="particles-sentence"
                  blankClassName="particles-blank"
                  testId="particle-prompt"
                  segmentClassName="particles-sentence-text"
                  renderSegment={(segment, key) => (
                    <KanjiWritingHotspots
                      key={key}
                      writing={segment}
                      className="particles-sentence-text"
                      onOpenInfo={setInfoKanji}
                    />
                  )}
                />
                {showTranscript ? (
                  <>
                    <ClozeLine
                      text={activeCard.kana}
                      fill={revealedParticle ? particleBlankFill(revealedParticle, 'kana') : null}
                      emptyLabel="＿"
                      className="particles-kana"
                      blankClassName="particles-blank"
                      testId="particle-kana"
                      segmentClassName="particles-sentence-text"
                    />
                    <ClozeLine
                      text={activeCard.romaji}
                      fill={revealedParticle ? particleBlankFill(revealedParticle, 'romaji') : null}
                      emptyLabel="···"
                      className="particles-romaji"
                      blankClassName="particles-blank is-romaji"
                      testId="particle-romaji"
                      segmentClassName="particles-sentence-text"
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
                    {showTranscript ? 'Скрыть подсказку' : 'Подсказка'}
                  </button>
                </div>
              ) : null}
              <p className="particles-gloss" data-testid="particles-gloss">
                {activeCard.glossRu}
              </p>
              <ParticleSentenceWords
                surface={activeSurface}
                myWordIds={myWordSet}
                trainingWordIds={trainingWordSet}
                onToggleMyWord={onToggleMyWord}
                onAddMyWords={onAddMyWords}
                onAddTrainingWords={onAddTrainingWords}
                onRemoveTrainingWords={onRemoveTrainingWords}
              />
            </div>

            <ChoicePad
              className="particles-pad"
              ariaLabel="Выбор частицы"
              options={choices}
              onPick={handleChoice}
              disabled={locked}
              itemClassName={choiceClass}
              testIdFor={(particle) => `particle-choice-${particle}`}
              render={(particle) => (
                <>
                  <span className="particles-choice-glyph">{particle}</span>
                  <span className="particles-choice-romaji">{PARTICLE_ROMAJI[particle]}</span>
                </>
              )}
            />

            <div className="particles-footer">
              <p className={`particles-feedback ${feedback.type ? `is-${feedback.type}` : ''}`}>
                {feedback.text ||
                  (isMobile
                    ? 'Выберите частицу · кнопка «Подсказка» — чтение и ответ'
                    : 'Выберите частицу · Space — чтение и ответ · колёсико — карточка знака')}
              </p>
              <div className="particles-footer-actions">
                {cheatTriggers}
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
                    <kbd>Space</kbd> — чтение и ответ · <kbd>←</kbd>/<kbd>→</kbd> — назад/дальше
                  </>
                }
                swipe={<>Свайп ←/→ — назад/дальше · кнопка «Подсказка»</>}
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
