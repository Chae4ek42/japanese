import { useEffect, useMemo, useState } from 'react'
import { getKanjiInfo, getPopularWordsForKanji, POPULAR_WORDS_PER_KANJI } from '../../data/words/bank'
import { formatKanjiReadings } from '../../shared/lib/format'
import { speakJapanese, speakKanjiReadings } from '../../shared/lib/speech'
import { mergeWordsByWriting, wordVariantIds } from '../vocab/mergeHomographs'
import { HighlightedReading } from './HighlightedReading'
import { KanjiComposition } from './KanjiComposition'
import { KanjiGlyph } from './KanjiGlyph'

export interface KanjiInfoCardProps {
  character: string
  learned?: boolean
  myWords?: string[]
  trainingWordIds?: string[]
  onClose: () => void
  onToggleLearned?: (character: string) => void
  onToggleMyWord?: (wordId: string) => void
  onToggleTrainingWord?: (wordId: string) => void
  onStartPractice?: (character: string) => void
}

function pushKanjiStack(stack: string[], next: string): string[] {
  if (!next || stack[stack.length - 1] === next) return stack
  return [...stack, next]
}

export function KanjiInfoCard({
  character,
  learned = false,
  myWords = [],
  trainingWordIds = [],
  onClose,
  onToggleLearned,
  onToggleMyWord,
  onToggleTrainingWord,
  onStartPractice,
}: KanjiInfoCardProps) {
  const [stack, setStack] = useState<string[]>([character])
  const [highlightElement, setHighlightElement] = useState<string | null>(null)
  const current = stack[stack.length - 1] ?? character
  const info = getKanjiInfo(current)
  const words = useMemo(
    () => mergeWordsByWriting(getPopularWordsForKanji(current, POPULAR_WORDS_PER_KANJI)),
    [current],
  )
  const myWordSet = useMemo(() => new Set(myWords), [myWords])
  const trainingSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])

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

            {words.length ? (
              <section className="kanji-info-section" data-testid="kanji-info-words">
                <h4>Слова</h4>
                <ul className="kanji-info-words">
                  {words.map((word) => {
                    const ids = wordVariantIds(word)
                    const primaryId = word.id ?? ids[0]
                    const inMine = ids.some((id) => myWordSet.has(id))
                    const inTraining = ids.some((id) => trainingSet.has(id))
                    return (
                      <li key={primaryId ?? `${word.writing}-${word.kana}`}>
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
                          {primaryId && onToggleTrainingWord ? (
                            <button
                              type="button"
                              className="text-button"
                              data-testid={`kanji-info-train-word-${primaryId}`}
                              onClick={() => {
                                for (const id of ids) {
                                  if (inTraining === trainingSet.has(id)) onToggleTrainingWord(id)
                                }
                              }}
                            >
                              {inTraining ? 'В наборе' : '+ В набор'}
                            </button>
                          ) : null}
                          {primaryId && onToggleMyWord ? (
                            <button
                              type="button"
                              className="text-button"
                              data-testid={`kanji-info-save-word-${primaryId}`}
                              onClick={() => onToggleMyWord(primaryId)}
                            >
                              {inMine ? 'В моих' : '+ В мои'}
                            </button>
                          ) : null}
                        </div>
                        <HighlightedReading
                          writing={word.writing}
                          kana={word.kana}
                          focusKanji={current}
                          fallbackRomaji={word.romaji}
                        />
                        <p className="kanji-info-word-meaning">
                          {word.meanings.slice(0, 2).join(' · ') || '—'}
                          {word.readings && word.readings.length > 1
                            ? ` · ${word.readings.length} чтения`
                            : ''}
                        </p>
                      </li>
                    )
                  })}
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
