import { useEffect, useMemo, useState } from 'react'
import type { VocabLevelFilter, VocabPreferences } from '../../shared/lib/types'
import { getKanjiByLevel, getPopularWordsForKanji } from '../../data/words/bank'
import { WordJlptFilter } from '../kanji/WordJlptFilter'
import { VOCAB_GROUPS } from './groups'

const drillOptions = [
  {
    id: 'romaji' as const,
    label: 'Ромадзи',
    hint: 'Смотрите написание и вводите чтение латиницей. Если у слова несколько чтений — укажите все через /.',
  },
  {
    id: 'choice' as const,
    label: 'Перевод',
    hint: 'Смотрите написание и выбираете верный перевод из 6 вариантов.',
  },
  {
    id: 'mixed' as const,
    label: 'Смешанный',
    hint: 'В одной тренировке — значения, чтения и написания; только выбор из вариантов.',
  },
]

const sourceOptions = [
  { id: 'level' as const, label: 'По уровню' },
  { id: 'group' as const, label: 'По группе' },
  { id: 'kanji' as const, label: 'По кандзи' },
  { id: 'list' as const, label: 'Набор' },
  { id: 'mine' as const, label: 'Мои слова' },
]

const pickOptions = [
  { id: 'adaptive' as const, label: 'Адаптивный', hint: 'Сначала новые в наборе, потом слабые и ошибки; после верного ответа карточка на паузе.' },
  { id: 'even' as const, label: 'Равномерный', hint: 'Все слова из набора с равной частотой.' },
]

const inputModeOptions = [
  { id: 'instant' as const, label: 'Автозачёт', hint: 'Ответ засчитывается сразу при верном вводе.' },
  { id: 'submit' as const, label: 'По Enter', hint: 'Проверка по Enter.' },
]

const JLPT_LEVELS: VocabLevelFilter[] = [5, 4, 3, 2, 1]

export interface VocabSetupProps {
  preferences: VocabPreferences
  poolCount: number
  sourcePoolCount: number
  myWordsCount: number
  myWordIds?: string[]
  trainingWordCount?: number
  errorText?: string
  infoText?: string
  /** Hide source picker; temporary set behaves like group training. */
  temporaryPool?: boolean
  onPatchPreferences: (patch: Partial<VocabPreferences>) => void
  onStart: () => void
}

