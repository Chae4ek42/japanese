import { useMemo, useState } from 'react'
import './styles.css'
import {
  KANJI_BANK_META,
  KANJI_LIST,
  getJoyoKanji,
  getKanjiByLevel,
  getPopularWordsForKanji,
  pickRandomUnlearnedKanji,
} from '../../data/words/bank'
import { useIsMobileTouch } from '../../shared/lib/media'
import { useLongPress } from '../../shared/lib/useLongPress'
import { useKanjiState, useVocabState } from '../../shared/state/AppStateContext'
import { KanjiInfoCard } from './KanjiInfoCard'
import { KanjiTrainer } from './KanjiTrainer'
import { WordJlptFilter } from './WordJlptFilter'

type KanjiFilter = 'all' | 'joyo' | 5 | 4 | 3 | 2 | 1

const FILTERS: { id: KanjiFilter; label: string }[] = [
  { id: 5, label: 'N5' },
  { id: 4, label: 'N4' },
  { id: 3, label: 'N3' },
  { id: 2, label: 'N2' },
  { id: 1, label: 'N1' },
  { id: 'joyo', label: 'Jōyō' },
  { id: 'all', label: 'Все' },
]

function filterKanji(filter: KanjiFilter) {
  if (filter === 'all') return KANJI_LIST
  if (filter === 'joyo') return getJoyoKanji()
  return getKanjiByLevel(filter)
}

function KanjiGridCell({
  character,
  learned,
  meaningsLabel,
  levelLabel,
  sampleCount,
  onPractice,
  onOpenInfo,
}: {
  character: string
  learned: boolean
  meaningsLabel: string
  levelLabel?: string | null
  sampleCount: number
  onPractice: () => void
  onOpenInfo: () => void
}) {
  const isMobile = useIsMobileTouch()
  const longPress = useLongPress(onOpenInfo, { enabled: isMobile })
  const title = isMobile
    ? `${meaningsLabel} · ${sampleCount} слов · долгое нажатие — карточка`
    : `${meaningsLabel} · ${sampleCount} слов · колёсико — карточка`

  return (
    <button
      type="button"
      data-testid={`kanji-cell-${character}`}
      className={learned ? 'kanji-cell is-learned' : 'kanji-cell'}
      title={title}
      onClick={onPractice}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault()
          onOpenInfo()
        }
      }}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      {...longPress}
    >
      <span className="kanji-cell-char">{character}</span>
      <span className="kanji-cell-meta">{meaningsLabel}</span>
      {levelLabel ? <span className="kanji-cell-badge">{levelLabel}</span> : null}
    </button>
  )
}

