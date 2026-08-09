import { useEffect, useId, useRef, useState } from 'react'
import type { VocabTrainingSet } from '../lib/types'
import { MAIN_TRAINING_SET_ID } from '../lib/trainingSets'

export function TrainingSetPicker({
  sets,
  value,
  onChange,
  testId = 'training-set-picker',
  ariaLabel = 'Набор для тренировки',
}: {
  sets: VocabTrainingSet[]
  value: string
  onChange: (setId: string) => void
  testId?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const selected =
    sets.find((set) => set.id === value) ??
    sets.find((set) => set.id === MAIN_TRAINING_SET_ID) ??
    sets[0] ??
    null

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!selected) return null

  if (sets.length <= 1) {
    return (
      <div className="set-picker is-static" data-testid={testId}>
        <span className="set-picker-name">{selected.name}</span>
        <span className="set-picker-count">{selected.wordIds.length}</span>
      </div>
    )
  }

  return (
    <div className={open ? 'set-picker is-open' : 'set-picker'} ref={rootRef}>
      <button
        type="button"
        className="set-picker-trigger"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="set-picker-copy">
          <span className="set-picker-name">{selected.name}</span>
          <span className="set-picker-count">{selected.wordIds.length} слов</span>
        </span>
        <span className="set-picker-chevron" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open ? (
        <ul
          className="set-picker-menu"
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          data-testid={`${testId}-menu`}
        >
          {sets.map((set) => {
            const active = set.id === selected.id
            return (
              <li key={set.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={active ? 'set-picker-option is-active' : 'set-picker-option'}
                  data-testid={`${testId}-option-${set.id}`}
                  onClick={() => {
                    onChange(set.id)
                    setOpen(false)
                  }}
                >
                  <span className="set-picker-option-name">{set.name}</span>
                  <span className="set-picker-option-count">{set.wordIds.length}</span>
                  {active ? <span className="set-picker-option-mark" aria-hidden="true">✓</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
