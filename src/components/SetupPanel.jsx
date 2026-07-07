import { GROUP_PRESETS, KANA_GROUPS } from '../data/kana'
import { DEFAULT_HYPERPARAMS } from '../lib/trainer'

const scriptOptions = [
  { id: 'hiragana', label: 'Хирагана' },
  { id: 'katakana', label: 'Катакана' },
  { id: 'both', label: 'Обе' },
]

const inputModeOptions = [
  {
    id: 'instant',
    label: 'Автозачет',
    hint: 'Ответ принимается сразу, как только введен. Ошибка — на первой неверной букве.',
  },
  {
    id: 'submit',
    label: 'По Enter',
    hint: 'Ответ отправляется клавишей Enter. При ошибке покажем правильный вариант.',
  },
]

const modeOptions = [
  { id: 'adaptive', label: 'Адаптивный', hint: 'Чаще слабые, медленные и новые знаки; после ошибки подтягивает похожие (シ/ツ, ぬ/め…)' },
  { id: 'even', label: 'Равномерный', hint: 'Все знаки с одинаковой частотой' },
  { id: 'problem', label: 'Проблемные', hint: 'Только то, что западает' },
]

const settingsFields = [
  { id: 'retireStreak', label: 'Серия до выученного', min: 3, max: 12, step: 1, hint: 'Сколько чистых ответов подряд, чтобы знак считался выученным и выпадал реже.' },
  { id: 'recentMistakeBoost', label: 'Приоритет ошибок', min: 1, max: 5, step: 0.1, hint: 'Насколько чаще показывать знаки с недавними ошибками.' },
  { id: 'targetLatencySec', label: 'Целевое время, сек', min: 1, max: 10, step: 0.5, hint: 'Ответы медленнее этого времени поднимают знак в очереди.' },
  { id: 'confusionBoost', label: 'Тренировка двойников', min: 1, max: 4, step: 0.1, hint: 'После ошибки чаще показывать визуально похожие знаки.' },
]

