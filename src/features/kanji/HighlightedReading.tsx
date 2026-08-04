import {
  getColoredReading,
  readingSegClassName,
} from '../../shared/lib/reading-align'

export interface HighlightedReadingProps {
  writing: string
  kana: string
  focusKanji?: string
  fallbackRomaji?: string
  testId?: string
}

export function HighlightedReading({
  writing,
  kana,
  focusKanji = '',
  fallbackRomaji,
  testId,
}: HighlightedReadingProps) {
  const segments = getColoredReading(writing, kana, focusKanji)

  if (!segments?.length) {
    return (
      <div className="reading-highlight" data-testid={testId}>
        <p className="kanji-word-kana">{kana}</p>
        {fallbackRomaji ? <p className="kanji-word-romaji">{fallbackRomaji}</p> : null}
      </div>
    )
  }

  return (
    <div className="reading-highlight" data-testid={testId}>
      <p className="kanji-word-kana" aria-label={kana}>
        {segments.map((segment, index) => (
          <span
            key={`kana-${index}-${segment.kana}`}
            className={readingSegClassName(segment.colorIndex, segment.role, focusKanji, segment.chars)}
            title={
              segment.source === 'group' || segment.source === 'guess'
                ? `${segment.chars} · нестандартное чтение`
                : segment.chars
            }
          >
            {segment.kana}
          </span>
        ))}
      </p>
      <p className="kanji-word-romaji" aria-label={segments.map((item) => item.romaji).join('')}>
        {segments.map((segment, index) => (
          <span
            key={`romaji-${index}-${segment.romaji}`}
            className={readingSegClassName(segment.colorIndex, segment.role, focusKanji, segment.chars)}
            title={segment.chars}
          >
            {segment.romaji}
          </span>
        ))}
      </p>
    </div>
  )
}
