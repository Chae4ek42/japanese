import {
  getColoredReading,
  mapWritingColorIndexes,
  READING_COLOR_COUNT,
} from '../../shared/lib/reading-align'
import { KanjiChip } from './KanjiChip'
import '../../shared/styles/writing-hotspots.css'

const KANJI_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

export function isKanjiChar(ch: string): boolean {
  return KANJI_CHAR_RE.test(ch)
}

export function splitWriting(writing: string): string[] {
  return Array.from(String(writing))
}

export interface KanjiWritingHotspotsProps {
  writing: string
  /** When set, color each kanji to match its reading segment. */
  kana?: string | null
  focusKanji?: string | null
  className?: string
  writingTestId?: string
  /** When false, render colored spans (safe inside outer buttons). */
  interactive?: boolean
  onOpenInfo?: (character: string) => void
}

export function KanjiWritingHotspots({
  writing,
  kana = null,
  focusKanji = null,
  className = '',
  writingTestId,
  interactive = true,
  onOpenInfo,
}: KanjiWritingHotspotsProps) {
  const chars = splitWriting(writing)
  const segments = kana ? getColoredReading(writing, kana, focusKanji ?? '') : null
  const colorIndexes = kana ? mapWritingColorIndexes(writing, segments) : null

  return (
    <span className={className || undefined} data-testid={writingTestId}>
      {chars.map((ch, index) => {
        if (!isKanjiChar(ch)) {
          return (
            <span key={`${ch}-${index}`} className="kanji-chip-kana">
              {ch}
            </span>
          )
        }

        const colorIndex = colorIndexes?.[index]
        const colorClass =
          colorIndex != null && colorIndex >= 0
            ? `is-c${colorIndex % READING_COLOR_COUNT}`
            : ''
        const focusClass = focusKanji && ch === focusKanji ? 'is-focus' : ''
        const sharedClass =
          segments?.some(
            (segment) =>
              (segment.source === 'group' || segment.role === 'shared') &&
              segment.chars.includes(ch) &&
              segment.chars.length > 1,
          )
            ? 'is-shared-reading'
            : ''
        const classNames = ['kanji-chip', colorClass, focusClass, sharedClass].filter(Boolean).join(' ')

        if (!interactive) {
          return (
            <span key={`${ch}-${index}`} className={classNames}>
              {ch}
            </span>
          )
        }

        return (
          <KanjiChip
            key={`${ch}-${index}`}
            character={ch}
            className={classNames}
            onOpenInfo={onOpenInfo}
          />
        )
      })}
    </span>
  )
}