export function KanjiPage() {
  const kanji = useKanjiState()
  const vocab = useVocabState()
  const [focusKanji, setFocusKanji] = useState<string | null>(null)
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const [filter, setFilter] = useState<KanjiFilter>(5)

  const learned = kanji?.learned ?? []
  const preferences = kanji?.preferences ?? {
    hiddenWordsByKanji: {},
    wordJlptLevels: [],
  }
  const myWords = vocab?.myWords ?? []
  const trainingWordIds = vocab?.trainingWordIds ?? []
  const customWords = vocab?.customWords ?? {}
  const onToggleLearned = kanji?.toggleLearned ?? (() => {})
  const onPatchPreferences = kanji?.patchPreferences ?? (() => {})
  const onToggleMyWord = vocab?.toggleMyWord ?? (() => {})
  const onToggleTrainingWord = vocab?.toggleTrainingWord ?? (() => {})
  const onSaveWordEdit = vocab?.saveWordEdit ?? (() => {})
  const kanjiState = { learned, preferences }

  const learnedSet = useMemo(() => new Set(kanjiState.learned), [kanjiState.learned])
  const wordJlptLevels = kanjiState.preferences.wordJlptLevels ?? []
  const hiddenWordsByKanji = kanjiState.preferences.hiddenWordsByKanji ?? {}

  const items = useMemo(() => filterKanji(filter), [filter])
  const learnedCount = items.filter((item) => learnedSet.has(item.character)).length

  if (!kanji || !vocab) return null

  function startRandom() {
    const levels =
      filter === 'all' || filter === 'joyo'
        ? [5, 4, 3, 2, 1, 0]
        : [filter]
    const next =
      pickRandomUnlearnedKanji(kanjiState.learned, levels) ??
      pickRandomUnlearnedKanji([], levels) ??
      pickRandomUnlearnedKanji([])
    if (next) {
      setInfoKanji(null)
      setFocusKanji(next.character)
    }
  }

  function hideWordForFocus(wordId: string) {
    if (!focusKanji || !wordId) return
    const current = hiddenWordsByKanji[focusKanji] ?? []
    if (current.includes(wordId)) return
    onPatchPreferences({
      hiddenWordsByKanji: {
        ...hiddenWordsByKanji,
        [focusKanji]: [...current, wordId],
      },
    })
  }

  function restoreHiddenForFocus() {
    if (!focusKanji) return
    const next = { ...hiddenWordsByKanji }
    delete next[focusKanji]
    onPatchPreferences({ hiddenWordsByKanji: next })
  }

  if (focusKanji) {
    return (
      <>
        <KanjiTrainer
          character={focusKanji}
          learned={kanjiState.learned}
          wordJlptLevels={wordJlptLevels}
          hiddenWordIds={hiddenWordsByKanji[focusKanji] ?? []}
          myWords={myWords}
          trainingWordIds={trainingWordIds}
          customWords={customWords}
          onPatchPreferences={onPatchPreferences}
          onHideWord={hideWordForFocus}
          onRestoreHiddenWords={restoreHiddenForFocus}
          onToggleLearned={onToggleLearned}
          onToggleMyWord={onToggleMyWord}
          onToggleTrainingWord={onToggleTrainingWord}
          onSaveWordEdit={onSaveWordEdit}
          onBack={() => setFocusKanji(null)}
          onOpenInfo={(character) => setInfoKanji(character)}
        />
        {infoKanji ? (
          <KanjiInfoCard
            character={infoKanji}
            learned={learnedSet.has(infoKanji)}
            myWords={myWords}
            trainingWordIds={trainingWordIds}
            onClose={() => setInfoKanji(null)}
            onToggleLearned={onToggleLearned}
            onToggleMyWord={onToggleMyWord}
            onToggleTrainingWord={onToggleTrainingWord}
          />
        ) : null}
      </>
    )
  }

  return (
    <main className="kanji-page" data-testid="kanji-page">
      <section className="page-surface kanji-page-surface">
        <div className="section-heading kanji-page-head">
          <div>
            <h2>Кандзи</h2>
            <p className="subsection-note">
              {KANJI_BANK_META.counts.kanji} знаков
              {KANJI_BANK_META.counts.joyo ? ` · ${KANJI_BANK_META.counts.joyo} Jōyō` : ''} ·{' '}
              {KANJI_BANK_META.counts.words} слов.{' '}
              <span className="hint-kbd">Клик — практика · колёсико — карточка знака.</span>
              <span className="hint-swipe">Тап — практика · долгое нажатие — карточка знака.</span>
            </p>
          </div>
          <div className="kanji-page-actions">
            <WordJlptFilter
              selected={wordJlptLevels}
              onChange={(next) => onPatchPreferences({ wordJlptLevels: next })}
            />
            <button type="button" className="primary-button" data-testid="kanji-random" onClick={startRandom}>
              Случайный знак
            </button>
          </div>
        </div>

        <div className="kanji-filter-tabs" data-testid="kanji-filter-tabs" role="tablist" aria-label="Фильтр кандзи">
          {FILTERS.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? 'kanji-filter-tab is-active' : 'kanji-filter-tab'}
              data-testid={`kanji-filter-${item.label}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="kanji-level-block" data-testid={`kanji-filter-panel-${filter}`}>
          <div className="kanji-level-heading">
            <h3>{FILTERS.find((item) => item.id === filter)?.label ?? 'Кандзи'}</h3>
            <p className="kanji-level-meta">
              {learnedCount} из {items.length} отмечено
            </p>
          </div>
          <div className="kanji-grid">
            {items.map((item) => {
              const learned = learnedSet.has(item.character)
              const sampleCount = getPopularWordsForKanji(item.character).length
              const meaningsLabel =
                (item.meaningsRu ?? item.meanings)[0] ?? item.levelLabel ?? item.character
              return (
                <KanjiGridCell
                  key={item.character}
                  character={item.character}
                  learned={learned}
                  meaningsLabel={meaningsLabel}
                  levelLabel={item.levelLabel}
                  sampleCount={sampleCount}
                  onPractice={() => setFocusKanji(item.character)}
                  onOpenInfo={() => setInfoKanji(item.character)}
                />
              )
            })}
          </div>
        </section>
      </section>

      {infoKanji ? (
        <KanjiInfoCard
          character={infoKanji}
          learned={learnedSet.has(infoKanji)}
          myWords={myWords}
          trainingWordIds={trainingWordIds}
          onClose={() => setInfoKanji(null)}
          onToggleLearned={onToggleLearned}
          onToggleMyWord={onToggleMyWord}
          onToggleTrainingWord={onToggleTrainingWord}
          onStartPractice={(character) => {
            setInfoKanji(null)
            setFocusKanji(character)
          }}
        />
      ) : null}
    </main>
  )
}
