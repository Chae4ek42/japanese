import type { VocabPreferences } from '../../shared/lib/types'
import { VOCAB_GROUPS } from './groups'

const drillOptions = [
  {
    id: 'romaji' as const,
    label: 'Ромадзи',
    hint: 'Смотрите написание и вводите чтение латиницей.',
  },
  {
    id: 'choice' as const,
    label: 'Перевод',
    hint: 'Смотрите написание и выбираете верный перевод из 6 вариантов.',
  },
]

const sourceOptions = [
  { id: 'level' as const, label: 'По уровню' },
  { id: 'group' as const, label: 'По группе' },
  { id: 'mine' as const, label: 'Мои слова' },
]

const pickOptions = [
  { id: 'adaptive' as const, label: 'Адаптивный', hint: 'Чаще слабые и новые слова.' },
  { id: 'even' as const, label: 'Равномерный', hint: 'Все слова из набора с равной частотой.' },
]

const inputModeOptions = [
  { id: 'instant' as const, label: 'Автозачёт', hint: 'Ответ засчитывается сразу при верном вводе.' },
  { id: 'submit' as const, label: 'По Enter', hint: 'Проверка по Enter.' },
]

export interface VocabSetupProps {
  preferences: VocabPreferences
  poolCount: number
  myWordsCount: number
  errorText?: string
  onPatchPreferences: (patch: Partial<VocabPreferences>) => void
  onStart: () => void
}

export function VocabSetup({
  preferences,
  poolCount,
  myWordsCount,
  errorText = '',
  onPatchPreferences,
  onStart,
}: VocabSetupProps) {
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

      <div className="control-group">
        <span className="group-label">Набор слов</span>
        <div className="segmented">
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
            </button>
          ))}
        </div>
      </div>

      {preferences.source === 'level' ? (
        <div className="control-group">
          <span className="group-label">Уровень JLPT</span>
          <div className="segmented">
            {([5, 4, 3] as const).map((level) => (
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
            {VOCAB_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                data-testid={`vocab-train-group-${group.id}`}
                className={preferences.groupId === group.id ? 'vocab-group-card is-active' : 'vocab-group-card'}
                onClick={() => onPatchPreferences({ groupId: group.id })}
              >
                <span className="vocab-group-label">{group.label}</span>
                <span className="vocab-group-count">{group.wordIds.length}</span>
              </button>
            ))}
          </div>
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
        {poolCount} слов в наборе
      </p>

      <div className="primary-actions">
        <button type="button" className="primary-button" data-testid="start-vocab" onClick={onStart}>
          Начать
        </button>
      </div>

      {errorText ? <p className="feedback is-error">{errorText}</p> : null}
    </section>
  )
}
