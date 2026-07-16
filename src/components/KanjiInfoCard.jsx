import { useEffect } from 'react'
import { getKanjiInfo, getTopWordsForKanji } from '../data/kanji/bank'
import { formatKanjiReadings } from '../lib/format'
import { speakJapanese, speakKanjiReadings } from '../lib/speech'
import { HighlightedReading } from './HighlightedReading'

const TOP_WORDS = 5

export function KanjiInfoCard({
  character,
  learned = false,
  onClose,
  onToggleLearned,
  onStartPractice,
}) {
  const info = getKanjiInfo(character)
  const topWords = getTopWordsForKanji(character, TOP_WORDS)

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!character) {
    return null
  }

  return (
    <div
      className="kanji-info-overlay"
      data-testid="kanji-info-overlay"
      onClick={onClose}
      role="presentation"
    >
      <article
        className="kanji-info-card"
        data-testid="kanji-info-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Карточка кандзи ${character}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="kanji-info-head">
          <div className="kanji-info-badges">
            <span className="script-badge">{info?.levelLabel ?? '—'}</span>
            {learned ? <span className="kanji-info-learned">выучено</span> : null}
          </div>
          <button type="button" className="text-button" data-testid="kanji-info-close" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <p className="kanji-info-char">{character}</p>

        {info ? (
          <>
            <section className="kanji-info-section">
              <h4>Значения</h4>
              <ul className="kanji-info-list">
                {info.meanings.map((meaning) => (
                  <li key={meaning}>{meaning}</li>
                ))}
              </ul>
            </section>

            <section className="kanji-info-section">
              <h4>Чтения</h4>
              <div className="kanji-hero-readings">
                <div className="kanji-reading is-on">
                  <span className="kanji-reading-label">он</span>
                  <span className="kanji-reading-value">{formatKanjiReadings(info.onyomi)}</span>
                </div>
                <div className="kanji-reading is-kun">
                  <span className="kanji-reading-label">кун</span>
                  <span className="kanji-reading-value" title="· отделяет чтение кандзи от окуриганы">
                    {formatKanjiReadings(info.kunyomi)}
                  </span>
                </div>
              </div>
            </section>

            {topWords.length ? (
              <section className="kanji-info-section" data-testid="kanji-info-words">
                <h4>Частые слова</h4>
                <ul className="kanji-info-words">
                  {topWords.map((word) => (
                    <li key={word.id ?? `${word.writing}-${word.kana}`}>
                      <div className="kanji-info-word-main">
                        <span className="kanji-info-word-writing">{word.writing}</span>
                        <button
                          type="button"
                          className="text-button kanji-info-word-speak"
                          data-testid={`kanji-info-speak-word-${word.writing}`}
                          aria-label={`Озвучить ${word.writing}`}
                          onClick={() => speakJapanese(word.kana || word.writing)}
                        >
                          ▶
                        </button>
                      </div>
                      <HighlightedReading
                        writing={word.writing}
                        kana={word.kana}
                        focusKanji={character}
                        fallbackRomaji={word.romaji}
                      />
                      <p className="kanji-info-word-meaning">{word.meanings[0] ?? '—'}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <p className="kanji-info-empty">Этого знака нет в базе N5–N3.</p>
        )}

        <footer className="kanji-info-actions">
          {info && onToggleLearned ? (
            <button
              type="button"
              className={learned ? 'primary-button' : 'ghost-button'}
              data-testid="kanji-info-toggle-learned"
              onClick={() => onToggleLearned(character)}
            >
              {learned ? 'Выучено' : 'Отметить выученным'}
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button"
            data-testid="kanji-info-speak"
            onClick={() => speakKanjiReadings(info ?? { character })}
          >
            Озвучить чтения
          </button>
          {info && onStartPractice ? (
            <button
              type="button"
              className="primary-button"
              data-testid="kanji-info-practice"
              onClick={() => onStartPractice(character)}
            >
              Учить слова
            </button>
          ) : null}
        </footer>
      </article>
    </div>
  )
}
