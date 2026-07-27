import type { ReactNode } from 'react'
import '../../shared/styles/writing-hotspots.css'
import { isKanjiChar, splitWriting } from '../kanji/KanjiWritingHotspots'

export interface ContextSentenceTextProps {
  text: string
  /** Surface forms to highlight (typically writings of new words). */
  highlightWritings?: string[]
  className?: string
  testId?: string
  onOpenKanji?: (character: string) => void
}

interface Segment {
  text: string
  highlight: boolean
}

function buildSegments(text: string, needles: string[]): Segment[] {
  const sorted = [...new Set(needles.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!sorted.length) return [{ text, highlight: false }]

  const segments: Segment[] = []
  let cursor = 0
  while (cursor < text.length) {
    let matched: string | null = null
    for (const needle of sorted) {
      if (text.startsWith(needle, cursor)) {
        matched = needle
        break
      }
    }
    if (matched) {
      segments.push({ text: matched, highlight: true })
      cursor += matched.length
      continue
    }
    const nextHits = sorted
      .map((needle) => text.indexOf(needle, cursor))
      .filter((index) => index >= 0)
    const next = nextHits.length ? Math.min(...nextHits) : text.length
    segments.push({ text: text.slice(cursor, next), highlight: false })
    cursor = next
  }
  return segments.filter((segment) => segment.text.length > 0)
}

function renderChars(
  text: string,
  keyPrefix: string,
  onOpenKanji?: (character: string) => void,
): ReactNode[] {
  return splitWriting(text).map((ch, index) => {
    if (!isKanjiChar(ch)) {
      return (
        <span key={`${keyPrefix}-k-${index}`} className="kanji-chip-kana">
          {ch}
        </span>
      )
    }
    return (
      <button
        key={`${keyPrefix}-c-${index}`}
        type="button"
        data-kanji-chip
        data-testid={`kanji-chip-${ch}`}
        className="kanji-chip"
        title={onOpenKanji ? 'Колёсико — карточка знака' : undefined}
        onAuxClick={(event) => {
          if (event.button !== 1 || !onOpenKanji) return
          event.preventDefault()
          onOpenKanji(ch)
        }}
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault()
        }}
      >
        {ch}
      </button>
    )
  })
}

export function ContextSentenceText({
  text,
  highlightWritings = [],
  className = 'context-sentence',
  testId = 'context-sentence',
  onOpenKanji,
}: ContextSentenceTextProps) {
  const segments = buildSegments(text, highlightWritings)
  return (
    <p className={className} data-testid={testId}>
      {segments.map((segment, index) => {
        const nodes = renderChars(segment.text, `${index}`, onOpenKanji)
        if (!segment.highlight) return nodes
        return <mark key={`h-${index}`}>{nodes}</mark>
      })}
    </p>
  )
}
