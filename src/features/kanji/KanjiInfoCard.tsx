import { useEffect, useState } from 'react'
import { getKanjiInfo, getTopWordsForKanji } from '../../data/words/bank'
import { formatKanjiReadings } from '../../shared/lib/format'
import { speakJapanese, speakKanjiReadings } from '../../shared/lib/speech'
import { HighlightedReading } from './HighlightedReading'
import { KanjiComposition } from './KanjiComposition'
import { KanjiGlyph } from './KanjiGlyph'

export interface KanjiInfoCardProps {
  character: string
  learned?: boolean
  myWords?: string[]
  onClose: () => void
  onToggleLearned?: (character: string) => void
  onToggleMyWord?: (wordId: string) => void
  onStartPractice?: (character: string) => void
}

const TOP_WORDS = 5

function pushKanjiStack(stack: string[], next: string): string[] {
  if (!next || stack[stack.length - 1] === next) return stack
  return [...stack, next]
}

export function KanjiInfoCard({
  character,
  learned = false,
  myWords = [],
  onClose,
  onToggleLearned,
  onToggleMyWord,
  onStartPractice,
}: KanjiInfoCardProps) {
  const [stack, setStack] = useState<string[]>([character])
  const [highlightElement, setHighlightElement] = useState<string | null>(null)
  const current = stack[stack.length - 1] ?? character
  const info = getKanjiInfo(current)
  const topWords = getTopWordsForKanji(current, TOP_WORDS)
  const myWordSet = new Set(myWords)

  useEffect(() => {
    setStack([character])
    setHighlightElement(null)
  }, [character])

  useEffect(() => {
    setHighlightElement(null)
  }, [current])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'Escape') {
        event.preventDefault()
        if (stack.length > 1) {
          setStack((prev) => prev.slice(0, -1))
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, stack.length])

  if (!character) {
    return null
  }

  function openComponent(next: string) {
    setHighlightElement(null)
    setStack((prev) => pushKanjiStack(prev, next))
  }

  function goBack() {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

  const meanings = info?.meaningsRu?.length ? info.meaningsRu : info?.meanings ?? []

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
        aria-label={`Карточка кандзи ${current}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="kanji-info-head">
          <div className="kanji-info-badges">
            <span className="script-badge">{info?.levelLabel ?? '—'}</span>
            {info?.joyo ? <span className="script-badge is-joyo">Jōyō</span> : null}
            {learned && current === character ? <span className="kanji-info-learned">выучено</span> : null}
          </div>
          <div className="kanji-info-head-actions">
            {stack.length > 1 ? (
              <button type="button" className="text-button" data-testid="kanji-info-stack-back" onClick={goBack}>
                ← Назад
              </button>
            ) : null}
            <button type="button" className="text-button" data-testid="kanji-info-close" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </header>

        {stack.length > 1 ? (
          <p className="kanji-stack-path" data-testid="kanji-stack-path">
            {stack.join(' → ')}
          </p>
        ) : null}

        <KanjiGlyph
          character={current}
          size="card"
          testId="kanji-info-char"
          highlightElement={highlightElement}
          onHoverElement={(element) => setHighlightElement(element)}
          className="kanji-info-char"
          onActivateElement={openComponent}
        />

        {info ? (
          <>
            <section className="kanji-info-section">
              <h4>Значение</h4>
              <ul className="kanji-info-list">
                {meanings.map((meaning) => (
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

            <KanjiComposition
              character={current}
              highlightElement={highlightElement}
              onHoverElement={setHighlightElement}
              onOpenCharacter={openComponent}
            />

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
                        focusKanji={current}
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
          <p className="kanji-info-empty">Знака нет в банке кандзи.</p>
        )}

        <footer className="kanji-info-actions">
          {info && onToggleLearned && current === character ? (
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
            onClick={() => speakKanjiReadings(info ?? { character: current })}
          >
            Прослушать чтения
          </button>
          {info && onStartPractice ? (
            <button
              type="button"
              className="primary-button"
              data-testid="kanji-info-practice"
              onClick={() => onStartPractice(current)}
            >
              К словам
            </button>
          ) : null}
        </footer>
      </article>
    </div>
  )
}
