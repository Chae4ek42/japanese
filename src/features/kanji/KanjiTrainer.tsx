import type { KanjiInfo } from '../../shared/lib/types'
import type { KanjiTrainerProps } from '../../shared/lib/component-props'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getKanjiInfo, getPracticeWords, getWordsForKanji } from './data/bank'
import { formatKanjiReadings } from '../../shared/lib/format'
import { speakJapanese, speakKanjiReadings } from '../../shared/lib/speech'
import { useWordCarousel } from '../../shared/lib/useWordCarousel'
import { GlossFootnotes } from './GlossFootnotes'
import { HighlightedReading } from './HighlightedReading'

const KANJI_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

function splitWriting(writing: string): string[] {
  return Array.from(String(writing))
}

interface KanjiTipState {
  character: string
  details: KanjiInfo | null
  x: number
  y: number
}

export function KanjiTrainer({
  character,
  learned,
  complexityFilter,
  myWords,
  onPatchPreferences,
  onToggleLearned,
  onToggleMyWord,
  onBack,
  onOpenInfo,
}: KanjiTrainerProps) {
  const info = getKanjiInfo(character)
  const isLearned = learned.includes(character)
  const [tip, setTip] = useState<KanjiTipState | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  const words = useMemo(
    () =>
      getPracticeWords(character, {
        learned,
        complexityFilter,
        limit: 24,
      }),
    [character, learned, complexityFilter],
  )
  const totalAvailable = getWordsForKanji(character).length
  const {
    index: wordIndex,
    setIndex: setWordIndex,
    revealed,
    setRevealed,
    activeItem: activeWord,
    next,
    prev,
    toggleReveal,
  } = useWordCarousel(words, { resetKey: character })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'ArrowRight') {
        event.preventDefault()
        setTip(null)
        next()
        return
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        setTip(null)
        prev()
        return
      }
      if (event.code !== 'Space') {
        return
      }
      event.preventDefault()
      if (!activeWord) {
        return
      }
      toggleReveal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeWord, next, prev, toggleReveal])

  useEffect(() => {
    if (!tip) {
      return undefined
    }
    function onPointerDown(event: PointerEvent) {
      if (tipRef.current?.contains(event.target as Node)) {
        return
      }
      if ((event.target as Element | null)?.closest?.('[data-kanji-chip]')) {
        return
      }
      setTip(null)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.code === 'Escape') {
        setTip(null)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [tip])

  function goNext() {
    setTip(null)
    next()
  }

  function goPrev() {
    setTip(null)
    prev()
  }

  function openKanjiTip(ch: string, event: React.MouseEvent<HTMLElement>) {
    if (!KANJI_CHAR_RE.test(ch)) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const details = getKanjiInfo(ch)
    setTip({
      character: ch,
      details,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    })
  }

  function handleKanjiChipAuxClick(ch: string, event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 1 || !KANJI_CHAR_RE.test(ch)) {
      return
    }
    event.preventDefault()
    setTip(null)
    onOpenInfo?.(ch)
  }

  return (
    <section className="kanji-trainer" data-testid="kanji-trainer">
      <div className="kanji-trainer-toolbar">
        <button type="button" className="text-button" onClick={onBack}>
          ← Все кандзи
        </button>
        <label className="kanji-filter-toggle">
          <input
            type="checkbox"
            data-testid="kanji-complexity-filter-trainer"
            checked={complexityFilter}
            onChange={(event) => {
              setWordIndex(0)
              setRevealed(false)
              setTip(null)
              onPatchPreferences({ complexityFilter: event.target.checked })
            }}
          />
          Только посильные слова
        </label>
      </div>

      <div className="kanji-trainer-layout">
        <article className="kanji-panel kanji-trainer-hero">
          <div className="kanji-panel-body">
            <button
              type="button"
              className="kanji-hero-char"
              data-testid="kanji-focus-char"
              title="Колёсико — открыть карточку"
              onAuxClick={(event) => handleKanjiChipAuxClick(character, event)}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                }
              }}
            >
              {character}
            </button>
            <ul className="kanji-hero-meanings-list">
              {(info?.meanings?.length ? info.meanings : ['—']).map((meaning) => (
                <li key={meaning}>{meaning}</li>
              ))}
            </ul>
            <div className="kanji-hero-readings" data-testid="kanji-readings">
              <div className="kanji-reading is-on">
                <span className="kanji-reading-label">он</span>
                <span className="kanji-reading-value">{formatKanjiReadings(info?.onyomi)}</span>
              </div>
              <div className="kanji-reading is-kun">
                <span className="kanji-reading-label">кун</span>
                <span className="kanji-reading-value" title="· отделяет чтение кандзи от окуриганы">
                  {formatKanjiReadings(info?.kunyomi)}
                </span>
              </div>
            </div>
          </div>
          <div className="kanji-panel-footer kanji-trainer-actions">
            <button
              type="button"
              className={isLearned ? 'primary-button' : 'ghost-button'}
              data-testid="kanji-toggle-learned"
              onClick={() => onToggleLearned(character)}
            >
              {isLearned ? 'В изученных' : 'Отметить изученным'}
            </button>
            <button
              type="button"
              className="ghost-button"
              data-testid="kanji-speak-char"
              onClick={() => speakKanjiReadings(info ?? { character })}
            >
              Прослушать чтения
            </button>
          </div>
        </article>

        <article className="kanji-panel kanji-words-panel">
          <div className="kanji-words-head">
            <div>
              <h3>Слова</h3>
              <p className="subsection-note">
                {words.length} из {totalAvailable}
                {complexityFilter ? ' · посильные' : ''}
              </p>
            </div>
            {activeWord ? (
              <p className="kanji-word-progress">
                {wordIndex + 1} / {words.length}
              </p>
            ) : null}
          </div>

          {!activeWord ? (
            <div className="kanji-panel-body chart-empty" data-testid="kanji-no-words">
              Подходящих слов нет. Отключите фильтр или отметьте больше соседних знаков.
            </div>
          ) : (
            <>
              <div
                className={`kanji-panel-body kanji-word-stage ${revealed ? 'is-revealed' : ''}`}
                data-testid="kanji-word-card"
              >
                <p className="kanji-word-writing" data-testid="kanji-word-writing">
                  {splitWriting(activeWord.writing).map((ch, index) =>
                    KANJI_CHAR_RE.test(ch) ? (
                      <button
                        key={`${ch}-${index}`}
                        type="button"
                        data-kanji-chip
                        data-testid={`kanji-chip-${ch}`}
                        className={ch === character ? 'kanji-chip is-focus' : 'kanji-chip'}
                        title="Клик — кратко · колёсико — карточка"
                        onClick={(event) => openKanjiTip(ch, event)}
                        onAuxClick={(event) => handleKanjiChipAuxClick(ch, event)}
                        onMouseDown={(event) => {
                          if (event.button === 1) {
                            event.preventDefault()
                          }
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

                {revealed ? (
                  <div className="kanji-word-details">
                    <HighlightedReading
                      writing={activeWord.writing}
                      kana={activeWord.kana}
                      focusKanji={character}
                      fallbackRomaji={activeWord.romaji}
                      testId="kanji-word-kana"
                    />
                    <ul className="kanji-word-meanings" data-testid="kanji-word-meanings">
                      {activeWord.meanings.map((meaning) => (
                        <li key={meaning}>{meaning}</li>
                      ))}
                    </ul>
                    <GlossFootnotes meanings={activeWord.meanings} />
                    <p className="kanji-word-tags">
                      {activeWord.jlpt ? `N${activeWord.jlpt}` : 'вне JLPT'}
                      {activeWord.common ? ' · частое' : ''}
                    </p>
                  </div>
                ) : (
                  <p className="kanji-word-hint">Пробел — показать или скрыть чтение и перевод</p>
                )}
              </div>

              <div className="kanji-panel-footer kanji-word-actions">
                <button type="button" className="ghost-button" data-testid="kanji-prev-word" onClick={goPrev}>
                  ←
                </button>
                <button
                  type="button"
                  className="primary-button"
                  data-testid="kanji-reveal-word"
                  onClick={toggleReveal}
                >
                  {revealed ? 'Скрыть' : 'Показать'}
                </button>
                <button type="button" className="ghost-button" data-testid="kanji-next-word" onClick={goNext}>
                  →
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  data-testid="kanji-speak-word"
                  onClick={() => speakJapanese(activeWord.kana || activeWord.writing)}
                >
                  ▶︎ Слушать
                </button>
                {activeWord.id ? (
                  <button
                    type="button"
                    className={myWords.includes(activeWord.id) ? 'primary-button' : 'ghost-button'}
                    data-testid="kanji-save-word"
                    onClick={() => onToggleMyWord(activeWord.id!)}
                  >
                    {myWords.includes(activeWord.id) ? 'В моих' : '+ В мои'}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </article>
      </div>

      {tip ? (
        <div
          ref={tipRef}
          className="kanji-tip"
          data-testid="kanji-tip"
          style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
          role="dialog"
          aria-label={`Информация о кандзи ${tip.character}`}
        >
          <div className="kanji-tip-head">
            <strong className="kanji-tip-char">{tip.character}</strong>
            {tip.details ? (
              <span className="kanji-tip-level">{tip.details.levelLabel}</span>
            ) : (
              <span className="kanji-tip-level is-muted">вне набора</span>
            )}
          </div>
          {tip.details ? (
            <>
              <ul className="kanji-tip-meanings-list">
                {tip.details.meanings.map((meaning) => (
                  <li key={meaning}>{meaning}</li>
                ))}
              </ul>
              <div className="kanji-tip-readings">
                <div className="kanji-reading is-on">
                  <span className="kanji-reading-label">он</span>
                  <span>{formatKanjiReadings(tip.details.onyomi)}</span>
                </div>
                <div className="kanji-reading is-kun">
                  <span className="kanji-reading-label">кун</span>
                  <span title="· отделяет чтение знака от окуриганы">
                    {formatKanjiReadings(tip.details.kunyomi)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="kanji-tip-meanings">Знака нет в наборе N5–N3.</p>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => speakKanjiReadings(tip.details ?? { character: tip.character })}
          >
            Прослушать
          </button>
        </div>
      ) : null}
    </section>
  )
}
