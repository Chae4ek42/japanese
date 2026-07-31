import type { KanjiPreferences, KanjiWordJlptLevel } from '../../shared/lib/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getKanjiInfo, getPracticeWords, getWordsForKanji } from '../../data/words/bank'
import { formatKanjiReadings } from '../../shared/lib/format'
import { speakJapanese, speakKanjiReadings } from '../../shared/lib/speech'
import { useSwipeGestures } from '../../shared/lib/useSwipeGestures'
import { useWordCarousel } from '../../shared/lib/useWordCarousel'
import { ShortcutNote } from '../../shared/ui/ShortcutNote'
import { GlossFootnotes } from './GlossFootnotes'
import { HighlightedReading } from './HighlightedReading'
import { KanjiComposition } from './KanjiComposition'
import { KanjiGlyph } from './KanjiGlyph'
import { KanjiWritingHotspots, isKanjiChar } from './KanjiWritingHotspots'
import { WordJlptFilter } from './WordJlptFilter'

export interface KanjiTrainerProps {
  character: string
  learned: string[]
  complexityFilter: boolean
  wordJlptLevels?: KanjiWordJlptLevel[]
  hiddenWordIds?: string[]
  myWords: string[]
  onPatchPreferences: (patch: Partial<KanjiPreferences>) => void
  onHideWord?: (wordId: string) => void
  onRestoreHiddenWords?: () => void
  onToggleLearned: (character: string) => void
  onToggleMyWord: (wordId: string) => void
  onBack: () => void
  onOpenInfo?: (character: string) => void
}

export function KanjiTrainer({
  character,
  learned,
  complexityFilter,
  wordJlptLevels = [],
  hiddenWordIds = [],
  myWords,
  onPatchPreferences,
  onHideWord,
  onRestoreHiddenWords,
  onToggleLearned,
  onToggleMyWord,
  onBack,
  onOpenInfo,
}: KanjiTrainerProps) {
  const info = getKanjiInfo(character)
  const isLearned = learned.includes(character)
  const [highlightElement, setHighlightElement] = useState<string | null>(null)

  useEffect(() => {
    setHighlightElement(null)
  }, [character])

  const words = useMemo(
    () =>
      getPracticeWords(character, {
        learned,
        complexityFilter,
        excludedIds: hiddenWordIds,
        wordJlptLevels,
        limit: 24,
      }),
    [character, learned, complexityFilter, hiddenWordIds, wordJlptLevels],
  )
  const totalAvailable = getWordsForKanji(character).length
  const hiddenCount = hiddenWordIds.length
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
        next()
        return
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
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

  const swipeStageRef = useRef<HTMLElement>(null)
  useSwipeGestures(swipeStageRef, {
    onSwipeLeft: prev,
    onSwipeRight: next,
    onSwipeDown: () => {
      if (activeWord) toggleReveal()
    },
  })

  function handleKanjiAuxClick(ch: string, event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 1 || !isKanjiChar(ch)) return
    event.preventDefault()
    onOpenInfo?.(ch)
  }

  return (
    <section ref={swipeStageRef} className="kanji-trainer has-mobile-swipes" data-testid="kanji-trainer">
      <div className="kanji-trainer-toolbar">
        <button type="button" className="text-button" onClick={onBack}>
          ← Все кандзи
        </button>
        <div className="kanji-trainer-filters">
          <WordJlptFilter
            selected={wordJlptLevels}
            testIdPrefix="kanji-word-jlpt-trainer"
            onChange={(next) => {
              setWordIndex(0)
              setRevealed(false)
              onPatchPreferences({ wordJlptLevels: next })
            }}
          />
          <label className="kanji-filter-toggle">
            <input
              type="checkbox"
              data-testid="kanji-complexity-filter-trainer"
              checked={complexityFilter}
              onChange={(event) => {
                setWordIndex(0)
                setRevealed(false)
                onPatchPreferences({ complexityFilter: event.target.checked })
              }}
            />
            Только посильные слова
          </label>
        </div>
      </div>

      <div className="kanji-trainer-layout">
        <article className="kanji-panel kanji-trainer-hero">
          <div className="kanji-panel-body">
            <KanjiGlyph
              character={character}
              size="hero"
              testId="kanji-focus-char"
              highlightElement={highlightElement}
              onHoverElement={(element) => setHighlightElement(element)}
              onActivateElement={(nextChar) => {
                onOpenInfo?.(nextChar)
              }}
              onAuxClickCharacter={(event) => handleKanjiAuxClick(character, event)}
              onLongPressCharacter={() => onOpenInfo?.(character)}
            />
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
            <KanjiComposition
              character={character}
              compact
              highlightElement={highlightElement}
              onHoverElement={setHighlightElement}
              onOpenCharacter={(nextChar) => onOpenInfo?.(nextChar)}
            />
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
                {wordJlptLevels.length
                  ? ` · ${wordJlptLevels.map((level) => `N${level}`).join('+')}`
                  : ''}
                {complexityFilter ? ' · посильные' : ''}
                {hiddenCount ? ` · скрыто ${hiddenCount}` : ''}
              </p>
            </div>
            <div className="kanji-words-head-actions">
              {hiddenCount && onRestoreHiddenWords ? (
                <button
                  type="button"
                  className="text-button"
                  data-testid="kanji-restore-hidden-words"
                  onClick={onRestoreHiddenWords}
                >
                  Вернуть скрытые
                </button>
              ) : null}
              {activeWord ? (
                <p className="kanji-word-progress">
                  {wordIndex + 1} / {words.length}
                </p>
              ) : null}
            </div>
          </div>

          {!activeWord ? (
            <div className="kanji-panel-body chart-empty" data-testid="kanji-no-words">
              {hiddenCount
                ? 'Все слова скрыты. Нажмите «Вернуть скрытые» или отключите фильтр.'
                : 'Подходящих слов нет. Ослабьте фильтр JLPT / сложности или отметьте больше соседних знаков.'}
            </div>
          ) : (
            <>
              <div
                className={`kanji-panel-body kanji-word-stage ${revealed ? 'is-revealed' : ''}`}
                data-testid="kanji-word-card"
              >
                <KanjiWritingHotspots
                  writing={activeWord.writing}
                  focusKanji={character}
                  className="kanji-word-writing"
                  writingTestId="kanji-word-writing"
                  onOpenInfo={onOpenInfo}
                />

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
                  <ShortcutNote
                    className="kanji-word-hint"
                    keyboard={<>Пробел — показать или скрыть чтение и перевод · ←/→ слова</>}
                    swipe={<>Свайп вниз — показать/скрыть · влево/вправо — слова</>}
                  />
                )}
              </div>

              <div className="kanji-panel-footer kanji-word-actions">
                <button type="button" className="ghost-button" data-testid="kanji-prev-word" onClick={prev}>
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
                <button type="button" className="ghost-button" data-testid="kanji-next-word" onClick={next}>
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
                {activeWord.id && onHideWord ? (
                  <button
                    type="button"
                    className="ghost-button"
                    data-testid="kanji-hide-word"
                    title="Убрать это слово из набора для текущего кандзи"
                    onClick={() => onHideWord(activeWord.id!)}
                  >
                    Убрать
                  </button>
                ) : null}
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  )
}
