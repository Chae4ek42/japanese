import type { KanjiWordJlptLevel } from '../../shared/lib/types'

export const WORD_JLPT_LEVELS: KanjiWordJlptLevel[] = [5, 4, 3, 2, 1]

/** Empty preference = no JLPT filter (all words, including untagged). */
export function isWordJlptLevelActive(
  selected: KanjiWordJlptLevel[],
  level: KanjiWordJlptLevel,
): boolean {
  return selected.includes(level)
}

export function isWordJlptFilterOff(selected: KanjiWordJlptLevel[]): boolean {
  return selected.length === 0
}

export function toggleWordJlptLevel(
  selected: KanjiWordJlptLevel[],
  level: KanjiWordJlptLevel,
): KanjiWordJlptLevel[] {
  // From «no filter», first click starts a restrictive set with just that level.
  if (selected.length === 0) {
    return [level]
  }
  const set = new Set(selected)
  if (set.has(level)) set.delete(level)
  else set.add(level)
  const next = WORD_JLPT_LEVELS.filter((item) => set.has(item))
  // Cleared all chips, or selected every level → no filter.
  if (next.length === 0 || next.length === WORD_JLPT_LEVELS.length) return []
  return next
}

export interface WordJlptFilterProps {
  selected: KanjiWordJlptLevel[]
  testIdPrefix?: string
  onChange: (next: KanjiWordJlptLevel[]) => void
}

export function WordJlptFilter({
  selected,
  testIdPrefix = 'kanji-word-jlpt',
  onChange,
}: WordJlptFilterProps) {
  const filterOff = isWordJlptFilterOff(selected)
  return (
    <div className="kanji-word-jlpt" data-testid={testIdPrefix} role="group" aria-label="Фильтр слов по JLPT">
      <span className="kanji-word-jlpt-label">JLPT слов</span>
      <div className="kanji-word-jlpt-tabs">
        <button
          type="button"
          className={filterOff ? 'kanji-filter-tab is-active' : 'kanji-filter-tab'}
          data-testid={`${testIdPrefix}-all`}
          aria-pressed={filterOff}
          title="Без фильтра: все слова, включая без метки JLPT"
          onClick={() => onChange([])}
        >
          Все
        </button>
        {WORD_JLPT_LEVELS.map((level) => {
          const active = isWordJlptLevelActive(selected, level)
          return (
            <button
              key={level}
              type="button"
              className={active ? 'kanji-filter-tab is-active' : 'kanji-filter-tab'}
              data-testid={`${testIdPrefix}-${level}`}
              aria-pressed={active}
              title="Уровень слова, не знака. Слова без метки скрыты"
              onClick={() => onChange(toggleWordJlptLevel(selected, level))}
            >
              N{level}
            </button>
          )
        })}
      </div>
      <span className="kanji-word-jlpt-hint">
        {filterOff ? 'без фильтра' : 'слов · без метки скрыты'}
      </span>
    </div>
  )
}
