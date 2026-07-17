import type { Hyperparams, InputMode, KanaEntry, KanaPickMode, ScriptMode } from '../../shared/lib/types'
import type { SetupPanelProps, SelectionRowProps } from '../../shared/lib/component-props'
import { GROUP_PRESETS, KANA_GROUPS } from '../../data/kana'
import { DEFAULT_HYPERPARAMS } from '../../shared/lib/trainer'
import { InfoTip } from '../../shared/ui/InfoTip'

const scriptOptions = [
  { id: 'hiragana', label: 'Хирагана' },
  { id: 'katakana', label: 'Катакана' },
  { id: 'both', label: 'Обе' },
]

const inputModeOptions = [
  {
    id: 'instant',
    label: 'Автозачёт',
    hint: 'Ответ засчитывается сразу. Ошибка — на первой неверной букве.',
  },
  {
    id: 'submit',
    label: 'По Enter',
    hint: 'Проверка по Enter. При ошибке покажем правильный ответ.',
  },
]

const modeOptions = [
  {
    id: 'adaptive',
    label: 'Адаптивный',
    hint: 'Чаще слабые и новые знаки; после ошибки подтягивает похожие (シ/ツ, ぬ/め…).',
  },
  { id: 'even', label: 'Равномерный', hint: 'Все знаки встречаются одинаково часто.' },
  { id: 'problem', label: 'Проблемные', hint: 'Только знаки, которые пока даются хуже.' },
]

