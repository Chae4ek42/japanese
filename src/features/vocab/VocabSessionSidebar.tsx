import type {
  KanjiWordJlptLevel,
  VocabCard,
  VocabLevelFilter,
  VocabPickMode,
  VocabSource,
} from '../../shared/lib/types'
import {
  WORD_JLPT_LEVELS,
  isWordJlptLevelActive,
  toggleWordJlptLevel,
} from '../kanji/WordJlptFilter'

const PICK_OPTIONS: Array<{ id: VocabPickMode; label: string; hint: string }> = [
  {
    id: 'adaptive',
    label: 'Адаптивный',
    hint: 'Слабые и новые чаще; веса тоже учитываются',
  },
  {
    id: 'even',
    label: 'Равномерный',
    hint: 'Все слова с равной частотой, если вес не меняли',
  },
]

const WEIGHT_PRESETS = [0, 100, 200] as const
const SOURCE_LEVELS: VocabLevelFilter[] = [5, 4, 3, 2, 1]

export interface VocabSessionSidebarProps {
  pickMode: VocabPickMode
  source: VocabSource
  level: VocabLevelFilter
  wordJlptLevels: KanjiWordJlptLevel[]
  cards: VocabCard[]
  currentCardId: string | null
  selectedCardId: string | null
  weightMultipliers: Record<string, number>
  canAddSourceWord?: boolean
  showWordJlptFilter?: boolean
  onPickModeChange: (mode: VocabPickMode) => void
  onLevelChange?: (level: VocabLevelFilter) => void
  onWordJlptChange?: (levels: KanjiWordJlptLevel[]) => void
  onSelectCard: (cardId: string) => void
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
  selectedCardId,
  weightMultipliers,
  canAddSourceWord = false,
  showWordJlptFilter = false,
  onPickModeChange,
  onLevelChange,
  onWordJlptChange,
  onSelectCard,
  onSetWeight,
  onResetWeights,
  onAddSourceWord,
}: VocabSessionSidebarProps) {
  const activePick = PICK_OPTIONS.find((item) => item.id === pickMode) ?? PICK_OPTIONS[0]!
  const changedCount = cards.filter((card) => {
    const value = weightMultipliers[card.id]
    return value !== undefined && Math.abs(value - 1) >= 0.01
  }).length
  const excludedCount = cards.filter((card) => (weightMultipliers[card.id] ?? 1) <= 0).length
  const showSourceLevel = source === 'level' && Boolean(onLevelChange)

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
          {changedCount ? (
            <span className="vocab-session-pill is-soft">{changedCount} изменены</span>
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
        <p className="vocab-session-hint">{activePick.hint}</p>
      </section>

      {showSourceLevel ? (
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

      {showWordJlptFilter && onWordJlptChange ? (
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
          <span className="vocab-session-label">Веса слов</span>
          <button
            type="button"
            className="vocab-session-reset"
            data-testid="vocab-session-reset-weights"
            onClick={onResetWeights}
            disabled={!changedCount}
          >
            Сбросить
          </button>
        </div>
        <p className="vocab-session-hint">0% — не показывать · 100% — обычно · выше — чаще</p>

        <ul className="vocab-session-list" role="list" aria-label="Слова текущей тренировки">
          {cards.map((card) => {
            const weightValue = weightMultipliers[card.id] ?? 1
            const weightPercent = Math.round(weightValue * 100)
            const expanded = selectedCardId === card.id
            const isCurrent = card.id === currentCardId
            const excluded = weightPercent <= 0
            const className = [
              'vocab-session-row',
              expanded ? 'is-expanded' : '',
              isCurrent ? 'is-current' : '',
              excluded ? 'is-excluded' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <li key={card.id} className={className} data-testid={`vocab-session-word-${card.id}`}>
                <button
                  type="button"
                  className="vocab-session-row-main"
                  onClick={() => onSelectCard(card.id)}
                  aria-expanded={expanded}
                >
                  <span className="vocab-session-row-writing">{card.writing}</span>
                  <span className="vocab-session-row-weight" data-testid={expanded ? 'vocab-session-weight-value' : undefined}>
                    {weightPercent}%
                  </span>
                  <span className="vocab-session-row-meaning">{card.meaning}</span>
                  {isCurrent ? <span className="vocab-session-now">сейчас</span> : null}
                </button>

                {expanded ? (
                  <div className="vocab-session-row-editor" data-testid="vocab-session-weight-editor">
                    <input
                      type="range"
                      min={0}
                      max={300}
                      step={10}
                      value={weightPercent}
                      data-testid="vocab-session-weight-slider"
                      aria-label={`Вес слова ${card.writing}`}
                      onChange={(event) => onSetWeight(card.id, Number(event.target.value) / 100)}
                    />
                    <div className="vocab-session-presets">
                      {WEIGHT_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={
                            weightPercent === preset
                              ? 'vocab-session-preset is-active'
                              : 'vocab-session-preset'
                          }
                          onClick={() => onSetWeight(card.id, preset / 100)}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
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
