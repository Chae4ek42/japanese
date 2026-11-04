import { useMemo, useState } from 'react'
import type { VocabSessionSidebarProps } from './VocabSessionSidebar'
import { createStatsRecord } from '../../shared/lib/trainer'
import { scoreProblemWord } from './problemWords'
import { sortSessionCards, wordDisplayAccuracy, type SessionWordSort } from './sessionWords'
import { WORD_JLPT_LEVELS, isWordJlptLevelActive, toggleWordJlptLevel } from '../kanji/WordJlptFilter'

type Filter = 'all' | 'current' | 'active' | 'problem' | 'excluded'
const PAGE_SIZE = 50

export function VocabMobileSessionList({ cards, currentCardId, stats, weightMultipliers, poolAddedAt = {}, sessionMode,
  adaptiveState, onSetWeight, onResetWeights, canAddSourceWord, onAddSourceWord,
  source, level, onLevelChange, showWordJlptFilter, wordJlptLevels, onWordJlptChange,
}: VocabSessionSidebarProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SessionWordSort>('accuracy-asc')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const active = useMemo(() => new Set(adaptiveState?.active ?? []), [adaptiveState?.active])
  const introduced = useMemo(() => new Set(adaptiveState?.introduced ?? []), [adaptiveState?.introduced])
  const excluded = useMemo(() => new Set(cards.filter((card) => (weightMultipliers[card.id] ?? 1) <= 0).map((card) => card.id)), [cards, weightMultipliers])
  const problem = useMemo(() => new Set(cards.filter((card) => scoreProblemWord(stats[card.id])?.eligible).map((card) => card.id)), [cards, stats])
  const sortedCards = useMemo(() => sortSessionCards(cards, stats, sort, poolAddedAt), [cards, stats, sort, poolAddedAt])
  const searchText = useMemo(() => new Map(cards.map((card) => [card.id, [card.writing, card.kana, card.romaji, ...card.meanings,
    ...(card.readings ?? []).flatMap((reading) => [reading.kana, reading.romaji, ...reading.meanings])].join(' ').toLocaleLowerCase()])), [cards])
  const result = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return sortedCards.filter((card) => {
      if (filter === 'current' && card.id !== currentCardId) return false
      if (filter === 'active' && (!active.has(card.id) || excluded.has(card.id))) return false
      if (filter === 'problem' && !problem.has(card.id)) return false
      if (filter === 'excluded' && !excluded.has(card.id)) return false
      const text = searchText.get(card.id) ?? ''
      return terms.every((term) => text.includes(term))
    })
  }, [sortedCards, searchText, query, filter, currentCardId, active, excluded, problem])
  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'Все', count: cards.length },
    ...(adaptiveState ? [{ id: 'active' as const, label: 'В окне', count: [...active].filter((id) => !excluded.has(id)).length }] : []),
    { id: 'problem', label: 'Трудные', count: problem.size },
    { id: 'excluded', label: 'Вне', count: excluded.size },
  ]
  function changeFilter(next: Filter) { setFilter(next); setLimit(PAGE_SIZE) }

  return <div className="mobile-session-list" data-testid="vocab-session-sidebar">
    <div className="mobile-session-controls">
      <div className="mobile-session-summary">
        <span data-testid="vocab-session-mode-label">{sessionMode === 'adaptive' ? 'Повторение' : 'Равномерная'}</span>
        <span>{cards.length - excluded.size} в тренировке</span>
        {canAddSourceWord && onAddSourceWord ? <button type="button" className="text-button" data-testid="vocab-add-source-word" onClick={onAddSourceWord}>+ Слово</button> : null}
      </div>
      {adaptiveState ? <p className="mobile-session-progress" data-testid="vocab-adaptive-progress">В группе: {active.size} · Введено: {introduced.size} из {cards.length}</p> : null}
      <div className="mobile-session-search">
        <label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
          <input type="search" aria-label="Найти слово в тренировке" placeholder="Слово, чтение, перевод" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE) }} data-testid="vocab-session-search" />
        </label>
        <button type="button" className={filter === 'current' ? 'is-active' : ''} aria-label="Показать текущее слово" aria-pressed={filter === 'current'} data-testid="vocab-session-current-filter" onClick={() => { changeFilter(filter === 'current' ? 'all' : 'current'); setQuery('') }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v5m0 10v5M2 12h5m10 0h5" /></svg>
        </button>
      </div>
      <div className="mobile-session-filters" role="group" aria-label="Показать слова">
        {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} data-testid={`vocab-session-filter-${item.id}`} onClick={() => changeFilter(item.id)}>{item.label}<span>{item.count}</span></button>)}
      </div>
      <div className="mobile-session-sort">
        <span aria-live="polite">{filter === 'current' ? 'Текущее слово' : `Найдено: ${result.length}`}</span>
        <select aria-label="Сортировка слов" value={sort} onChange={(event) => { setSort(event.target.value as SessionWordSort); setLimit(PAGE_SIZE) }}>
          <option value="accuracy-asc">Сначала сложные</option><option value="accuracy-desc">Сначала знакомые</option><option value="novelty">Сначала новые</option>
        </select>
      </div>
    </div>
    <div className="mobile-session-scroll" data-testid="vocab-session-scroll">
      {(source === 'level' && onLevelChange || showWordJlptFilter && onWordJlptChange) ? <details className="mobile-session-composition">
        <summary>Состав тренировки</summary>
        {source === 'level' && onLevelChange ? <div role="group" aria-label="Уровень JLPT">
          {[5, 4, 3, 2, 1].map((item) => <button type="button" key={item} aria-pressed={level === item} onClick={() => onLevelChange(item as 1 | 2 | 3 | 4 | 5)}>N{item}</button>)}
        </div> : null}
        {showWordJlptFilter && onWordJlptChange ? <div role="group" aria-label="Фильтр слов по JLPT">
          <button type="button" aria-pressed={!wordJlptLevels.length} onClick={() => onWordJlptChange([])}>Все</button>
          {WORD_JLPT_LEVELS.map((item) => <button type="button" key={item} aria-pressed={isWordJlptLevelActive(wordJlptLevels, item)} onClick={() => onWordJlptChange(toggleWordJlptLevel(wordJlptLevels, item))}>N{item}</button>)}
        </div> : null}
      </details> : null}
      {excluded.size > 0 ? <button type="button" className="mobile-session-restore-all text-button" data-testid="vocab-session-restore-all" onClick={onResetWeights}>Вернуть все исключённые · {excluded.size}</button> : null}
      {!result.length ? <div className="mobile-session-empty"><strong>{query ? 'Ничего не найдено' : 'Здесь пока нет слов'}</strong><p>{filter === 'problem' ? 'Нужны минимум 5 ответов и недавние ошибки.' : 'Попробуйте другой фильтр или измените запрос.'}</p><button type="button" className="text-button" onClick={() => { setQuery(''); changeFilter('all') }}>Показать все</button></div> : null}
      <ul className="mobile-session-words" aria-label="Слова тренировки">
        {result.slice(0, limit).map((card) => {
          const { percent, clears, errors } = wordDisplayAccuracy(stats[card.id] ?? createStatsRecord())
          const isExcluded = excluded.has(card.id)
          const isCurrent = card.id === currentCardId
          const isExpanded = expanded === card.id
          const detail = clears + errors ? `${clears}✓ · ${errors}✗` : 'нет ответов'
          const phase = active.has(card.id) ? 'В окне' : introduced.has(card.id) ? 'Повторение' : adaptiveState ? 'Впереди' : ''
          return <li key={card.id} className={`mobile-session-word${isCurrent ? ' is-current' : ''}${isExcluded ? ' is-excluded' : ''}`} data-testid={`vocab-session-word-${card.id}`}>
            <button type="button" className="mobile-session-word-main" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : card.id)}>
              <span className="mobile-session-word-title"><strong className="vocab-session-row-writing">{card.writing}</strong>{isCurrent ? <span className="mobile-session-now">Сейчас</span> : null}<span className="mobile-session-accuracy" data-testid={`vocab-session-accuracy-${card.id}`} title={detail}>{percent === null ? '—' : `${percent}%`}</span><svg className="mobile-session-expand" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></span>
              <span className="mobile-session-word-meaning">{card.meaning}</span>
              <span className="mobile-session-word-meta"><span>{detail}</span><span>{isExcluded ? 'Исключено' : phase}</span></span>
            </button>
            {isExpanded ? <div className="mobile-session-word-details">
              {(card.readings?.length ? card.readings : [{ kana: card.kana, romaji: card.romaji, meanings: card.meanings }]).map((reading, index) => <div key={index}><p lang="ja">{reading.kana}<span>{reading.romaji}</span></p><p>{reading.meanings.join('; ')}</p></div>)}
              <p className="mobile-session-stat-note">Точность последних ответов. Подсказка считается ошибкой.</p>
            </div> : null}
            <button type="button" className="mobile-session-word-toggle" aria-label={`${isExcluded ? 'Вернуть в тренировку' : 'Исключить из тренировки'}: ${card.writing}`} data-testid={`vocab-session-${isExcluded ? 'restore' : 'exclude'}-${card.id}`} onClick={() => onSetWeight(card.id, isExcluded ? 1 : 0)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">{isExcluded ? <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /> : <><circle cx="12" cy="12" r="8" /><path d="m7 7 10 10" /></>}</svg>
            </button>
          </li>
        })}
      </ul>
      {result.length > limit ? <button type="button" className="mobile-session-more" onClick={() => setLimit((value) => value + PAGE_SIZE)}>Показать ещё {Math.min(PAGE_SIZE, result.length - limit)}</button> : null}
    </div>
  </div>
}
