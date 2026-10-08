export interface VocabAdaptiveSettingsProps {
  inFlight: number
  passes: number
  weakFirst: boolean
  compact?: boolean
  onChange: (patch: {
    adaptiveInFlight?: number
    adaptivePasses?: number
    adaptiveWeakFirst?: boolean
  }) => void
}

const PASS_OPTIONS = [1, 2, 3] as const

export function VocabAdaptiveSettings({
  inFlight,
  passes,
  weakFirst,
  compact = false,
  onChange,
}: VocabAdaptiveSettingsProps) {
  return (
    <div
      className={compact ? 'vocab-adaptive-settings is-compact' : 'vocab-srs-settings vocab-adaptive-settings'}
      data-testid="vocab-adaptive-settings"
    >
      <span className="group-label">Адаптивный режим</span>
      <div className="vocab-srs-settings-grid">
        <label className="vocab-srs-field">
          <span className="vocab-srs-field-label">Слов в круге</span>
          <span className="vocab-srs-control">
            <input
              type="number"
              min={0}
              max={30}
              data-testid="vocab-adaptive-inflight"
              value={inFlight}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (!Number.isFinite(parsed)) return
                const next = Math.min(30, Math.max(0, Math.round(parsed)))
                onChange({ adaptiveInFlight: next > 0 ? Math.max(3, next) : 0 })
              }}
            />
            <span className="vocab-srs-unit">{inFlight <= 0 ? 'авто' : 'слов'}</span>
          </span>
          <span className="control-hint">0 — размер по набору, иначе 3–30 одновременно</span>
        </label>

        <div className="vocab-srs-field">
          <span className="vocab-srs-field-label">Успехов до выпуска</span>
          <div className="vocab-adaptive-passes" role="group" aria-label="Успехов до выпуска">
            {PASS_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                data-testid={`vocab-adaptive-passes-${count}`}
                className={passes === count ? 'vocab-adaptive-pass is-active' : 'vocab-adaptive-pass'}
                onClick={() => onChange({ adaptivePasses: count })}
              >
                {count}
              </button>
            ))}
          </div>
          <span className="control-hint">сколько верных ответов, чтобы слово вышло из круга</span>
        </div>

        <div className="vocab-srs-field vocab-srs-field-wide">
          <span className="vocab-srs-field-label">Порядок</span>
          <div className="segmented vocab-adaptive-order" role="group" aria-label="Порядок слов">
            <button
              type="button"
              data-testid="vocab-adaptive-weak-first"
              className={weakFirst ? 'segmented-button is-active' : 'segmented-button'}
              onClick={() => onChange({ adaptiveWeakFirst: true })}
            >
              Слабые сначала
            </button>
            <button
              type="button"
              data-testid="vocab-adaptive-list-order"
              className={!weakFirst ? 'segmented-button is-active' : 'segmented-button'}
              onClick={() => onChange({ adaptiveWeakFirst: false })}
            >
              Как в списке
            </button>
          </div>
          <span className="control-hint">порядок входа в круг — с начала сессии</span>
        </div>
      </div>
    </div>
  )
}
