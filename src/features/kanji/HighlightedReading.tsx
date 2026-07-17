import type { HighlightedReadingProps } from '../../shared/lib/component-props'
import { getHighlightedReading } from '../../shared/lib/reading-align'

export function HighlightedReading({ writing, kana, focusKanji, fallbackRomaji, testId }: HighlightedReadingProps) {
  const segments = getHighlightedReading(writing, kana, focusKanji)

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
            className={`reading-seg is-${segment.role}`}
            title={segment.chars}
          >
            {segment.kana}
          </span>
        ))}
      </p>
      <p className="kanji-word-romaji" aria-label={segments.map((item) => item.romaji).join('')}>
        {segments.map((segment, index) => (
          <span
            key={`romaji-${index}-${segment.romaji}`}
            className={`reading-seg is-${segment.role}`}
            title={segment.chars}
          >
            {segment.romaji}
          </span>
        ))}
      </p>
    </div>
  )
}
