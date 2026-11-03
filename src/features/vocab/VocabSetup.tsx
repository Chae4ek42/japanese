import { useEffect, useMemo, useState } from 'react'
import type {
  VocabCard,
  VocabLevelFilter,
  VocabPreferences,
  VocabSessionMode,
  VocabTrainingSet,
} from '../../shared/lib/types'
import {
  MAIN_TRAINING_SET_ID,
  getTrainingSet,
  resolveActiveTrainingSetId,
} from '../../shared/lib/trainingSets'
import { TrainingSetPicker } from '../../shared/ui/TrainingSetPicker'
import { getKanjiByLevel, getPopularWordsForKanji } from '../../data/words/bank'
import { WordJlptFilter } from '../kanji/WordJlptFilter'
import '../kanji/styles.css'
import {
  VOCAB_GROUPS,
  collectGroupTrainingIds,
  getVocabGroup,
  getVocabGroupsByKind,
} from './groups'
import { VocabSetupPool } from './VocabSetupPool'

const sessionModeOptions: Array<{ id: VocabSessionMode; label: string; hint: string }> = [
  { id: 'drill', label: 'Равномерная', hint: 'Свободная тренировка выбранного набора' },
  { id: 'adaptive', label: 'Повторение', hint: 'Небольшое окно слов с постепенным обновлением' },
]

const drillOptions = [
  { id: 'romaji' as const, label: 'Ромадзи' },
  { id: 'choice' as const, label: 'Перевод' },
  { id: 'mixed' as const, label: 'Смешанный' },
]

const sourceOptions = [
  { id: 'level' as const, label: 'По уровню' },
  { id: 'group' as const, label: 'По группе' },
  { id: 'kanji' as const, label: 'По кандзи' },
  { id: 'list' as const, label: 'Набор' },
  { id: 'problem' as const, label: 'Проблемные' },
  { id: 'mine' as const, label: 'Мои слова' },
]

const inputModeOptions = [
  { id: 'instant' as const, label: 'Автозачёт' },
  { id: 'submit' as const, label: 'По Enter' },
]

const JLPT_LEVELS: VocabLevelFilter[] = [5, 4, 3, 2, 1]

export interface VocabSetupProps {
  preferences: VocabPreferences
  poolCards: VocabCard[]
  poolCount: number
  sourcePoolCount: number
  myWordsCount: number
  myWordIds?: string[]
  trainingWordCount?: number
  /** Active set (bulk «в набор» from groups). */
  trainingWordIds?: string[]
  /** Words in the selected list-source set. */
  listTrainingWordIds?: string[]
  trainingSets?: VocabTrainingSet[]
  problemWordCount?: number
  excludedIds: Set<string>
  errorText?: string
  infoText?: string
  onPatchPreferences: (patch: Partial<VocabPreferences>) => void
  onToggleExclude: (cardId: string) => void
  onClearExcluded: () => void
  onAddTrainingWords?: (wordIds: string[]) => void
  onRemoveTrainingWords?: (wordIds: string[]) => void
  onStart: () => void
}

