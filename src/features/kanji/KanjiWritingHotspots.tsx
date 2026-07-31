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
  focusKanji?: string | null
  className?: string
  writingTestId?: string
  onOpenInfo?: (character: string) => void
}

export function KanjiWritingHotspots({
  writing,
  focusKanji = null,
  className = '',
  writingTestId,
  onOpenInfo,
}: KanjiWritingHotspotsProps) {
  return (
    <p className={className || undefined} data-testid={writingTestId}>
      {splitWriting(writing).map((ch, index) =>
        isKanjiChar(ch) ? (
          <KanjiChip
            key={`${ch}-${index}`}
            character={ch}
            className={focusKanji && ch === focusKanji ? 'kanji-chip is-focus' : 'kanji-chip'}
            onOpenInfo={onOpenInfo}
          />
        ) : (
          <span key={`${ch}-${index}`} className="kanji-chip-kana">
            {ch}
          </span>
        ),
      )}
    </p>
  )
}