const settingsSections = [
  {
    title: 'Новые и забытые',
    fields: [
      {
        id: 'unseenBoost',
        label: 'Новые знаки',
        min: 0,
        max: 6,
        step: 0.1,
        hint: 'Насколько чаще показывать знаки, которые ещё ни разу не встречались в тренировке.',
      },
      {
        id: 'seenOnlyBoostRatio',
        label: 'Показ без ответа',
        min: 0,
        max: 1,
        step: 0.05,
        hint: 'Доля приоритета «новых знаков» для карточек, которые уже показывали, но на которые ещё не отвечали.',
      },
      {
        id: 'staleBoost',
        label: 'Забытые знаки',
        min: 0,
        max: 4,
        step: 0.1,
        hint: 'Максимальный буст для знаков, которые давно не показывались.',
      },
      {
        id: 'staleAfterHours',
        label: 'Пауза до «забытых», ч',
        min: 1,
        max: 72,
        step: 1,
        hint: 'Через сколько часов без показа знак начинает считаться «забытым» и получать дополнительный приоритет.',
      },
      {
        id: 'staleRampHours',
        label: 'Набор «забытых», ч',
        min: 6,
        max: 168,
        step: 1,
        hint: 'За сколько часов после паузы «забытый» знак набирает полный буст (до значения «Забытые знаки»).',
      },
    ],
  },
  {
    title: 'Ошибки и слабые места',
    fields: [
      {
        id: 'recentMistakeBoost',
        label: 'Приоритет ошибок',
        min: 0,
        max: 6,
        step: 0.1,
        hint: 'Насколько чаще показывать знаки с недавними ошибками или подсказками.',
      },
      {
        id: 'recentMistakeHours',
        label: 'Окно ошибок, ч',
        min: 1,
        max: 48,
        step: 1,
        hint: 'Сколько часов после ошибки или подсказки знак считается «недавно проблемным».',
      },
      {
        id: 'confusionBoost',
        label: 'Тренировка двойников',
        min: 1,
        max: 4,
        step: 0.1,
        hint: 'После ошибки на похожем знаке (シ/ツ, ぬ/め…) чаще показывать его «двойника».',
      },
      {
        id: 'problemThreshold',
        label: 'Порог «проблемных»',
        min: 0.1,
        max: 1.2,
        step: 0.05,
        hint: 'Минимальный «балл проблемности» для режима «Проблемные» и статуса «Нужно добить» в статистике.',
      },
    ],
  },
  {
    title: 'Выученные и мастерство',
    fields: [
      {
        id: 'retireStreak',
        label: 'Серия до выученного',
        min: 3,
        max: 12,
        step: 1,
        hint: 'Сколько чистых ответов подряд нужно, чтобы знак считался выученным.',
      },
      {
        id: 'masteredWeight',
        label: 'Вес выученных',
        min: 0.05,
        max: 1,
        step: 0.05,
        hint: 'Во сколько раз реже выпадают знаки с длинной серией без ошибок (меньше — реже).',
      },
      {
        id: 'masteryGain',
        label: 'Рост мастерства',
        min: 0.05,
        max: 0.5,
        step: 0.01,
        hint: 'Насколько быстро растёт уверенность по знаку после верных ответов.',
      },
      {
        id: 'mistakePenalty',
        label: 'Штраф за ошибку',
        min: 0.05,
        max: 0.5,
        step: 0.01,
        hint: 'Насколько сильно падает мастерство при ошибке.',
      },
      {
        id: 'hintPenalty',
        label: 'Штраф за подсказку',
        min: 0.05,
        max: 0.4,
        step: 0.01,
        hint: 'Насколько сильно падает мастерство при использовании подсказки.',
      },
    ],
  },
  {
    title: 'Скорость и очередь',
    fields: [
      {
        id: 'targetLatencySec',
        label: 'Целевое время, сек',
        min: 1,
        max: 10,
        step: 0.5,
        hint: 'Ответы медленнее этого времени поднимают знак в очереди; быстрые ответы дают больший прирост мастерства.',
      },
      {
        id: 'queueSize',
        label: 'Очередь ошибок',
        min: 1,
        max: 8,
        step: 1,
        hint: 'Сколько карточек с ошибками держать в очереди на повтор через пару шагов.',
      },
    ],
  },
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
}: SetupPanelProps) {
  const activeInputMode = inputModeOptions.find((option) => option.id === preferences.inputMode)

  function getFieldValue(fieldId: keyof Hyperparams | 'targetLatencySec') {
    if (fieldId === 'targetLatencySec') {
      return preferences.hyperparams.targetLatencyMs / 1000
    }
    return preferences.hyperparams[fieldId]
  }

  function setFieldValue(fieldId: keyof Hyperparams | 'targetLatencySec', rawValue: string) {
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
    <section className="setup-surface controls-panel">
      <div className="section-heading">
        <h2>Кана</h2>
      </div>

      <div className="control-group">
        <span className="group-label">Письмо</span>
        <div className="segmented">
          {scriptOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`script-${option.id}`}
              className={preferences.scriptMode === option.id ? 'segmented-button is-active' : 'segmented-button'}
              onClick={() => onPatchPreferences({ scriptMode: option.id as ScriptMode })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <div className="row-heading">
          <span className="group-label">Ряды</span>
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
              onClick={() => onPatchPreferences({ inputMode: option.id as InputMode })}
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
              onClick={() => onPatchPreferences({ mode: mode.id as KanaPickMode })}
            >
              <strong>{mode.label}</strong>
              <small>{mode.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="control-row control-row-compact">
        <button type="button" className="text-button settings-toggle" onClick={onToggleFineTuning}>
          {showFineTuning ? 'Скрыть параметры' : 'Дополнительно'}
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
          {settingsSections.map((section) => (
            <div key={section.title} className="settings-section">
              <h3 className="settings-section-title">{section.title}</h3>
              <div className="settings-section-grid">
                {section.fields.map((field) => (
                  <label key={field.id} className="setting-card">
                    <span className="setting-label">
                      {field.label} <InfoTip align="end" text={field.hint} />
                    </span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={getFieldValue(field.id as keyof Hyperparams | 'targetLatencySec')}
                      onChange={(event) => setFieldValue(field.id as keyof Hyperparams | 'targetLatencySec', event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="ghost-button settings-reset"
            onClick={() => onPatchPreferences({ hyperparams: { ...DEFAULT_HYPERPARAMS } })}
          >
            Сбросить настройки
          </button>
        </div>
      ) : null}

      <div className="primary-actions">
        <button type="button" className="primary-button" onClick={onStart}>
          <span data-testid="start-practice">Начать</span>
        </button>
      </div>

      {errorText ? <p className="feedback is-error">{errorText}</p> : null}
    </section>
  )
}

function SelectionRow({ onToggle, scriptMode, selectedGroups, slot }: SelectionRowProps) {
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

function getCellPreview(entry: KanaEntry, scriptMode: ScriptMode | string) {
  if (scriptMode === 'hiragana') {
    return entry.hiragana
  }

  if (scriptMode === 'katakana') {
    return entry.katakana
  }

  return `${entry.hiragana} / ${entry.katakana}`
}
