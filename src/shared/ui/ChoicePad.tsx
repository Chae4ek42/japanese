import type { ReactNode } from 'react'

export function ChoicePad<T extends string>({
  options,
  onPick,
  disabled = false,
  className,
  labelledBy,
  ariaLabel,
  itemClassName,
  testIdFor,
  render,
}: {
  options: T[]
  onPick: (option: T) => void
  disabled?: boolean
  className?: string
  labelledBy?: string
  ariaLabel?: string
  itemClassName: (option: T) => string
  testIdFor: (option: T) => string
  render: (option: T) => ReactNode
}) {
  return (
    <div className={className} role="group" aria-labelledby={labelledBy} aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={itemClassName(option)}
          data-testid={testIdFor(option)}
          disabled={disabled}
          onClick={() => onPick(option)}
        >
          {render(option)}
        </button>
      ))}
    </div>
  )
}
