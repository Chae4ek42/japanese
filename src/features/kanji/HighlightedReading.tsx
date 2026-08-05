import {
  getColoredReading,
  getHighlightedReading,
  readingSegClassName,
} from '../../shared/lib/reading-align'

export interface HighlightedReadingProps {
  writing: string
  kana: string
  focusKanji?: string
  fallbackRomaji?: string
  testId?: string
  /** Multi-color kanji↔reading map. Only for training reveal. */
  colorize?: boolean
}

function romajiLabel(segments: Array<{ romaji: string }>, fallbackRomaji?: string): string {
  const fromSegments = segments.map((item) => item.romaji).join('')
  if (fallbackRomaji && /\/|\s\/\s/.test(fallbackRomaji)) {
    return fallbackRomaji
  }
  return fromSegments
}

export function HighlightedReading({
  writing,
  kana,
  focusKanji = '',
  fallbackRomaji,
  testId,
  colorize = false,
}: HighlightedReadingProps) {
  if (colorize) {
    const segments = getColoredReading(writing, kana, focusKanji)
    if (!segments?.length) {
      return (
        <div className="reading-highlight" data-testid={testId}>
          <p className="kanji-word-kana">{kana}</p>
          {fallbackRomaji ? <p className="kanji-word-romaji">{fallbackRomaji}</p> : null}
        </div>
      )
    }

    const romajiText = romajiLabel(segments, fallbackRomaji)

    return (
      <div className="reading-highlight is-colorized" data-testid={testId}>
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
        <p className="kanji-word-romaji" aria-label={romajiText}>
          {fallbackRomaji && /\/|\s\/\s/.test(fallbackRomaji) ? (
            fallbackRomaji
          ) : (
            segments.map((segment, index) => (
              <span
                key={`romaji-${index}-${segment.romaji}`}
                className={readingSegClassName(segment.colorIndex, segment.role, focusKanji, segment.chars)}
                title={segment.chars}
              >
                {segment.romaji}
              </span>
            ))
          )}
        </p>
      </div>
    )
  }

  const segments = getHighlightedReading(writing, kana, focusKanji)
  if (!segments?.length) {
    return (
      <div className="reading-highlight" data-testid={testId}>
        <p className="kanji-word-kana">{kana}</p>
        {fallbackRomaji ? <p className="kanji-word-romaji">{fallbackRomaji}</p> : null}
      </div>
    )
  }

  const romajiText = romajiLabel(segments, fallbackRomaji)

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
      <p className="kanji-word-romaji" aria-label={romajiText}>
        {fallbackRomaji && /\/|\s\/\s/.test(fallbackRomaji) ? (
          fallbackRomaji
        ) : (
          segments.map((segment, index) => (
            <span
              key={`romaji-${index}-${segment.romaji}`}
              className={`reading-seg is-${segment.role}`}
              title={segment.chars}
            >
              {segment.romaji}
            </span>
          ))
        )}
      </p>
    </div>
  )
}
