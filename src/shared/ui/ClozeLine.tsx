import type { ReactNode } from 'react'
import { splitCloze } from '../lib/cloze'

export function ClozeLine({
  text,
  before,
  after,
  fill,
  emptyLabel,
  className,
  blankClassName,
  testId,
  segmentClassName,
  renderSegment,
}: {
  text?: string
  before?: string
  after?: string
  fill: string | null
  emptyLabel: string
  className?: string
  blankClassName?: string
  testId?: string
  segmentClassName?: string
  renderSegment?: (segment: string, key: string) => ReactNode
}) {
  const parts = text != null ? splitCloze(text) : { before: before ?? '', after: after ?? '' }
  const render = (segment: string, key: string) =>
    renderSegment ? (
      renderSegment(segment, key)
    ) : (
      <span key={key} className={segmentClassName}>
        {segment}
      </span>
    )

  return (
    <div className={className} data-testid={testId}>
      {render(parts.before, 'before')}
      <span className={`cloze-blank ${fill ? 'is-filled' : ''} ${blankClassName ?? ''}`.trim()}>
        {fill ?? emptyLabel}
      </span>
      {render(parts.after, 'after')}
    </div>
  )
}
