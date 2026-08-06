import { useEffect, useMemo, useState } from 'react'
import type {
  MemoryState,
  VocabCard,
  VocabLevelFilter,
  VocabPreferences,
  VocabSessionMode,
} from '../../shared/lib/types'
import { getKanjiByLevel, getPopularWordsForKanji } from '../../data/words/bank'
import { WordJlptFilter } from '../kanji/WordJlptFilter'
import '../kanji/styles.css'
import { VOCAB_GROUPS } from './groups'
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
  onStart,
}: VocabSetupProps) {
  const isSrs = preferences.sessionMode === 'srs'
  const newLimit = preferences.newWordLimit ?? -1
  const [newLimitDraft, setNewLimitDraft] = useState<string | null>(null)
  const [kanjiPickLevel, setKanjiPickLevel] = useState<VocabLevelFilter>(5)
  const mySet = useMemo(() => new Set(myWordIds), [myWordIds])
  const trainFullGroup = preferences.trainFullGroup === true
  const selectedKanji = preferences.selectedKanji ?? []
  const selectedKanjiSet = useMemo(() => new Set(selectedKanji), [selectedKanji])
  const kanjiPickerItems = useMemo(() => getKanjiByLevel(kanjiPickLevel), [kanjiPickLevel])

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

            <div className="vocab-srs-settings" data-testid="vocab-srs-settings">
              <span className="group-label">Сессия</span>
              <div className="vocab-srs-settings-grid">
                <label className="vocab-srs-field">
                  <span className="vocab-srs-field-label">Длина</span>
                  <span className="vocab-number-field">
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
                    <span>мин</span>
                  </span>
                </label>

                <label className="vocab-srs-field">
                  <span className="vocab-srs-field-label">Новых в день</span>
                  <span className="vocab-number-field">
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
                    <span>слов</span>
                  </span>
                  {reviewDayNewIntroduced > 0 ? (
                    <span className="control-hint">сегодня уже {reviewDayNewIntroduced}</span>
                  ) : (
                    <span className="control-hint">очередь от даты добавления</span>
                  )}
                </label>

                <label className="vocab-srs-field vocab-srs-field-wide">
                  <span className="vocab-srs-field-label">Удержание</span>
                  <span className="vocab-number-field vocab-srs-retention">
                    <input
                      type="range"
                      min={85}
                      max={95}
                      step={1}
                      data-testid="vocab-target-retention"
                      value={Math.round((preferences.targetRetention ?? 0.9) * 100)}
                      onChange={(event) =>
                        onPatchPreferences({
                          targetRetention: Number(event.target.value) / 100,
                        })
                      }
                    />
                    <span>{Math.round((preferences.targetRetention ?? 0.9) * 100)}%</span>
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
                    {option.id === 'list' ? ` (${trainingWordCount})` : ''}
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
                <div className="vocab-group-grid vocab-setup-groups">
                  {VOCAB_GROUPS.map((group) => {
                    const remaining = group.wordIds.filter((id) => !mySet.has(id)).length
                    return (
                      <button
                        key={group.id}
                        type="button"
                        data-testid={`vocab-train-group-${group.id}`}
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
                <span className="group-label">Ваш набор</span>
                <p className="control-hint" data-testid="vocab-list-count">
                  {trainingWordCount ? `${trainingWordCount} слов` : 'Набор пуст'}
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

            <p className="control-hint" data-testid="vocab-pool-count">
              {poolCount === sourcePoolCount
                ? `${sourcePoolCount} слов по критериям`
                : `${poolCount} к старту из ${sourcePoolCount} по критериям`}
              {excludedIds.size ? ` · исключено ${excludedIds.size}` : ''}
            </p>
          </>
        )}

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
