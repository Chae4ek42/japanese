import { useState } from 'react'
import type { VocabCard } from '../../shared/lib/types'
import { HighlightedReading } from '../kanji/HighlightedReading'

export interface VocabSetupPoolProps {
  cards: VocabCard[]
  excludedIds: Set<string>
  onToggleExclude: (cardId: string) => void
  onClearExcluded: () => void
}

function focusChar(writing: string): string {
  for (const ch of writing) {
    if (/\p{Script=Han}/u.test(ch)) return ch
  }
  return writing[0] ?? ''
}

export function VocabSetupPool({
  cards,
  excludedIds,
  onToggleExclude,
  onClearExcluded,
}: VocabSetupPoolProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const includedCount = cards.filter((card) => !excludedIds.has(card.id)).length
  const excludedCount = cards.length - includedCount

  return (
    <article className="kanji-panel kanji-words-panel vocab-setup-pool" data-testid="vocab-setup-pool">
      <div className="kanji-words-head">
        <div>
          <h3>Слова в тренировке</h3>
          <p className="subsection-note" data-testid="vocab-setup-pool-meta">
            {includedCount} из {cards.length}
            {excludedCount ? ` · исключено ${excludedCount}` : ''}
          </p>
        </div>
        {excludedCount ? (
          <div className="kanji-words-head-actions">
            <button
              type="button"
              className="text-button"
              data-testid="vocab-setup-clear-excluded"
              onClick={onClearExcluded}
            >
              Вернуть все
            </button>
          </div>
        ) : null}
      </div>

      {!cards.length ? (
        <div className="kanji-panel-body chart-empty" data-testid="vocab-setup-pool-empty">
          Нет слов по текущим фильтрам.
        </div>
      ) : (
        <ul className="kanji-word-list" data-testid="vocab-setup-word-list">
          {cards.map((card) => {
            const excluded = excludedIds.has(card.id)
            const expanded = expandedId === card.id
            const meaningLine =
              card.meanings
                .slice(0, 2)
                .map((meaning) => meaning.replace(/^\d+\)\s*/, ''))
                .join(' · ') ||
              card.meaning ||
              '—'
            return (
              <li
                key={card.id}
                className={[
                  'kanji-word-list-item',
                  expanded ? 'is-expanded' : '',
                  excluded ? 'is-excluded' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-testid={`vocab-setup-word-${card.id}`}
              >
                <div className="vocab-setup-word-row">
                  <button
                    type="button"
                    className="kanji-word-list-main"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId((prev) => (prev === card.id ? null : card.id))}
                  >
                    <span className="kanji-word-list-writing">{card.writing}</span>
                    <div className="kanji-word-list-body">
                      <HighlightedReading
                        writing={card.writing}
                        kana={card.kana}
                        focusKanji={focusChar(card.writing)}
                        fallbackRomaji={card.romaji}
                      />
                      <p className="kanji-word-list-meaning" title={meaningLine}>
                        {meaningLine}
                      </p>
                    </div>
                    <span className="kanji-word-list-tag">
                      {card.jlpt ? `N${card.jlpt}` : '—'}
                      {card.readings && card.readings.length > 1 ? ` · ${card.readings.length}` : ''}
                    </span>
                  </button>
                  <div className="vocab-setup-word-actions">
                    <button
                      type="button"
                      className={excluded ? 'vocab-setup-exclude-button is-excluded-on' : 'vocab-setup-exclude-button'}
                      data-testid={`vocab-setup-exclude-${card.id}`}
                      aria-pressed={excluded}
                      aria-label={
                        excluded
                          ? `Вернуть ${card.writing} в тренировку`
                          : `Исключить ${card.writing} из тренировки`
                      }
                      onClick={() => onToggleExclude(card.id)}
                    >
                      {excluded ? 'Вернуть' : 'Искл.'}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="kanji-word-detail" data-testid="vocab-setup-word-detail">
                    <div className="kanji-word-detail-readings">
                      {card.readings && card.readings.length > 1 ? (
                        card.readings.map((reading) => (
                          <HighlightedReading
                            key={`${reading.kana}-${reading.romaji}`}
                            writing={card.writing}
                            kana={reading.kana}
                            focusKanji={focusChar(card.writing)}
                            fallbackRomaji={reading.romaji}
                          />
                        ))
                      ) : (
                        <HighlightedReading
                          writing={card.writing}
                          kana={card.kana}
                          focusKanji={focusChar(card.writing)}
                          fallbackRomaji={card.romaji}
                        />
                      )}
                    </div>
                    <ul className="kanji-word-detail-meanings">
                      {(card.meanings.length ? card.meanings : [card.meaning]).map((meaning) => (
                        <li key={meaning}>{meaning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
