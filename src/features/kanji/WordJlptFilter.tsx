import type { KanjiWordJlptLevel } from '../../shared/lib/types'

export const WORD_JLPT_LEVELS: KanjiWordJlptLevel[] = [5, 4, 3, 2, 1]

/** Empty preference = all levels allowed. */
export function isWordJlptLevelActive(
  selected: KanjiWordJlptLevel[],
  level: KanjiWordJlptLevel,
): boolean {
  return selected.length === 0 || selected.includes(level)
}

export function toggleWordJlptLevel(
  selected: KanjiWordJlptLevel[],
  level: KanjiWordJlptLevel,
): KanjiWordJlptLevel[] {
  const base = selected.length ? selected : [...WORD_JLPT_LEVELS]
  const set = new Set(base)
  if (set.has(level)) set.delete(level)
  else set.add(level)
  const next = WORD_JLPT_LEVELS.filter((item) => set.has(item))
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
  return (
    <div className="kanji-word-jlpt" data-testid={testIdPrefix} role="group" aria-label="Фильтр слов по JLPT">
      <span className="kanji-word-jlpt-label">JLPT слов</span>
      <div className="kanji-word-jlpt-tabs">
        {WORD_JLPT_LEVELS.map((level) => {
          const active = isWordJlptLevelActive(selected, level)
          return (
            <button
              key={level}
              type="button"
              className={active ? 'kanji-filter-tab is-active' : 'kanji-filter-tab'}
              data-testid={`${testIdPrefix}-${level}`}
              aria-pressed={active}
              title={
                selected.length === 0
                  ? 'Уровень слова, не знака. Все слова, включая без метки JLPT'
                  : 'Уровень слова, не знака. Только выбранные метки (слова без метки скрыты)'
              }
              onClick={() => onChange(toggleWordJlptLevel(selected, level))}
            >
              N{level}
            </button>
          )
        })}
      </div>
      <span className="kanji-word-jlpt-hint">
        {selected.length === 0 ? 'слов · все' : 'слов · без метки скрыты'}
      </span>
    </div>
  )
}
