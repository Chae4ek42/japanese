import { useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import {
  VERB_FORM_LABELS,
  VERB_FORMS,
  VERB_HYPERPARAMS,
  buildVerbPool,
  ensureVerbStats,
  getVerbCard,
  verbChoiceOptions,
  verbGroupLabel,
  type VerbCard,
  type VerbFormResult,
} from '../../data/verbs'
import { choiceItemClass } from '../../shared/lib/choiceDrill'
import { useChoiceDrill } from '../../shared/lib/useChoiceDrill'
import { useIsMobileTouch } from '../../shared/lib/media'
import type {
  CardTrainerLiveSession,
  StatsOutcome,
  StatsRecord,
  UpdateStatsContext,
  VerbsPreferences,
} from '../../shared/lib/types'
import { useAnalyticsState, useVerbsState } from '../../shared/state/AppStateContext'
import { CheatSheetPopups, CheatSheetTriggers, useCheatSheets } from '../../shared/ui/CheatSheetsBar'
import { ChoicePad } from '../../shared/ui/ChoicePad'
import { PracticeShell } from '../../shared/ui/PracticeShell'
import { ShortcutNote } from '../../shared/ui/ShortcutNote'

export function VerbsTrainer() {
  const verbs = useVerbsState()
  if (!verbs) return null
  return (
    <VerbsTrainerView
      preferences={verbs.preferences}
      stats={verbs.stats}
      liveSession={verbs.liveSession}
      onSaveLiveSession={verbs.saveLiveSession}
      onClearLiveSession={verbs.clearLiveSession}
      onPatchPreferences={verbs.patchPreferences}
      onUpdateStats={verbs.updateStats}
    />
  )
}

function VerbsTrainerView({
  preferences,
  stats,
  liveSession,
  onSaveLiveSession,
  onClearLiveSession,
  onPatchPreferences,
  onUpdateStats,
}: {
  preferences: VerbsPreferences
  stats: Record<string, StatsRecord>
  liveSession: CardTrainerLiveSession | null
  onSaveLiveSession: (session: CardTrainerLiveSession | null) => void
  onClearLiveSession: () => void
  onPatchPreferences: (patch: Partial<VerbsPreferences>) => void
  onUpdateStats: (cardId: string, outcome: StatsOutcome, context: UpdateStatsContext) => void
}) {
  const pickModeOptions = [
    { id: 'adaptive' as const, label: 'Адаптивный' },
    { id: 'even' as const, label: 'Равномерный' },
  ]
  const focusOptions = [
    { id: 'all' as const, label: 'Все формы' },
    ...VERB_FORMS.map((form) => ({ id: form.id, label: form.label })),
  ]

  const { recordAnswer } = useAnalyticsState()
  const isMobile = useIsMobileTouch()
  const cheats = useCheatSheets()
  const pool = useMemo(() => buildVerbPool(preferences.focus), [preferences.focus])
  const statsMap = useMemo(() => {
    const map = { ...stats }
    for (const card of pool) {
      map[card.id] = ensureVerbStats(map, card.id)
    }
    return map
  }, [pool, stats])

  const [choices, setChoices] = useState<VerbFormResult[]>([])
  const [showHint, setShowHint] = useState(false)
  const cheatOpenRef = useRef(false)
  cheatOpenRef.current = cheats.sheet !== null

  const drill = useChoiceDrill({
    pool,
    statsMap,
    pickMode: preferences.pickMode,
    hyperparams: VERB_HYPERPARAMS,
    liveSession,
    onSaveLiveSession,
    onClearLiveSession,
    onUpdateStats,
    recordAnswer,
    emptyPoolMessage: 'В этом наборе нет карточек.',
    onShowCard: (cardId) => {
      const card = getVerbCard(cardId)
      setChoices(card ? verbChoiceOptions(card) : [])
      setShowHint(false)
    },
  })

  const activeCard: VerbCard | null = drill.currentCardId ? getVerbCard(drill.currentCardId) : null
  const practiceRef = useRef({ view: drill.view, activeCard })
  practiceRef.current = { view: drill.view, activeCard }
  const toggleHintRef = useRef<() => void>(() => {})

  function toggleHint() {
    if (!activeCard || drill.view !== 'practice') return
    if (!showHint) drill.patchRound({ hintUsed: true })
    setShowHint((prev) => !prev)
  }
  toggleHintRef.current = toggleHint

  function handleChoice(writing: string) {
    if (!activeCard) return
    drill.handlePick({
      pick: writing,
      cardId: activeCard.id,
      correct: writing === activeCard.target.writing,
      successText: `${activeCard.dictionary.writing} → ${activeCard.target.writing} · ${activeCard.target.kana}`,
      errorText: `Нужно «${activeCard.target.writing}» · ${activeCard.target.kana}`,
    })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (cheatOpenRef.current) return
      const ctx = practiceRef.current
      if (ctx.view !== 'practice' || !ctx.activeCard) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code === 'Space') {
        event.preventDefault()
        toggleHintRef.current()
        return
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        drill.skipToAdjacentRef.current('prev')
        return
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault()
        drill.skipToAdjacentRef.current('next')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drill.skipToAdjacentRef])

  const cheatTriggers = (
    <CheatSheetTriggers state={cheats} testIdPrefix="verbs" sheets={['verbs']} wrap={false} />
  )
  const cheatSheetPopup = <CheatSheetPopups state={cheats} />

  if (drill.view === 'setup') {
    return (
      <main className="particles-page verbs-page" data-testid="verbs-page">
        <header className="particles-hero">
          <div className="particles-hero-copy">
            <p className="particles-kicker">Тренажёр</p>
            <h2 className="particles-title">Спряжение глаголов</h2>
            <p className="particles-lead">
              Словарная форма на экране — выберите て, た, ない, ます или возможную. Группы I / II /
              する・来る.
            </p>
          </div>
          {cheatTriggers}
        </header>

        <section className="particles-setup-shell">
          <div className="setup-panel particles-controls">
            <div className="control-group">
              <span className="group-label">Форма</span>
              <div className="segmented-control">
                {focusOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={
                      preferences.focus === option.id
                        ? 'segmented-button is-active'
                        : 'segmented-button'
                    }
                    data-testid={`verbs-focus-${option.id}`}
                    onClick={() => onPatchPreferences({ focus: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
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
                    data-testid={`verbs-pick-${mode.id}`}
                    onClick={() => onPatchPreferences({ pickMode: mode.id })}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="control-hint" data-testid="verbs-pool-count">
              {pool.length} карточек
            </p>

            <div className="primary-actions">
              <button
                type="button"
                className="primary-button"
                data-testid="start-verbs"
                onClick={drill.startPractice}
                disabled={!pool.length}
              >
                Начать
              </button>
            </div>

            {drill.feedback.type === 'error' ? (
              <p className="feedback is-error">{drill.feedback.text}</p>
            ) : null}
          </div>

          <aside className="particles-roster" aria-label="Формы">
            <div className="particles-roster-group">
              <h3 className="particles-roster-title">Что спрашиваем</h3>
              <div className="particles-roster-grid">
                {VERB_FORMS.map((form) => (
                  <div key={form.id} className="particles-roster-item">
                    <span className="particles-roster-glyph">{form.label}</span>
                    <span className="particles-roster-meta">
                      <strong>{VERB_FORM_LABELS[form.id]}</strong>
                      <span>{form.hint}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
        {cheatSheetPopup}
      </main>
    )
  }

  return (
    <>
      <PracticeShell
        className="particles-practice-panel"
        stageClassName="particles-practice-layout"
        onStop={drill.stopPractice}
        sessionStats={{ ...drill.sessionStats, accuracy: drill.sessionAccuracy }}
        feedbackType={drill.feedback.type}
        swipes={{
          onSwipeLeft: () => drill.skipToAdjacent('prev'),
          onSwipeRight: () => drill.skipToAdjacent('next'),
        }}
      >
        {activeCard ? (
          <>
            <div className="particles-stage">
              <p className="particles-stage-label">Выберите форму</p>
              <div
                className={`particles-prompt-stack verbs-prompt ${drill.feedback.type === 'success' ? 'is-ok' : ''} ${drill.feedback.type === 'error' ? 'is-bad' : ''}`.trim()}
                aria-live="polite"
              >
                <p className="verbs-form-label" data-testid="verb-form-label">
                  {VERB_FORM_LABELS[activeCard.form]}
                </p>
                <p className="verbs-writing" data-testid="verb-prompt">
                  {activeCard.dictionary.writing}
                </p>
                <p className="verbs-kana">
                  {activeCard.dictionary.kana} · {activeCard.dictionary.romaji}
                </p>
                <p className="verbs-meaning">
                  {activeCard.meaning} · {verbGroupLabel(activeCard.group)}
                </p>
                {showHint ? (
                  <p className="particles-kana" data-testid="verb-hint">
                    {activeCard.target.kana} · {activeCard.target.romaji}
                  </p>
                ) : null}
              </div>
              {isMobile ? (
                <div className="particles-transcript-actions">
                  <button
                    type="button"
                    className={
                      showHint
                        ? 'hint-button particles-transcript-button is-on'
                        : 'hint-button particles-transcript-button'
                    }
                    data-testid="verbs-hint-button"
                    aria-pressed={showHint}
                    onClick={toggleHint}
                  >
                    {showHint ? 'Скрыть подсказку' : 'Подсказка'}
                  </button>
                </div>
              ) : null}
            </div>

            <ChoicePad
              className="particles-pad verbs-pad"
              options={choices.map((item) => item.writing)}
              onPick={handleChoice}
              disabled={drill.locked}
              itemClassName={(writing) =>
                choiceItemClass('particles-choice', writing, drill.choiceFlash, activeCard.target.writing)
              }
              testIdFor={(writing) => `verb-choice-${writing}`}
              render={(writing) => {
                const option = choices.find((item) => item.writing === writing)
                return (
                  <>
                    <span className="particles-choice-glyph verbs-choice-glyph">{writing}</span>
                    <span className="particles-choice-romaji">{option?.romaji}</span>
                  </>
                )
              }}
            />

            <div className="particles-footer">
              <p className={`particles-feedback ${drill.feedback.type ? `is-${drill.feedback.type}` : ''}`}>
                {drill.feedback.text ||
                  (isMobile
                    ? 'Выберите форму · кнопка «Подсказка» — чтение ответа'
                    : 'Выберите форму · Space — подсказка · стрелки — карточка')}
              </p>
              <div className="particles-footer-actions">
                {cheatTriggers}
                {drill.canGoPrev ? (
                  <button
                    type="button"
                    className="ghost-button"
                    data-testid="verbs-skip-prev"
                    onClick={() => drill.skipToAdjacent('prev')}
                  >
                    ← Назад
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="verbs-skip-next"
                  onClick={() => drill.skipToAdjacent('next')}
                >
                  Дальше →
                </button>
              </div>
              <ShortcutNote
                keyboard={
                  <>
                    <kbd>Space</kbd> — подсказка · <kbd>←</kbd>/<kbd>→</kbd> — назад/дальше
                  </>
                }
                swipe={<>Свайп ←/→ — назад/дальше · кнопка «Подсказка»</>}
              />
            </div>
          </>
        ) : null}
      </PracticeShell>
      {cheatSheetPopup}
    </>
  )
}