export function VocabSetup({
  preferences,
  poolCards,
  poolCount,
  sourcePoolCount,
  myWordsCount,
  myWordIds = [],
  trainingWordCount = 0,
  trainingWordIds = [],
  listTrainingWordIds,
  trainingSets = [],
  problemWordCount = 0,
  excludedIds,
  errorText = '',
  infoText = '',
  onPatchPreferences,
  onToggleExclude,
  onClearExcluded,
  onAddTrainingWords,
  onRemoveTrainingWords,
  onStart,
}: VocabSetupProps) {
  const isAdaptive = preferences.sessionMode === 'adaptive'
  const newLimit = preferences.newWordLimit ?? -1
  const [newLimitDraft, setNewLimitDraft] = useState<string | null>(null)
  const [reviewWindowDraft, setReviewWindowDraft] = useState<string | null>(null)
  const [kanjiPickLevel, setKanjiPickLevel] = useState<VocabLevelFilter>(5)
  const mySet = useMemo(() => new Set(myWordIds), [myWordIds])
  const trainingSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])
  const listSetId = resolveActiveTrainingSetId(preferences.trainingSetId, trainingSets)
  const listSet = getTrainingSet(trainingSets, listSetId)
  const listCount = listTrainingWordIds?.length ?? listSet?.wordIds.length ?? trainingWordCount
  const readingGroups = useMemo(() => getVocabGroupsByKind('reading'), [])
  const themeGroups = useMemo(() => getVocabGroupsByKind('theme'), [])
  const activeGroup = useMemo(
    () => getVocabGroup(preferences.groupId) ?? VOCAB_GROUPS[0] ?? null,
    [preferences.groupId],
  )
  const trainFullGroup = preferences.trainFullGroup === true
  const selectedKanji = preferences.selectedKanji ?? []
  const selectedKanjiSet = useMemo(() => new Set(selectedKanji), [selectedKanji])
  const kanjiPickerItems = useMemo(() => getKanjiByLevel(kanjiPickLevel), [kanjiPickLevel])
  const activeGroupTrainingIds = useMemo(
    () => (activeGroup ? collectGroupTrainingIds(activeGroup) : []),
    [activeGroup],
  )
  const activeGroupInTraining = useMemo(
    () => activeGroupTrainingIds.filter((id) => trainingSet.has(id)).length,
    [activeGroupTrainingIds, trainingSet],
  )
  const activeGroupFullyInTraining =
    activeGroupTrainingIds.length > 0 && activeGroupInTraining >= activeGroupTrainingIds.length

  const showFullSetToggle =
    (preferences.source === 'group' ||
      preferences.source === 'kanji' ||
      preferences.source === 'list')

  const showNewWordLimit =
    preferences.source !== 'mine' &&
    !(
      (preferences.source === 'group' ||
        preferences.source === 'kanji' ||
        preferences.source === 'list') &&
      trainFullGroup
    )

  const showWordJlptFilter =
    preferences.source === 'group' ||
    preferences.source === 'mine' ||
    preferences.source === 'kanji'

  useEffect(() => {
    setNewLimitDraft(null)
  }, [newLimit])

  function setSessionMode(mode: VocabSessionMode) {
    if (mode === 'adaptive') {
      onPatchPreferences({ sessionMode: mode, source: 'mine', pickMode: 'adaptive' })
      return
    }
    onPatchPreferences({ sessionMode: 'drill', pickMode: 'even' })
  }

  function toggleSelectedKanji(character: string) {
    if (selectedKanjiSet.has(character)) {
      onPatchPreferences({
        selectedKanji: selectedKanji.filter((item) => item !== character),
      })
      return
    }
    onPatchPreferences({ selectedKanji: [...selectedKanji, character] })
  }

  const includedCount = poolCards.filter((card) => !excludedIds.has(card.id)).length
  const startCount = isAdaptive ? sourcePoolCount : includedCount

  return (
    <div className={`vocab-setup-layout${isAdaptive ? ' is-adaptive' : ''}`} data-testid="vocab-setup">
      <section className="panel controls-panel setup-surface vocab-setup">
        <div className="control-group">
          <span className="group-label">Режим</span>
          <div className="segmented segmented-wrap" role="group" aria-label="Режим тренировки">
            {sessionModeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`vocab-session-mode-${option.id}`}
                className={
                  preferences.sessionMode === option.id
                    ? 'segmented-button is-active'
                    : 'segmented-button'
                }
                title={option.hint}
                onClick={() => setSessionMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="control-hint">
            {isAdaptive
              ? 'Слабые слова повторяются чаще, знакомые — реже. Новые постепенно входят в окно.'
              : 'Свободная тренировка любого набора без дневной квоты.'}
          </p>
        </div>

        <div className="control-group">
          <span className="group-label">Тип ответа</span>
          <div className="segmented">
            {drillOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`vocab-drill-${option.id}`}
                className={
                  preferences.drillMode === option.id ? 'segmented-button is-active' : 'segmented-button'
                }
                onClick={() => onPatchPreferences({ drillMode: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isAdaptive ? (
          <div className="control-group" data-testid="vocab-adaptive-deck">
            <div className="segmented" role="group" aria-label="Слова для повторения">
              <button type="button" className={preferences.reviewScope !== 'problem' ? 'segmented-button is-active' : 'segmented-button'} data-testid="vocab-review-all" onClick={() => onPatchPreferences({ reviewScope: 'all' })}>Все мои слова</button>
              <button type="button" className={preferences.reviewScope === 'problem' ? 'segmented-button is-active' : 'segmented-button'} data-testid="vocab-review-problem" onClick={() => onPatchPreferences({ reviewScope: 'problem' })}>Проблемные</button>
            </div>
            <div className="vocab-review-controls">
              <label>Размер окна<input type="number" min={3} max={20} value={reviewWindowDraft ?? String(preferences.reviewWindowSize ?? 5)} data-testid="vocab-review-window" onChange={(event) => { const raw = event.target.value; setReviewWindowDraft(raw); const value = Number(raw); if (raw.trim() && Number.isFinite(value) && value >= 3 && value <= 20) onPatchPreferences({ reviewWindowSize: Math.round(value) }) }} onBlur={() => { if (reviewWindowDraft?.trim()) { const value = Number(reviewWindowDraft); if (Number.isFinite(value)) onPatchPreferences({ reviewWindowSize: Math.max(3, Math.min(20, Math.round(value))) }) } setReviewWindowDraft(null) }} /></label>
              {preferences.reviewScope === 'problem' ? <label>Самых проблемных<input type="number" min={0} max={10000} value={preferences.reviewProblemLimit ?? 0} data-testid="vocab-review-problem-limit" onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) onPatchPreferences({ reviewProblemLimit: Math.max(0, Math.min(10000, Math.round(value))) }) }} /><span className="control-hint">0 — все подходящие</span></label> : null}
            </div>
            <p className="control-hint">{sourcePoolCount} слов{preferences.reviewScope === 'problem' ? ' · минимум 5 ответов, приоритет последних ошибок' : ', включая отмеченные выученными'}.</p>
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
                    className={
                      preferences.source === option.id
                        ? 'segmented-button is-active'
                        : 'segmented-button'
                    }
                    onClick={() => onPatchPreferences({ source: option.id })}
                  >
                    {option.label}
                    {option.id === 'mine' ? ` (${myWordsCount})` : ''}
                    {option.id === 'list' ? ` (${listCount})` : ''}
                    {option.id === 'problem' ? ` (${problemWordCount})` : ''}
                    {option.id === 'kanji' && selectedKanji.length
                      ? ` (${selectedKanji.length})`
                      : ''}
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
                      className={
                        preferences.level === level
                          ? 'segmented-button is-active'
                          : 'segmented-button'
                      }
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
                {[
                  { title: 'Чтение', groups: readingGroups },
                  { title: 'Темы', groups: themeGroups },
                ].map((section) =>
                  section.groups.length ? (
                    <div key={section.title} className="vocab-group-section">
                      <p className="vocab-group-section-label">{section.title}</p>
                      <div className="vocab-group-grid vocab-setup-groups">
                        {section.groups.map((group) => {
                          const remaining = group.wordIds.filter((id) => !mySet.has(id)).length
                          return (
                            <button
                              key={group.id}
                              type="button"
                              data-testid={`vocab-train-group-${group.id}`}
                              title={group.description || group.label}
                              className={
                                preferences.groupId === group.id
                                  ? 'vocab-group-card is-active'
                                  : 'vocab-group-card'
                              }
                              onClick={() => onPatchPreferences({ groupId: group.id })}
                            >
                              <span className="vocab-group-label">{group.label}</span>
                              <span className="vocab-group-count">
                                {trainFullGroup
                                  ? group.wordIds.length
                                  : `${remaining}/${group.wordIds.length}`}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
                {activeGroup && onAddTrainingWords && onRemoveTrainingWords ? (
                  <button
                    type="button"
                    className={
                      activeGroupFullyInTraining
                        ? 'vocab-group-bulk-button is-in-set'
                        : 'vocab-group-bulk-button'
                    }
                    data-testid="vocab-setup-group-add-all"
                    onClick={() => {
                      if (activeGroupFullyInTraining) {
                        onRemoveTrainingWords(activeGroupTrainingIds)
                        return
                      }
                      const missing = activeGroupTrainingIds.filter((id) => !trainingSet.has(id))
                      onAddTrainingWords(missing.length ? missing : activeGroupTrainingIds)
                    }}
                  >
                    {activeGroupFullyInTraining
                      ? 'Убрать группу из набора'
                      : activeGroupInTraining
                        ? `Добавить остаток в набор (${activeGroupTrainingIds.length - activeGroupInTraining})`
                        : 'Всю группу в набор'}
                  </button>
                ) : null}
              </div>
            ) : null}

            {preferences.source === 'kanji' ? (
              <div className="control-group" data-testid="vocab-kanji-picker">
                <span className="group-label">Кандзи для тренировки</span>
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
                        <span className="vocab-kanji-chip-count">
                          {getPopularWordsForKanji(character).length}
                        </span>
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
                  <p className="control-hint">Выберите знаки ниже</p>
                )}
                <div className="segmented">
                  {JLPT_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      data-testid={`vocab-kanji-pick-level-${level}`}
                      className={
                        kanjiPickLevel === level ? 'segmented-button is-active' : 'segmented-button'
                      }
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
                <span className="group-label">Набор для тренировки</span>
                <TrainingSetPicker
                  sets={trainingSets}
                  value={listSetId}
                  testId="vocab-training-set-select"
                  onChange={(setId) =>
                    onPatchPreferences({
                      trainingSetId: setId || MAIN_TRAINING_SET_ID,
                    })
                  }
                />
                <p className="control-hint" data-testid="vocab-list-count">
                  {listCount ? `${listCount} слов в выбранном наборе` : 'Набор пуст'}
                </p>
              </div>
            ) : null}

            {preferences.source === 'problem' ? (
              <div className="control-group">
                <span className="group-label">Проблемные слова</span>
                <p className="control-hint" data-testid="vocab-problem-count">
                  {problemWordCount
                    ? `${problemWordCount} слов — по последним 15 ответам ошибки чаще чем 1 к 2`
                    : 'Пока пусто — слова появятся после ошибок в тренировке'}
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
                    className={
                      preferences.mineIncludeLearned !== false
                        ? 'segmented-button is-active'
                        : 'segmented-button'
                    }
                    onClick={() => onPatchPreferences({ mineIncludeLearned: true })}
                  >
                    Все
                  </button>
                  <button
                    type="button"
                    data-testid="vocab-mine-scope-unlearned"
                    className={
                      preferences.mineIncludeLearned === false
                        ? 'segmented-button is-active'
                        : 'segmented-button'
                    }
                    onClick={() => onPatchPreferences({ mineIncludeLearned: false })}
                  >
                    Только невыученные
                  </button>
                </div>
              </div>
            ) : null}

            {showFullSetToggle ? (
              <div className="control-group">
                <label className="kanji-filter-toggle">
                  <input
                    type="checkbox"
                    data-testid="vocab-train-full-group"
                    checked={trainFullGroup}
                    onChange={(event) =>
                      onPatchPreferences({ trainFullGroup: event.target.checked })
                    }
                  />
                  Тренировать весь набор
                </label>
              </div>
            ) : null}

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
                      onPatchPreferences({
                        newWordLimit: Math.min(50, Math.max(-1, Math.round(parsed))),
                      })
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
                      onPatchPreferences({
                        newWordLimit: Math.min(50, Math.max(-1, Math.round(parsed))),
                      })
                      setNewLimitDraft(null)
                    }}
                  />
                  <span>-1 = без лимита; расширяйте набор кнопкой «+ слово»</span>
                </label>
              </div>
            ) : null}

            <p className="control-hint" data-testid="vocab-pool-count">
              {poolCount === sourcePoolCount
                ? `${sourcePoolCount} слов по критериям`
                : `${poolCount} к старту из ${sourcePoolCount} по критериям`}
              {excludedIds.size ? ` · исключено ${excludedIds.size}` : ''}
            </p>
          </>
        )}

        <details className="vocab-setup-more" data-testid="vocab-setup-more">
          <summary data-testid="vocab-setup-more-toggle">Ещё настройки</summary>

          {!isAdaptive && showWordJlptFilter ? (
            <div className="control-group">
              <span className="group-label">Фильтр JLPT</span>
              <WordJlptFilter
                selected={preferences.wordJlptLevels ?? []}
                testIdPrefix="vocab-word-jlpt"
                onChange={(next) => onPatchPreferences({ wordJlptLevels: next })}
              />
            </div>
          ) : null}

          {!isAdaptive ? <div className="control-group">
            <span className="group-label">Разговорные</span>
            <div className="segmented-control" role="group" aria-label="Тренировать разговорные слова">
              <button
                type="button"
                data-testid="vocab-include-colloquial-on"
                className={
                  preferences.includeColloquial !== false
                    ? 'segmented-button is-active'
                    : 'segmented-button'
                }
                onClick={() => onPatchPreferences({ includeColloquial: true })}
              >
                Включать
              </button>
              <button
                type="button"
                data-testid="vocab-include-colloquial-off"
                className={
                  preferences.includeColloquial === false
                    ? 'segmented-button is-active'
                    : 'segmented-button'
                }
                onClick={() => onPatchPreferences({ includeColloquial: false })}
              >
                Исключать
              </button>
            </div>
            <span className="control-hint">слова с пометой (разг.) / (прост.)</span>
          </div> : null}

          {preferences.drillMode === 'romaji' ? (
            <div className="control-group">
              <span className="group-label">Ввод</span>
              <div className="segmented">
                {inputModeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`vocab-input-${option.id}`}
                    className={
                      preferences.inputMode === option.id
                        ? 'segmented-button is-active'
                        : 'segmented-button'
                    }
                    onClick={() => onPatchPreferences({ inputMode: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </details>

        <div className="primary-actions">
          <button
            type="button"
            className="primary-button"
            data-testid="start-vocab"
            onClick={onStart}
            disabled={startCount <= 0}
          >
            Начать
          </button>
        </div>

        {errorText ? <p className="feedback is-error">{errorText}</p> : null}
        {infoText ? <p className="feedback is-success">{infoText}</p> : null}

      </section>

      {!isAdaptive ? <VocabSetupPool
        cards={poolCards}
        excludedIds={excludedIds}
        onToggleExclude={onToggleExclude}
        onClearExcluded={onClearExcluded}
      /> : null}
    </div>
  )
}
