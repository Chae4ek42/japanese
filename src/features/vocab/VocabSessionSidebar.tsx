import { useMemo, useState } from 'react'
import { useIsMobileTouch } from '../../shared/lib/media'
import { VocabMobileSessionList } from './VocabMobileSessionList'
import { wordDisplayAccuracy, sortSessionCards, type SessionWordSort } from './sessionWords'
import type {
  AdaptiveWindowState,
  VocabSessionMode,
  KanjiWordJlptLevel,
  StatsRecord,
  VocabCard,
  VocabLevelFilter,
  VocabSource,
} from '../../shared/lib/types'
import { createStatsRecord } from '../../shared/lib/trainer'

import {
  WORD_JLPT_LEVELS,
  isWordJlptLevelActive,
  toggleWordJlptLevel,
} from '../kanji/WordJlptFilter'

export { wordDisplayAccuracy, sortSessionCards } from './sessionWords'
export type { SessionWordSort } from './sessionWords'

const SORT_OPTIONS: Array<{ id: SessionWordSort; label: string }> = [
  { id: 'accuracy-asc', label: 'Точн. ↑' },
  { id: 'accuracy-desc', label: 'Точн. ↓' },
  { id: 'novelty', label: 'Новизна' },
]

const SOURCE_LEVELS: VocabLevelFilter[] = [5, 4, 3, 2, 1]

export interface VocabSessionSidebarProps {
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
  sessionMode?: VocabSessionMode
  adaptiveState?: AdaptiveWindowState
  onLevelChange?: (level: VocabLevelFilter) => void
  onWordJlptChange?: (levels: KanjiWordJlptLevel[]) => void
  onSetWeight: (cardId: string, multiplier: number) => void
  onResetWeights: () => void
  onAddSourceWord?: () => void
}

export function VocabSessionSidebar({
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
  sessionMode = 'drill',
  adaptiveState,
  onLevelChange,
  onWordJlptChange,
  onSetWeight,
  onResetWeights,
  onAddSourceWord,
}: VocabSessionSidebarProps) {
  const isMobile = useIsMobileTouch()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState<SessionWordSort>('accuracy-asc')
  const excludedCount = cards.filter((card) => (weightMultipliers[card.id] ?? 1) <= 0).length
  const showSourceLevel = source === 'level' && Boolean(onLevelChange)
  const hasFilters = showSourceLevel || showWordJlptFilter

  const sortedCards = useMemo(
    () => isMobile ? [] : sortSessionCards(cards, stats, sort, poolAddedAt),
    [isMobile, cards, stats, sort, poolAddedAt],
  )

  if (isMobile) return <VocabMobileSessionList
    source={source} level={level} wordJlptLevels={wordJlptLevels} cards={cards} currentCardId={currentCardId}
    stats={stats} weightMultipliers={weightMultipliers} poolAddedAt={poolAddedAt}
    canAddSourceWord={canAddSourceWord} showWordJlptFilter={showWordJlptFilter} sessionMode={sessionMode} adaptiveState={adaptiveState}
    onLevelChange={onLevelChange} onWordJlptChange={onWordJlptChange} onSetWeight={onSetWeight} onResetWeights={onResetWeights} onAddSourceWord={onAddSourceWord}
  />

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
          <span className="vocab-session-label" data-testid="vocab-session-mode-label">
            {sessionMode === 'adaptive' ? 'Повторение' : 'Равномерная'}
          </span>
          {hasFilters ? <button type="button" className="vocab-session-reset"
            data-testid="vocab-session-toggle-filters" onClick={() => setFiltersOpen((open) => !open)}>
            {filtersOpen ? 'Скрыть фильтры' : 'Фильтры'}
          </button> : null}
        </div>
        {adaptiveState ? <p className="control-hint" data-testid="vocab-adaptive-progress">
          В группе: {adaptiveState.active.length} · Введено: {adaptiveState.introduced.length} из {cards.length}
        </p> : null}
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
            <button
              type="button"
              className={
                wordJlptLevels.length === 0
                  ? 'vocab-session-jlpt-btn is-active'
                  : 'vocab-session-jlpt-btn'
              }
              data-testid="vocab-session-word-jlpt-all"
              aria-pressed={wordJlptLevels.length === 0}
              onClick={() => onWordJlptChange([])}
            >
              Все
            </button>
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
            const phase = adaptiveState ? adaptiveState.active.includes(card.id) ? 'в группе' : adaptiveState.introduced.includes(card.id) ? 'повторение' : 'впереди' : ''
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
                  <span className="vocab-session-row-detail">{detail}{phase ? ` · ${phase}` : ''}</span>
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

function pluralWords(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'слово'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'слова'
  return 'слов'
}
