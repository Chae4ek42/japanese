import { useMemo, useState } from 'react'
import type {
  KanjiWordJlptLevel,
  StatsRecord,
  VocabCard,
  VocabLevelFilter,
  VocabPickMode,
  VocabSource,
} from '../../shared/lib/types'
import { countsFromRecentAnswers, createStatsRecord } from '../../shared/lib/trainer'

/** Accuracy for session sidebar: last 15 correct/wrong (hints excluded). */
export function wordDisplayAccuracy(stats: StatsRecord): {
  percent: number | null
  clears: number
  errors: number
} {
  const recent = stats.recentAnswers
  if (recent?.length) {
    const { clears, errors } = countsFromRecentAnswers(recent)
    const total = clears + errors
    return {
      percent: total ? Math.round((clears / total) * 100) : null,
      clears,
      errors,
    }
  }
  const clears = stats.clears
  const errors = stats.errors
  const total = clears + errors
  return {
    percent: total ? Math.round((clears / total) * 100) : null,
    clears,
    errors,
  }
}
import {
  WORD_JLPT_LEVELS,
  isWordJlptLevelActive,
  toggleWordJlptLevel,
} from '../kanji/WordJlptFilter'

const PICK_OPTIONS: Array<{ id: VocabPickMode; label: string }> = [
  { id: 'adaptive', label: 'Адаптивный' },
  { id: 'even', label: 'Равномерный' },
]

const SORT_OPTIONS: Array<{ id: SessionWordSort; label: string }> = [
  { id: 'accuracy-asc', label: 'Точн. ↑' },
  { id: 'accuracy-desc', label: 'Точн. ↓' },
  { id: 'novelty', label: 'Новизна' },
]

const SOURCE_LEVELS: VocabLevelFilter[] = [5, 4, 3, 2, 1]

export type SessionWordSort = 'accuracy-asc' | 'accuracy-desc' | 'novelty'

export interface VocabSessionSidebarProps {
  pickMode: VocabPickMode
  source: VocabSource
  level: VocabLevelFilter
  wordJlptLevels: KanjiWordJlptLevel[]
  cards: VocabCard[]
  currentCardId: string | null
  stats: Record<string, StatsRecord>
  weightMultipliers: Record<string, number>
  /** Epoch ms when each card was added to the training session. */
  poolAddedAt?: Record<string, number>
  canAddSourceWord?: boolean
  showWordJlptFilter?: boolean
  onPickModeChange: (mode: VocabPickMode) => void
  onLevelChange?: (level: VocabLevelFilter) => void
  onWordJlptChange?: (levels: KanjiWordJlptLevel[]) => void
  onSetWeight: (cardId: string, multiplier: number) => void
  onResetWeights: () => void
  onAddSourceWord?: () => void
}