export function SetupPanel({
  errorText,
  onApplyGroups,
  onPatchHyperparam,
  onPatchPreferences,
  onStart,
  onToggleFineTuning,
  onToggleGroup,
  preferences,
  showFineTuning,
}) {
  const activeInputMode = inputModeOptions.find((option) => option.id === preferences.inputMode)

  function getFieldValue(fieldId) {
    if (fieldId === 'targetLatencySec') {
      return preferences.hyperparams.targetLatencyMs / 1000
    }
    return preferences.hyperparams[fieldId]
  }

  function setFieldValue(fieldId, rawValue) {
    const value = Number(rawValue)
    if (Number.isNaN(value)) {
      return
    }
    if (fieldId === 'targetLatencySec') {
      onPatchHyperparam('targetLatencyMs', Math.round(value * 1000))
      return
    }
    onPatchHyperparam(fieldId, value)
  }

  return (
    <section className="panel controls-panel">
      <div className="section-heading">
        <h2>Набор</h2>
      </div>

      <div className="control-group">
        <span className="group-label">Азбука</span>
        <div className="segmented">
          {scriptOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`script-${option.id}`}
              className={preferences.scriptMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
              onClick={() => onPatchPreferences({ scriptMode: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <div className="row-heading">
          <span className="group-label">Столбцы</span>
          <div className="inline-actions">
            <button
              type="button"
              className="text-button"
              data-testid="select-all"
              onClick={() => onApplyGroups(KANA_GROUPS.map((group) => group.id))}
            >
              Все
            </button>
            {GROUP_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="text-button"
                data-testid={`preset-${preset.id}`}
                onClick={() => onApplyGroups(preset.groups)}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className="text-button" data-testid="clear-selection" onClick={() => onApplyGroups([])}>
              Ничего
            </button>
          </div>
        </div>

        <div className="selection-board-wrap">
          <div className="selection-board" role="grid" aria-label="Выбор слогов">
            <div className="row-label placeholder-cell"></div>
            {KANA_GROUPS.map((group) => {
              const selected = preferences.selectedGroups.includes(group.id)
              return (
                <button
                  key={group.id}
                  type="button"
                  data-testid={`group-toggle-${group.id}`}
                  className={selected ? 'column-toggle is-active' : 'column-toggle'}
                  onClick={() => onToggleGroup(group.id)}
                >
                  {group.shortLabel}
                </button>
              )
            })}

            {['a', 'i', 'u', 'e', 'o', 'n'].map((slot) => (
              <SelectionRow
                key={slot}
                slot={slot}
                scriptMode={preferences.scriptMode}
                selectedGroups={preferences.selectedGroups}
                onToggle={onToggleGroup}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="control-group">
        <span className="group-label">Ввод</span>
        <div className="segmented">
          {inputModeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`input-mode-${option.id}`}
              className={preferences.inputMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
              onClick={() => onPatchPreferences({ inputMode: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="control-hint">{activeInputMode?.hint}</p>
      </div>

      <div className="control-group">
        <span className="group-label">Режим</span>
        <div className="mode-list">
          {modeOptions.map((mode) => (
            <button
              key={mode.id}
              type="button"
              data-testid={`mode-${mode.id}`}
              className={preferences.mode === mode.id ? 'mode-card is-active' : 'mode-card'}
              onClick={() => onPatchPreferences({ mode: mode.id })}
            >
              <strong>{mode.label}</strong>
              <small>{mode.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="control-row control-row-compact">
        <button type="button" className="text-button settings-toggle" onClick={onToggleFineTuning}>
          {showFineTuning ? 'Скрыть настройку' : 'Тонкая настройка'}
        </button>

        <label className="toggle-option">
          <input
            type="checkbox"
            checked={preferences.retryQueueEnabled}
            onChange={(event) => onPatchPreferences({ retryQueueEnabled: event.target.checked })}
          />
          <span>Возвращать ошибки через пару карточек</span>
        </label>
      </div>

      {showFineTuning ? (
        <div className="settings-grid">
          {settingsFields.map((field) => (
            <label key={field.id} className="setting-card">
              <span>{field.label}</span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={getFieldValue(field.id)}
                onChange={(event) => setFieldValue(field.id, event.target.value)}
              />
              <small>{field.hint}</small>
            </label>
          ))}
          <button
            type="button"
            className="ghost-button"
            onClick={() => onPatchPreferences({ hyperparams: { ...DEFAULT_HYPERPARAMS } })}
          >
            Сбросить настройки
          </button>
        </div>
      ) : null}

      <div className="primary-actions">
        <button type="button" className="primary-button" onClick={onStart}>
          <span data-testid="start-practice">Практиковаться</span>
        </button>
      </div>

      {errorText ? <p className="feedback is-error">{errorText}</p> : null}
    </section>
  )
}

function SelectionRow({ onToggle, scriptMode, selectedGroups, slot }) {
  return (
    <>
      <div className="row-label">{slot.toUpperCase()}</div>
      {KANA_GROUPS.map((group) => {
        const selected = selectedGroups.includes(group.id)
        const cell = group.entries.find((entry) => entry.slot === slot)
        const preview = cell ? getCellPreview(cell, scriptMode) : '—'
        return (
          <button
            key={`${group.id}-${slot}`}
            type="button"
            className={selected ? 'selection-cell is-active' : 'selection-cell'}
            onClick={() => onToggle(group.id)}
            disabled={!cell}
          >
            {cell ? (
              <>
                <span className="cell-kana">{preview}</span>
                <span className="cell-romaji">{cell.primaryAnswer}</span>
              </>
            ) : (
              <span className="cell-empty">—</span>
            )}
          </button>
        )
      })}
    </>
  )
}

function getCellPreview(entry, scriptMode) {
  if (scriptMode === 'hiragana') {
    return entry.hiragana
  }

  if (scriptMode === 'katakana') {
    return entry.katakana
  }

  return `${entry.hiragana} / ${entry.katakana}`
}
