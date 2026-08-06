import type { FormEvent } from 'react'
import type { KanjiPreferences, KanjiWord, KanjiWordJlptLevel } from '../../shared/lib/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getKanjiInfo,
  getPracticeWords,
  POPULAR_WORDS_PER_KANJI,
} from '../../data/words/bank'
import { formatKanjiReadings } from '../../shared/lib/format'
import { speakJapanese, speakKanjiReadings } from '../../shared/lib/speech'
import { useSwipeGestures } from '../../shared/lib/useSwipeGestures'
import {
  applyLocalWordEdits,
  buildWordFromReadings,
  cardToReadingDrafts,
  createReadingDraft,
  type ReadingDraft,
} from '../vocab/customWords'
import { mergeWordsByWriting, wordVariantIds } from '../vocab/mergeHomographs'
import { GlossFootnotes } from './GlossFootnotes'
import { HighlightedReading } from './HighlightedReading'
import { KanjiComposition } from './KanjiComposition'
import { KanjiGlyph } from './KanjiGlyph'
import { isKanjiChar } from './KanjiWritingHotspots'
import { WordJlptFilter } from './WordJlptFilter'

export interface KanjiTrainerProps {
  character: string
  learned: string[]
  wordJlptLevels?: KanjiWordJlptLevel[]
  hiddenWordIds?: string[]
  myWords: string[]
  trainingWordIds?: string[]
  customWords?: Record<string, KanjiWord>
  onPatchPreferences: (patch: Partial<KanjiPreferences>) => void
  onHideWord?: (wordId: string) => void
  onRestoreHiddenWords?: () => void
  onToggleLearned: (character: string) => void
  onToggleMyWord: (wordId: string) => void
  onToggleTrainingWord?: (wordId: string) => void
  onSaveWordEdit?: (word: KanjiWord) => void
  onBack: () => void
  onOpenInfo?: (character: string) => void
  /** Navigate within the current filter list. */
  onPrevKanji?: () => void
  onNextKanji?: () => void
  canGoPrev?: boolean
  canGoNext?: boolean
}

function wordKey(word: KanjiWord): string {
  return word.id ?? `${word.writing}:${word.kana}`
}