export function VocabSessionSidebar({
  pickMode,
  source,
  level,
  wordJlptLevels,
  cards,
  currentCardId,
  stats,
  weightMultipliers,
  poolAddedAt = {},
  canAddSourceWord = false,
  showWordJlptFilter = false,
  onPickModeChange,
  onLevelChange,
  onWordJlptChange,
  onSetWeight,
  onResetWeights,
  onAddSourceWord,
}: VocabSessionSidebarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState<SessionWordSort>('accuracy-asc')
  const excludedCount = cards.filter((card) => (weightMultipliers[card.id] ?? 1) <= 0).length
  const showSourceLevel = source === 'level' && Boolean(onLevelChange)
  const hasFilters = showSourceLevel || showWordJlptFilter

  const sortedCards = useMemo(
    () => sortSessionCards(cards, stats, sort, poolAddedAt),
    [cards, stats, sort, poolAddedAt],
  )

  return (
    <div className="vocab-session-panel" data-testid="vocab-session-sidebar">
      <header className="vocab-session-top">
        <div>
          <p className="vocab-session-kicker">Сессия</p>
          <h3 className="vocab-session-title">
            {cards.length} {pluralWords(cards.length)}
          </h3>
        </div>
        <div className="vocab-session-meta">
          {excludedCount ? (
            <span className="vocab-session-pill" data-testid="vocab-session-excluded-count">
              вне: {excludedCount}
            </span>
          ) : null}
          {canAddSourceWord && onAddSourceWord ? (
            <button
              type="button"
              className="vocab-session-add"
              data-testid="vocab-add-source-word"
              onClick={onAddSourceWord}
            >
              + Слово
            </button>
          ) : null}
        </div>
      </header>

      <section className="vocab-session-block">
        <div className="vocab-session-block-head">
          <span className="vocab-session-label">Подбор</span>
          {hasFilters ? (
            <button
              type="button"
              className="vocab-session-reset"
              data-testid="vocab-session-toggle-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? 'Скрыть фильтры' : 'Фильтры'}
            </button>
          ) : null}
        </div>
        <div className="vocab-session-pick" role="group" aria-label="Режим подбора">
          {PICK_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                pickMode === option.id
                  ? 'vocab-session-pick-btn is-active'
                  : 'vocab-session-pick-btn'
              }
              data-testid={`vocab-session-pick-${option.id}`}
              onClick={() => onPickModeChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {filtersOpen && showSourceLevel ? (
        <section className="vocab-session-block" data-testid="vocab-session-level-filter">
          <div className="vocab-session-block-head">
            <span className="vocab-session-label">Уровень JLPT</span>
          </div>
          <div className="vocab-session-jlpt" role="group" aria-label="Уровень JLPT">
            {SOURCE_LEVELS.map((item) => (
              <button
                key={item}
                type="button"
                className={
                  level === item ? 'vocab-session-jlpt-btn is-active' : 'vocab-session-jlpt-btn'
                }
                data-testid={`vocab-session-level-${item}`}
                aria-pressed={level === item}
                onClick={() => onLevelChange?.(item)}
              >
                N{item}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {filtersOpen && showWordJlptFilter && onWordJlptChange ? (
        <section className="vocab-session-block" data-testid="vocab-session-word-jlpt">
          <div className="vocab-session-block-head">
            <span className="vocab-session-label">Слова JLPT</span>
          </div>
          <div className="vocab-session-jlpt" role="group" aria-label="Фильтр слов по JLPT">
            {WORD_JLPT_LEVELS.map((item) => {
              const active = isWordJlptLevelActive(wordJlptLevels, item)
              return (
                <button
                  key={item}
                  type="button"
                  className={
                    active ? 'vocab-session-jlpt-btn is-active' : 'vocab-session-jlpt-btn'
                  }
                  data-testid={`vocab-session-word-jlpt-${item}`}
                  aria-pressed={active}
                  onClick={() => onWordJlptChange(toggleWordJlptLevel(wordJlptLevels, item))}
                >
                  N{item}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="vocab-session-block vocab-session-words-block">
        <div className="vocab-session-block-head">
          <span className="vocab-session-label">Статистика</span>
          {excludedCount ? (
            <button
              type="button"
              className="vocab-session-reset"
              data-testid="vocab-session-restore-all"
              onClick={onResetWeights}
            >
              Вернуть все
            </button>
          ) : null}
        </div>

        <div
          className="vocab-session-sort"
          role="group"
          aria-label="Сортировка слов"
          data-testid="vocab-session-sort"
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                sort === option.id
                  ? 'vocab-session-sort-btn is-active'
                  : 'vocab-session-sort-btn'
              }
              data-testid={`vocab-session-sort-${option.id}`}
              aria-pressed={sort === option.id}
              onClick={() => setSort(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <ul className="vocab-session-list" role="list" aria-label="Статистика слов сессии">
          {sortedCards.map((card) => {
            const cardStats = stats[card.id] ?? createStatsRecord()
            const excluded = (weightMultipliers[card.id] ?? 1) <= 0
            const isCurrent = card.id === currentCardId
            const { percent, clears, errors } = wordDisplayAccuracy(cardStats)
            const answered = clears + errors
            const accuracyLabel = percent === null ? '—' : `${percent}%`
            const detail = answered > 0 ? `${clears}✓ · ${errors}✗` : 'нет ответов'
            const className = [
              'vocab-session-row',
              isCurrent ? 'is-current' : '',
              excluded ? 'is-excluded' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <li key={card.id} className={className} data-testid={`vocab-session-word-${card.id}`}>
                <div className="vocab-session-row-main">
                  <span className="vocab-session-row-writing">{card.writing}</span>
                  <span
                    className="vocab-session-row-stat"
                    data-testid={`vocab-session-accuracy-${card.id}`}
                    title={detail}
                  >
                    {excluded ? 'вне' : accuracyLabel}
                  </span>
                  <span className="vocab-session-row-meaning">{card.meaning}</span>
                  <span className="vocab-session-row-detail">{detail}</span>
                  {isCurrent ? <span className="vocab-session-now">сейчас</span> : null}
                </div>

                <div
                  className="vocab-session-row-presets"
                  role="group"
                  aria-label={`Сессия ${card.writing}`}
                >
                  {excluded ? (
                    <button
                      type="button"
                      className="vocab-session-preset vocab-session-restore"
                      data-testid={`vocab-session-restore-${card.id}`}
                      onClick={() => onSetWeight(card.id, 1)}
                    >
                      Вернуть
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="vocab-session-preset"
                      data-testid={`vocab-session-exclude-${card.id}`}
                      onClick={() => onSetWeight(card.id, 0)}
                    >
                      Исключить
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export function sortSessionCards(
  cards: VocabCard[],
  stats: Record<string, StatsRecord>,
  sort: SessionWordSort,
  poolAddedAt: Record<string, number> = {},
): VocabCard[] {
  const ranked = cards.map((card, index) => {
    const cardStats = stats[card.id] ?? createStatsRecord()
    const { percent } = wordDisplayAccuracy(cardStats)
    const accuracy = percent ?? -1
    // Newest additions to the training session first.
    const novelty = poolAddedAt[card.id] ?? 0
    return { card, index, accuracy, novelty }
  })

  ranked.sort((a, b) => {
    if (sort === 'accuracy-asc') {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
    } else if (sort === 'accuracy-desc') {
      if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy
    } else if (a.novelty !== b.novelty) {
      return b.novelty - a.novelty
    }
    return sort === 'novelty' ? b.index - a.index : a.index - b.index
  })

  return ranked.map((entry) => entry.card)
}

function pluralWords(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'слово'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'слова'
  return 'слов'
}
