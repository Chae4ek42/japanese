import { useEffect, useMemo, useState } from 'react'
import type {
  MemoryState,
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
import { VocabCalibration } from './VocabCalibration'
import { VocabSetupPool } from './VocabSetupPool'

const sessionModeOptions: Array<{ id: VocabSessionMode; label: string; hint: string }> = [
  { id: 'drill', label: 'Обычная', hint: 'Свободный набор и подбор' },
  { id: 'srs', label: 'Интервальная', hint: 'Повторения по «Моим словам»' },
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

const pickOptions = [
  { id: 'adaptive' as const, label: 'Адаптивный' },
  { id: 'even' as const, label: 'Равномерный' },
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
  memory?: Record<string, MemoryState>
  reviewDayNewIntroduced?: number
  /** Preview for SRS: due / new / session size. */
  minePlanPreview?: { dueCount: number; newCount: number; sessionSize: number } | null
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
  memory = {},
  reviewDayNewIntroduced = 0,
  minePlanPreview = null,
  onPatchPreferences,
  onToggleExclude,
  onClearExcluded,
  onAddTrainingWords,
  onRemoveTrainingWords,
  onStart,
}: VocabSetupProps) {
  const isSrs = preferences.sessionMode === 'srs'
  const newLimit = preferences.newWordLimit ?? -1
  const [newLimitDraft, setNewLimitDraft] = useState<string | null>(null)
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
    !isSrs &&
    (preferences.source === 'group' ||
      preferences.source === 'kanji' ||
      preferences.source === 'list')

  const showNewWordLimit =
    !isSrs &&
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
    preferences.source === 'kanji' ||
    isSrs

  useEffect(() => {
    setNewLimitDraft(null)
  }, [newLimit])

  function setSessionMode(mode: VocabSessionMode) {
    if (mode === 'srs') {
      onPatchPreferences({ sessionMode: 'srs', source: 'mine' })
      return
    }
    onPatchPreferences({ sessionMode: 'drill' })
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

  return (
    <div className="vocab-setup-layout" data-testid="vocab-setup">
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
            {isSrs
              ? 'Интервальные повторения колоды «Мои слова» по дате добавления и удержанию.'
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

        {isSrs ? (
          <>
            <div className="control-group">
              <span className="group-label">Колода</span>
              <p className="control-hint" data-testid="vocab-srs-deck">
                Мои слова ({myWordsCount})
              </p>
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

            <div className="vocab-srs-settings" data-testid="vocab-srs-settings">
              <span className="group-label">Сессия</span>
              <div className="vocab-srs-settings-grid">
                <label className="vocab-srs-field">
                  <span className="vocab-srs-field-label">Длина</span>
                  <span className="vocab-srs-control">
                    <input
                      type="number"
                      min={5}
                      max={60}
                      data-testid="vocab-session-minutes"
                      value={preferences.sessionMinutes ?? 15}
                      onChange={(event) => {
                        const parsed = Number(event.target.value)
                        if (!Number.isFinite(parsed)) return
                        onPatchPreferences({
                          sessionMinutes: Math.min(60, Math.max(5, Math.round(parsed))),
                        })
                      }}
                    />
                    <span className="vocab-srs-unit">мин</span>
                  </span>
                  <span className="control-hint">оценка объёма сессии</span>
                </label>

                <label className="vocab-srs-field">
                  <span className="vocab-srs-field-label">Новых в день</span>
                  <span className="vocab-srs-control">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      data-testid="vocab-new-per-day"
                      value={preferences.newPerDay ?? 10}
                      onChange={(event) => {
                        const parsed = Number(event.target.value)
                        if (!Number.isFinite(parsed)) return
                        onPatchPreferences({
                          newPerDay: Math.min(50, Math.max(0, Math.round(parsed))),
                        })
                      }}
                    />
                    <span className="vocab-srs-unit">слов</span>
                  </span>
                  <span className="control-hint">
                    {reviewDayNewIntroduced > 0
                      ? `сегодня уже ${reviewDayNewIntroduced}`
                      : 'очередь от даты добавления'}
                  </span>
                </label>
              </div>
            </div>

            <p className="control-hint" data-testid="vocab-pool-count">
              {minePlanPreview
                ? `Сегодня: ${minePlanPreview.dueCount} к повторению, ${minePlanPreview.newCount} новых → ${minePlanPreview.sessionSize} в сессии (${sourcePoolCount} в колоде)`
                : `${sourcePoolCount} слов в колоде`}
              {excludedIds.size ? ` · исключено ${excludedIds.size}` : ''}
            </p>
          </>
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

          {isSrs ? (
            <div className="vocab-srs-field vocab-srs-field-wide">
              <div className="vocab-srs-retention-head">
                <span className="vocab-srs-field-label">Удержание</span>
                <span className="vocab-srs-retention-value" data-testid="vocab-target-retention-value">
                  {Math.round((preferences.targetRetention ?? 0.9) * 100)}%
                </span>
              </div>
              <div className="vocab-srs-retention" role="group" aria-label="Целевое удержание">
                <input
                  type="range"
                  min={85}
                  max={95}
                  step={1}
                  list="vocab-retention-ticks"
                  data-testid="vocab-target-retention"
                  value={Math.round((preferences.targetRetention ?? 0.9) * 100)}
                  onChange={(event) =>
                    onPatchPreferences({
                      targetRetention: Number(event.target.value) / 100,
                    })
                  }
                />
                <datalist id="vocab-retention-ticks">
                  <option value="85" />
                  <option value="90" />
                  <option value="95" />
                </datalist>
                <div className="vocab-srs-retention-presets">
                  {(
                    [
                      { value: 0.85, label: '85%', hint: 'Реже' },
                      { value: 0.9, label: '90%', hint: 'Баланс' },
                      { value: 0.95, label: '95%', hint: 'Чаще' },
                    ] as const
                  ).map((option) => {
                    const active =
                      Math.round((preferences.targetRetention ?? 0.9) * 100) ===
                      Math.round(option.value * 100)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`vocab-retention-${Math.round(option.value * 100)}`}
                        className={
                          active
                            ? 'vocab-srs-retention-preset is-active'
                            : 'vocab-srs-retention-preset'
                        }
                        onClick={() => onPatchPreferences({ targetRetention: option.value })}
                      >
                        <span className="vocab-srs-retention-preset-label">{option.label}</span>
                        <span className="vocab-srs-retention-preset-hint">{option.hint}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="control-hint vocab-srs-retention-hint">
                  {(preferences.targetRetention ?? 0.9) >= 0.93
                    ? 'Карточки due раньше — больше повторений, меньше забывания.'
                    : (preferences.targetRetention ?? 0.9) <= 0.87
                      ? 'Карточки due позже — меньше нагрузки, выше риск забыть.'
                      : 'Баланс между частотой повторов и объёмом сессии.'}
                </p>
              </div>
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
            </div>
          ) : null}

          <div className="control-group">
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
          </div>

          {!isSrs ? (
            <>
              <div className="control-group">
                <span className="group-label">Подбор</span>
                <div className="segmented">
                  {pickOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={`vocab-pick-${option.id}`}
                      className={
                        preferences.pickMode === option.id
                          ? 'segmented-button is-active'
                          : 'segmented-button'
                      }
                      onClick={() => onPatchPreferences({ pickMode: option.id })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {preferences.pickMode === 'even' ? (
                <div className="vocab-srs-settings" data-testid="vocab-even-settings">
                  <span className="group-label">Равномерный режим</span>
                  <div className="vocab-srs-settings-grid">
                    <label className="vocab-srs-field">
                      <span className="vocab-srs-field-label">Повышенный вес</span>
                      <span className="vocab-srs-control">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          data-testid="vocab-even-boost-shows"
                          value={preferences.evenBoostShows ?? 3}
                          onChange={(event) => {
                            const parsed = Number(event.target.value)
                            if (!Number.isFinite(parsed)) return
                            onPatchPreferences({
                              evenBoostShows: Math.min(20, Math.max(0, Math.round(parsed))),
                            })
                          }}
                        />
                        <span className="vocab-srs-unit">показов</span>
                      </span>
                      <span className="control-hint">первые N показов слова в сессии</span>
                    </label>

                    <label className="vocab-srs-field">
                      <span className="vocab-srs-field-label">Множитель</span>
                      <span className="vocab-srs-control">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          step={0.5}
                          data-testid="vocab-even-boost-factor"
                          value={preferences.evenBoostFactor ?? 2}
                          onChange={(event) => {
                            const parsed = Number(event.target.value)
                            if (!Number.isFinite(parsed)) return
                            onPatchPreferences({
                              evenBoostFactor: Math.min(10, Math.max(1, parsed)),
                            })
                          }}
                        />
                        <span className="vocab-srs-unit">×</span>
                      </span>
                      <span className="control-hint">во сколько раз сильнее вес</span>
                    </label>

                    <label className="vocab-srs-field vocab-srs-field-wide">
                      <span className="vocab-srs-field-label">Сила выравнивания</span>
                      <span className="vocab-srs-control">
                        <input
                          type="number"
                          min={1}
                          max={4}
                          step={0.5}
                          data-testid="vocab-even-decay-power"
                          value={preferences.evenDecayPower ?? 2}
                          onChange={(event) => {
                            const parsed = Number(event.target.value)
                            if (!Number.isFinite(parsed)) return
                            onPatchPreferences({
                              evenDecayPower: Math.min(4, Math.max(1, parsed)),
                            })
                          }}
                        />
                        <span className="vocab-srs-unit">степень</span>
                      </span>
                      <span className="control-hint">вес ≈ 1 / (1 + показы)^степень</span>
                    </label>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

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
            disabled={
              isSrs
                ? (minePlanPreview?.sessionSize ?? includedCount) <= 0
                : includedCount <= 0
            }
          >
            Начать
          </button>
        </div>

        {errorText ? <p className="feedback is-error">{errorText}</p> : null}
        {infoText ? <p className="feedback is-success">{infoText}</p> : null}

        {isSrs ? (
          <VocabCalibration
            memory={memory}
            targetRetention={preferences.targetRetention ?? 0.9}
          />
        ) : null}
      </section>

      <VocabSetupPool
        cards={poolCards}
        excludedIds={excludedIds}
        onToggleExclude={onToggleExclude}
        onClearExcluded={onClearExcluded}
      />
    </div>
  )
}