export function VocabSetup({
  preferences,
  poolCount,
  sourcePoolCount,
  myWordsCount,
  myWordIds = [],
  trainingWordCount = 0,
  errorText = '',
  infoText = '',
  temporaryPool = false,
  onPatchPreferences,
  onStart,
}: VocabSetupProps) {
  const newLimit = preferences.newWordLimit ?? -1
  const [newLimitDraft, setNewLimitDraft] = useState<string | null>(null)
  const [kanjiPickLevel, setKanjiPickLevel] = useState<VocabLevelFilter>(5)
  const mySet = useMemo(() => new Set(myWordIds), [myWordIds])
  const trainFullGroup = preferences.trainFullGroup === true
  const selectedKanji = preferences.selectedKanji ?? []
  const selectedKanjiSet = useMemo(() => new Set(selectedKanji), [selectedKanji])
  const kanjiPickerItems = useMemo(() => getKanjiByLevel(kanjiPickLevel), [kanjiPickLevel])

  const showFullSetToggle =
    temporaryPool ||
    preferences.source === 'group' ||
    preferences.source === 'kanji' ||
    preferences.source === 'list'

  const showNewWordLimit = temporaryPool
    ? !trainFullGroup
    : preferences.source !== 'mine' &&
      !(
        (preferences.source === 'group' ||
          preferences.source === 'kanji' ||
          preferences.source === 'list') &&
        trainFullGroup
      )

  const showWordJlptFilter =
    preferences.source === 'group' ||
    preferences.source === 'mine' ||
    preferences.source === 'kanji' ||
    preferences.source === 'list'

  useEffect(() => {
    setNewLimitDraft(null)
  }, [newLimit])

  function toggleSelectedKanji(character: string) {
    if (selectedKanjiSet.has(character)) {
      onPatchPreferences({
        selectedKanji: selectedKanji.filter((item) => item !== character),
      })
      return
    }
    onPatchPreferences({ selectedKanji: [...selectedKanji, character] })
  }

  return (
    <section className="panel controls-panel setup-surface vocab-setup" data-testid="vocab-setup">
      <div className="control-group">
        <span className="group-label">Тип тренировки</span>
        <div className="segmented">
          {drillOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`vocab-drill-${option.id}`}
              className={preferences.drillMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
              onClick={() => onPatchPreferences({ drillMode: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="control-hint">{drillOptions.find((item) => item.id === preferences.drillMode)?.hint}</p>
      </div>

      {temporaryPool ? (
        <div className="control-group">
          <span className="group-label">Временный набор</span>
          <label className="kanji-filter-toggle">
            <input
              type="checkbox"
              data-testid="vocab-train-full-group"
              checked={trainFullGroup}
              onChange={(event) => onPatchPreferences({ trainFullGroup: event.target.checked })}
            />
            Тренировать весь набор
          </label>
          <p className="control-hint">
            {trainFullGroup
              ? 'В тренировку входят все слова набора, в том числе уже добавленные в «Мои слова».'
              : 'По умолчанию — только слова, которых ещё нет в «Моих словах».'}
          </p>
        </div>
      ) : (
        <>
          <div className="control-group">
            <span className="group-label">Набор слов</span>
            <div className="segmented segmented-wrap">
              {sourceOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`vocab-source-${option.id}`}
                  className={preferences.source === option.id ? 'segmented-button is-active' : 'segmented-button'}
                  onClick={() => onPatchPreferences({ source: option.id })}
                >
                  {option.label}
                  {option.id === 'mine' ? ` (${myWordsCount})` : ''}
                  {option.id === 'list' ? ` (${trainingWordCount})` : ''}
                  {option.id === 'kanji' && selectedKanji.length ? ` (${selectedKanji.length})` : ''}
                </button>
              ))}
            </div>
          </div>

          {preferences.source === 'level' ? (
            <div className="control-group">
              <span className="group-label">Уровень JLPT</span>
              <div className="segmented">
                {JLPT_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    data-testid={`vocab-train-level-${level}`}
                    className={preferences.level === level ? 'segmented-button is-active' : 'segmented-button'}
                    onClick={() => onPatchPreferences({ level })}
                  >
                    N{level}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {preferences.source === 'group' ? (
            <div className="control-group">
              <span className="group-label">Группа</span>
              <div className="vocab-group-grid vocab-setup-groups">
                {VOCAB_GROUPS.map((group) => {
                  const remaining = group.wordIds.filter((id) => !mySet.has(id)).length
                  return (
                    <button
                      key={group.id}
                      type="button"
                      data-testid={`vocab-train-group-${group.id}`}
                      className={preferences.groupId === group.id ? 'vocab-group-card is-active' : 'vocab-group-card'}
                      onClick={() => onPatchPreferences({ groupId: group.id })}
                    >
                      <span className="vocab-group-label">{group.label}</span>
                      <span className="vocab-group-count">
                        {trainFullGroup ? group.wordIds.length : `${remaining}/${group.wordIds.length}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {preferences.source === 'kanji' ? (
            <div className="control-group" data-testid="vocab-kanji-picker">
              <span className="group-label">Кандзи для тренировки</span>
              <p className="control-hint">
                Слова идут по выбранным знакам по порядку: сначала все слова текущего кандзи, затем
                следующего. В тренировке «+ Слово из набора» добавляет в том же порядке.
              </p>
              {selectedKanji.length ? (
                <div className="vocab-selected-kanji" data-testid="vocab-selected-kanji">
                  {selectedKanji.map((character) => (
                    <button
                      key={character}
                      type="button"
                      className="vocab-kanji-chip is-active"
                      data-testid={`vocab-selected-kanji-${character}`}
                      onClick={() => toggleSelectedKanji(character)}
                      title="Убрать"
                    >
                      {character}
                      <span className="vocab-kanji-chip-count">{getPopularWordsForKanji(character).length}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-button"
                    data-testid="vocab-clear-selected-kanji"
                    onClick={() => onPatchPreferences({ selectedKanji: [] })}
                  >
                    Очистить
                  </button>
                </div>
              ) : (
                <p className="control-hint">Выберите знаки ниже или добавьте слова в «Набор» из карточек кандзи.</p>
              )}
              <div className="segmented">
                {JLPT_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    data-testid={`vocab-kanji-pick-level-${level}`}
                    className={kanjiPickLevel === level ? 'segmented-button is-active' : 'segmented-button'}
                    onClick={() => setKanjiPickLevel(level)}
                  >
                    N{level}
                  </button>
                ))}
              </div>
              <div className="vocab-kanji-pick-grid" role="list">
                {kanjiPickerItems.map((item) => (
                  <button
                    key={item.character}
                    type="button"
                    role="listitem"
                    data-testid={`vocab-kanji-pick-${item.character}`}
                    className={
                      selectedKanjiSet.has(item.character)
                        ? 'vocab-kanji-chip is-active'
                        : 'vocab-kanji-chip'
                    }
                    onClick={() => toggleSelectedKanji(item.character)}
                  >
                    {item.character}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {preferences.source === 'list' ? (
            <div className="control-group">
              <span className="group-label">Ваш набор</span>
              <p className="control-hint">
                {trainingWordCount
                  ? `${trainingWordCount} слов. Добавляйте слова из карточек кандзи или словаря («+ В набор»).`
                  : 'Набор пуст. Откройте карточку кандзи или словарь и нажмите «+ В набор».'}
              </p>
            </div>
          ) : null}

          {preferences.source === 'mine' ? (
            <div className="control-group">
              <span className="group-label">Состав «Моих слов»</span>
              <div className="segmented">
                <button
                  type="button"
                  data-testid="vocab-mine-scope-all"
                  className={preferences.mineIncludeLearned !== false ? 'segmented-button is-active' : 'segmented-button'}
                  onClick={() => onPatchPreferences({ mineIncludeLearned: true })}
                >
                  Все
                </button>
                <button
                  type="button"
                  data-testid="vocab-mine-scope-unlearned"
                  className={preferences.mineIncludeLearned === false ? 'segmented-button is-active' : 'segmented-button'}
                  onClick={() => onPatchPreferences({ mineIncludeLearned: false })}
                >
                  Только невыученные
                </button>
              </div>
              <p className="control-hint">
                Выученные помечаются флажком в разделе «Мои слова».
              </p>
            </div>
          ) : null}

          {showFullSetToggle && !temporaryPool ? (
            <div className="control-group">
              <label className="kanji-filter-toggle">
                <input
                  type="checkbox"
                  data-testid="vocab-train-full-group"
                  checked={trainFullGroup}
                  onChange={(event) => onPatchPreferences({ trainFullGroup: event.target.checked })}
                />
                Тренировать весь набор
              </label>
              <p className="control-hint">
                {trainFullGroup
                  ? 'В набор входят все слова, в том числе уже добавленные в «Мои слова».'
                  : 'По умолчанию — только слова, которых ещё нет в «Моих словах».'}
              </p>
            </div>
          ) : null}

          {showWordJlptFilter ? (
            <div className="control-group">
              <span className="group-label">Фильтр JLPT</span>
              <WordJlptFilter
                selected={preferences.wordJlptLevels ?? []}
                testIdPrefix="vocab-word-jlpt"
                onChange={(next) => onPatchPreferences({ wordJlptLevels: next })}
              />
              <p className="control-hint">Пусто / все уровни — без фильтра. Иначе только выбранные N-уровни.</p>
            </div>
          ) : null}
        </>
      )}

      {showNewWordLimit ? (
        <div className="control-group">
          <span className="group-label">Слов за раз</span>
          <label className="vocab-number-field">
            <input
              type="number"
              min={-1}
              max={50}
              data-testid="vocab-new-word-limit"
              value={newLimitDraft ?? String(newLimit)}
              onChange={(event) => {
                const raw = event.target.value
                setNewLimitDraft(raw)
                if (raw.trim() === '' || raw.trim() === '-') return
                const parsed = Number(raw)
                if (!Number.isFinite(parsed)) return
                const next = Math.min(50, Math.max(-1, Math.round(parsed)))
                onPatchPreferences({ newWordLimit: next })
                setNewLimitDraft(null)
              }}
              onBlur={() => {
                if (newLimitDraft === null) return
                const raw = newLimitDraft.trim()
                if (raw === '' || raw === '-') {
                  setNewLimitDraft(null)
                  return
                }
                const parsed = Number(raw)
                if (!Number.isFinite(parsed)) {
                  setNewLimitDraft(null)
                  return
                }
                onPatchPreferences({ newWordLimit: Math.min(50, Math.max(-1, Math.round(parsed))) })
                setNewLimitDraft(null)
              }}
            />
            <span>-1 = без лимита</span>
          </label>
          <p className="control-hint">
            В тренировке будет не больше указанного количества слов. -1 — без лимита.
          </p>
        </div>
      ) : null}

      <div className="control-group">
        <span className="group-label">Подбор</span>
        <div className="segmented">
          {pickOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`vocab-pick-${option.id}`}
              className={preferences.pickMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
              onClick={() => onPatchPreferences({ pickMode: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="control-hint">{pickOptions.find((item) => item.id === preferences.pickMode)?.hint}</p>
      </div>

      {preferences.drillMode === 'romaji' ? (
        <div className="control-group">
          <span className="group-label">Ввод</span>
          <div className="segmented">
            {inputModeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`vocab-input-${option.id}`}
                className={preferences.inputMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
                onClick={() => onPatchPreferences({ inputMode: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="control-hint">{inputModeOptions.find((item) => item.id === preferences.inputMode)?.hint}</p>
        </div>
      ) : null}

      <p className="control-hint" data-testid="vocab-pool-count">
        {poolCount === sourcePoolCount
          ? `${poolCount} слов в наборе`
          : `${poolCount} в тренировке из ${sourcePoolCount} в наборе`}
      </p>

      <div className="primary-actions">
        <button type="button" className="primary-button" data-testid="start-vocab" onClick={onStart}>
          Начать
        </button>
      </div>

      {errorText ? <p className="feedback is-error">{errorText}</p> : null}
      {infoText ? <p className="feedback is-success">{infoText}</p> : null}
    </section>
  )
}
