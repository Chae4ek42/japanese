import type { KanjiInfoCardProps } from '../../shared/lib/component-props'
import { useEffect } from 'react'
import { getKanjiInfo, getTopWordsForKanji } from './data/bank'
import { formatKanjiReadings } from '../../shared/lib/format'
import { speakJapanese, speakKanjiReadings } from '../../shared/lib/speech'
import { HighlightedReading } from './HighlightedReading'

const TOP_WORDS = 5

export function KanjiInfoCard({
  character,
  learned = false,
  myWords = [],
  onClose,
  onToggleLearned,
  onToggleMyWord,
  onStartPractice,
}: KanjiInfoCardProps) {
  const info = getKanjiInfo(character)
  const topWords = getTopWordsForKanji(character, TOP_WORDS)
  const myWordSet = new Set(myWords)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
              <h4>Значение</h4>
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
                  <span className="kanji-reading-value" title="· отделяет чтение знака от окуриганы">
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
                        {word.id && onToggleMyWord ? (
                          <button
                            type="button"
                            className="text-button"
                            data-testid={`kanji-info-save-word-${word.id}`}
                            onClick={() => onToggleMyWord(word.id!)}
                          >
                            {myWordSet.has(word.id) ? 'В моих' : '+ В мои'}
                          </button>
                        ) : null}
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
          <p className="kanji-info-empty">Знака нет в наборе N5–N3.</p>
        )}

        <footer className="kanji-info-actions">
          {info && onToggleLearned ? (
            <button
              type="button"
              className={learned ? 'primary-button' : 'ghost-button'}
              data-testid="kanji-info-toggle-learned"
              onClick={() => onToggleLearned(character)}
            >
              {learned ? 'В изученных' : 'Отметить изученным'}
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button"
            data-testid="kanji-info-speak"
            onClick={() => speakKanjiReadings(info ?? { character })}
          >
            Прослушать чтения
          </button>
          {info && onStartPractice ? (
            <button
              type="button"
              className="primary-button"
              data-testid="kanji-info-practice"
              onClick={() => onStartPractice(character)}
            >
              К словам
            </button>
          ) : null}
        </footer>
      </article>
    </div>
  )
}