export function KanjiTrainer({
  character,
  learned,
  wordJlptLevels = [],
  hiddenWordIds = [],
  myWords,
  trainingWordIds = [],
  customWords = {},
  onPatchPreferences,
  onHideWord,
  onRestoreHiddenWords,
  onToggleLearned,
  onToggleMyWord,
  onToggleTrainingWord,
  onSaveWordEdit,
  onBack,
  onOpenInfo,
  onPrevKanji,
  onNextKanji,
  canGoPrev = false,
  canGoNext = false,
}: KanjiTrainerProps) {
  const info = getKanjiInfo(character)
  const isLearned = learned.includes(character)
  const trainerRef = useRef<HTMLElement | null>(null)
  const onPrevRef = useRef(onPrevKanji)
  const onNextRef = useRef(onNextKanji)
  onPrevRef.current = onPrevKanji
  onNextRef.current = onNextKanji
  const [highlightElement, setHighlightElement] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editWriting, setEditWriting] = useState('')
  const [editReadings, setEditReadings] = useState<ReadingDraft[]>([])
  const [editError, setEditError] = useState('')
  const [showAllWords, setShowAllWords] = useState(false)
  const mySet = useMemo(() => new Set(myWords), [myWords])
  const trainingSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])
  const wordLimit = showAllWords ? Number.MAX_SAFE_INTEGER : POPULAR_WORDS_PER_KANJI

  const words = useMemo(
    () =>
      applyLocalWordEdits(
        mergeWordsByWriting(
          getPracticeWords(character, {
            excludedIds: hiddenWordIds,
            wordJlptLevels,
            limit: wordLimit,
          }),
        ),
        customWords,
        [],
      ),
    [character, hiddenWordIds, wordJlptLevels, customWords, wordLimit],
  )
  const totalAvailable = useMemo(
    () =>
      getPracticeWords(character, {
        excludedIds: hiddenWordIds,
        wordJlptLevels,
        limit: Number.MAX_SAFE_INTEGER,
      }).length,
    [character, hiddenWordIds, wordJlptLevels],
  )
  const hiddenCount = hiddenWordIds.length
  const expandedWord = words.find((word) => wordKey(word) === expandedKey) ?? null
  const canShowMore = totalAvailable > POPULAR_WORDS_PER_KANJI

  useEffect(() => {
    setExpandedKey(null)
    setEditing(false)
    setEditError('')
    setShowAllWords(false)
  }, [character])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.code === 'ArrowLeft') {
        if (!canGoPrev) return
        event.preventDefault()
        onPrevRef.current?.()
        return
      }
      if (event.code === 'ArrowRight') {
        if (!canGoNext) return
        event.preventDefault()
        onNextRef.current?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canGoPrev, canGoNext])

  const swipesActive = useSwipeGestures(
    trainerRef,
    {
      onSwipeLeft: () => {
        if (canGoPrev) onPrevRef.current?.()
      },
      onSwipeRight: () => {
        if (canGoNext) onNextRef.current?.()
      },
    },
    Boolean(onPrevKanji || onNextKanji),
  )

  useEffect(() => {
    if (!expandedWord) {
      setEditing(false)
      return
    }
    if (!words.some((word) => wordKey(word) === expandedKey)) {
      setExpandedKey(null)
      setEditing(false)
    }
  }, [words, expandedKey, expandedWord])

  function handleKanjiAuxClick(ch: string, event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 1 || !isKanjiChar(ch)) return
    event.preventDefault()
    onOpenInfo?.(ch)
  }

  function toggleExpanded(word: KanjiWord) {
    const key = wordKey(word)
    if (expandedKey === key) {
      setExpandedKey(null)
      setEditing(false)
      setEditError('')
      return
    }
    setExpandedKey(key)
    setEditing(false)
    setEditError('')
  }

  function openEditor(word: KanjiWord) {
    if (!onSaveWordEdit) return
    setEditWriting(word.writing)
    setEditReadings(cardToReadingDrafts(word))
    setEditError('')
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setEditError('')
  }

  function updateReading(key: string, patch: Partial<ReadingDraft>) {
    setEditReadings((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
    if (editError) setEditError('')
  }

  function handleSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (!onSaveWordEdit || !expandedWord) return
    const ids = wordVariantIds(expandedWord)
    const word = buildWordFromReadings({
      writing: editWriting,
      readings: editReadings,
      id: expandedWord.id ?? ids[0],
      jlpt: expandedWord.jlpt,
      variantIds: ids,
      kanji: expandedWord.kanji,
    })
    if (!word) {
      setEditError('Заполните написание и хотя бы одно чтение с каной, ромадзи и значением.')
      return
    }
    onSaveWordEdit(word)
    setExpandedKey(wordKey(word))
    setEditing(false)
    setEditError('')
  }

  return (
    <section
      ref={trainerRef}
      className={`kanji-trainer${swipesActive ? ' has-mobile-swipes' : ''}`}
      data-testid="kanji-trainer"
    >
      <div className="kanji-trainer-toolbar">
        <button type="button" className="text-button" onClick={onBack}>
          ← Все кандзи
        </button>
        <div className="kanji-trainer-nav" role="group" aria-label="Соседние кандзи">
          <button
            type="button"
            className="ghost-button kanji-trainer-nav-button"
            data-testid="kanji-nav-prev"
            disabled={!canGoPrev}
            onClick={() => onPrevKanji?.()}
            title="Предыдущий (←)"
          >
            ←
          </button>
          <button
            type="button"
            className="ghost-button kanji-trainer-nav-button"
            data-testid="kanji-nav-next"
            disabled={!canGoNext}
            onClick={() => onNextKanji?.()}
            title="Следующий (→)"
          >
            →
          </button>
        </div>
        <div className="kanji-trainer-filters">
          <WordJlptFilter
            selected={wordJlptLevels}
            testIdPrefix="kanji-word-jlpt-trainer"
            onChange={(next) => onPatchPreferences({ wordJlptLevels: next })}
          />
          {hiddenCount && onRestoreHiddenWords ? (
            <button
              type="button"
              className="text-button"
              data-testid="kanji-restore-hidden-words"
              onClick={onRestoreHiddenWords}
            >
              Вернуть скрытые ({hiddenCount})
            </button>
          ) : null}
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
              <p className="subsection-note" data-testid="kanji-word-pool-meta">
                {words.length} из {totalAvailable}
                {wordJlptLevels.length
                  ? ` · ${wordJlptLevels.map((level) => `N${level}`).join('+')}`
                  : ''}
                {hiddenCount ? ` · скрыто ${hiddenCount}` : ''}
              </p>
            </div>
            {canShowMore ? (
              <div className="kanji-words-head-actions">
                <button
                  type="button"
                  className="text-button"
                  data-testid="kanji-show-all-words"
                  onClick={() => setShowAllWords((value) => !value)}
                >
                  {showAllWords ? 'Только популярные' : `Показать все (${totalAvailable})`}
                </button>
              </div>
            ) : null}
          </div>

          {!words.length ? (
            <div className="kanji-panel-body chart-empty" data-testid="kanji-no-words">
              {hiddenCount
                ? 'Все слова скрыты. Нажмите «Вернуть скрытые».'
                : 'Подходящих слов нет. Ослабьте фильтр JLPT.'}
            </div>
          ) : (
            <ul className="kanji-word-list" data-testid="kanji-word-list">
              {words.map((word) => {
                const key = wordKey(word)
                const ids = wordVariantIds(word)
                const primaryId = word.id ?? ids[0]
                const inMine = ids.some((id) => mySet.has(id))
                const inTraining = ids.some((id) => trainingSet.has(id))
                const expanded = expandedKey === key
                const meaningLine =
                  word.meanings
                    .slice(0, 2)
                    .map((meaning) => meaning.replace(/^\d+\)\s*/, ''))
                    .join(' · ') || '—'
                return (
                  <li
                    key={key}
                    className={expanded ? 'kanji-word-list-item is-expanded' : 'kanji-word-list-item'}
                    data-testid={`kanji-word-row-${word.writing}`}
                  >
                    <button
                      type="button"
                      className="kanji-word-list-main"
                      aria-expanded={expanded}
                      data-testid={`kanji-word-open-${word.writing}`}
                      onClick={() => toggleExpanded(word)}
                    >
                      <span className="kanji-word-list-writing" data-testid="kanji-word-writing">
                        {word.writing}
                      </span>
                      <div className="kanji-word-list-body">
                        <HighlightedReading
                          writing={word.writing}
                          kana={word.kana}
                          focusKanji={character}
                          fallbackRomaji={word.romaji}
                          testId="kanji-word-kana"
                        />
                        <p className="kanji-word-list-meaning" data-testid="kanji-word-meanings" title={meaningLine}>
                          {meaningLine}
                        </p>
                      </div>
                      <span className="kanji-word-list-tag">
                        {word.jlpt ? `N${word.jlpt}` : '—'}
                        {word.readings && word.readings.length > 1 ? ` · ${word.readings.length}` : ''}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="kanji-word-detail" data-testid="kanji-word-detail">
                        {editing && onSaveWordEdit ? (
                          <form
                            className="kanji-word-editor"
                            data-testid="kanji-word-editor"
                            onSubmit={handleSaveEdit}
                          >
                            <label className="kanji-word-edit-writing">
                              Написание
                              <input
                                data-testid="kanji-word-edit-writing"
                                value={editWriting}
                                onChange={(event) => {
                                  setEditWriting(event.target.value)
                                  if (editError) setEditError('')
                                }}
                                autoComplete="off"
                              />
                            </label>
                            <div className="kanji-word-edit-readings">
                              {editReadings.map((reading, index) => (
                                <fieldset
                                  key={reading.key}
                                  className="kanji-word-edit-reading"
                                  data-testid={`kanji-word-edit-reading-${index}`}
                                >
                                  <legend>Чтение {index + 1}</legend>
                                  <div className="kanji-word-edit-grid">
                                    <label>
                                      Кана
                                      <input
                                        data-testid={`kanji-word-edit-kana-${index}`}
                                        value={reading.kana}
                                        onChange={(event) =>
                                          updateReading(reading.key, { kana: event.target.value })
                                        }
                                        autoComplete="off"
                                      />
                                    </label>
                                    <label>
                                      Ромадзи
                                      <input
                                        data-testid={`kanji-word-edit-romaji-${index}`}
                                        value={reading.romaji}
                                        onChange={(event) =>
                                          updateReading(reading.key, { romaji: event.target.value })
                                        }
                                        autoComplete="off"
                                        spellCheck={false}
                                      />
                                    </label>
                                    <label className="kanji-word-edit-wide">
                                      Значения
                                      <textarea
                                        data-testid={`kanji-word-edit-meanings-${index}`}
                                        value={reading.meanings}
                                        onChange={(event) =>
                                          updateReading(reading.key, { meanings: event.target.value })
                                        }
                                        rows={2}
                                        autoComplete="off"
                                      />
                                    </label>
                                  </div>
                                  {editReadings.length > 1 ? (
                                    <button
                                      type="button"
                                      className="text-button"
                                      onClick={() =>
                                        setEditReadings((prev) =>
                                          prev.filter((item) => item.key !== reading.key),
                                        )
                                      }
                                    >
                                      Убрать чтение
                                    </button>
                                  ) : null}
                                </fieldset>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="ghost-button"
                              data-testid="kanji-word-edit-add-reading"
                              onClick={() => setEditReadings((prev) => [...prev, createReadingDraft()])}
                            >
                              + Ещё чтение
                            </button>
                            {editError ? (
                              <p className="feedback is-error" role="alert">
                                {editError}
                              </p>
                            ) : null}
                            <div className="kanji-word-detail-actions">
                              <button type="submit" className="secondary-button" data-testid="kanji-word-edit-save">
                                Сохранить
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                data-testid="kanji-word-edit-cancel"
                                onClick={closeEditor}
                              >
                                Отмена
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="kanji-word-detail-readings">
                              <HighlightedReading
                                writing={word.writing}
                                kana={word.kana}
                                focusKanji={character}
                                fallbackRomaji={word.romaji}
                              />
                            </div>
                            <ul className="kanji-word-detail-meanings" data-testid="kanji-word-detail-meanings">
                              {word.meanings.map((meaning) => (
                                <li key={meaning}>{meaning}</li>
                              ))}
                            </ul>
                            <GlossFootnotes meanings={word.meanings} />
                            <div className="kanji-word-detail-actions">
                              <button
                                type="button"
                                className="ghost-button"
                                data-testid="kanji-speak-word"
                                onClick={() => speakJapanese(word.kana || word.writing)}
                              >
                                ▶ Прослушать
                              </button>
                              {primaryId && onToggleTrainingWord ? (
                                <button
                                  type="button"
                                  className={inTraining ? 'primary-button' : 'ghost-button'}
                                  data-testid={`kanji-train-word-${primaryId}`}
                                  onClick={() => {
                                    for (const id of ids) {
                                      if (inTraining === trainingSet.has(id)) onToggleTrainingWord(id)
                                    }
                                  }}
                                >
                                  {inTraining ? 'В наборе' : '+ В набор'}
                                </button>
                              ) : null}
                              {primaryId ? (
                                <button
                                  type="button"
                                  className={inMine ? 'primary-button' : 'ghost-button'}
                                  data-testid="kanji-save-word"
                                  onClick={() => onToggleMyWord(primaryId)}
                                >
                                  {inMine ? 'В моих' : '+ В мои'}
                                </button>
                              ) : null}
                              {onSaveWordEdit ? (
                                <button
                                  type="button"
                                  className="ghost-button"
                                  data-testid="kanji-word-edit"
                                  onClick={() => openEditor(word)}
                                >
                                  Изменить
                                </button>
                              ) : null}
                              {primaryId && onHideWord ? (
                                <button
                                  type="button"
                                  className="ghost-button"
                                  data-testid="kanji-hide-word"
                                  onClick={() => {
                                    for (const id of ids) onHideWord(id)
                                    setExpandedKey(null)
                                  }}
                                >
                                  Убрать
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}
