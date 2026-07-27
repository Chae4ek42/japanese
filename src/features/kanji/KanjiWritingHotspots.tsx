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
  function handleAuxClick(ch: string, event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 1 || !isKanjiChar(ch) || !onOpenInfo) return
    event.preventDefault()
    onOpenInfo(ch)
  }

  return (
    <p className={className || undefined} data-testid={writingTestId}>
      {splitWriting(writing).map((ch, index) =>
        isKanjiChar(ch) ? (
          <button
            key={`${ch}-${index}`}
            type="button"
            data-kanji-chip
            data-testid={`kanji-chip-${ch}`}
            className={focusKanji && ch === focusKanji ? 'kanji-chip is-focus' : 'kanji-chip'}
            title={onOpenInfo ? 'Колёсико — карточка знака' : undefined}
            onAuxClick={(event) => handleAuxClick(ch, event)}
            onMouseDown={(event) => {
              if (event.button === 1) event.preventDefault()
            }}
          >
            {ch}
          </button>
        ) : (
          <span key={`${ch}-${index}`} className="kanji-chip-kana">
            {ch}
          </span>
        ),
      )}
    </p>
  )
}
