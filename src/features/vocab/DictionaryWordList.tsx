import { useEffect, useState, type ReactNode } from 'react'
import type { KanjiWord } from '../../shared/lib/types'
import { HighlightedReading } from '../kanji/HighlightedReading'
import { isCustomWordId } from './customWords'
import { preferLexicalMeanings, wordReadings, wordVariantIds } from './mergeHomographs'
import { WordActions } from './WordActions'

const NARROW_QUERY = '(max-width: 900px)'

export interface DictionaryWordListProps {
  words: KanjiWord[]
  isSaved: (word: KanjiWord) => boolean
  onToggleSaved: (word: KanjiWord) => void
  onEdit?: (word: KanjiWord) => void
  isLearned?: (word: KanjiWord) => boolean
  onToggleLearned?: (word: KanjiWord) => void
  inTrainingList?: (word: KanjiWord) => boolean
  onToggleTraining?: (word: KanjiWord) => void
  onRemoveProblem?: (word: KanjiWord) => void
}

function focusChar(writing: string): string {
  for (const ch of writing) {
    if (/\p{Script=Han}/u.test(ch)) return ch
  }
  return writing[0] ?? ''
}

function splitColumns(words: KanjiWord[]): [KanjiWord[], KanjiWord[]] {
  const left: KanjiWord[] = []
  const right: KanjiWord[] = []
  for (let i = 0; i < words.length; i += 1) {
    if (i % 2 === 0) left.push(words[i]!)
    else right.push(words[i]!)
  }
  return [left, right]
}

export function DictionaryWordList({
  words,
  isSaved,
  onToggleSaved,
  onEdit,
  isLearned,
  onToggleLearned,
  inTrainingList,
  onToggleTraining,
  onRemoveProblem,
}: DictionaryWordListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(NARROW_QUERY).matches
      : false,
  )
  const [leftWords, rightWords] = splitColumns(words)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function renderWord(word: KanjiWord): ReactNode {
    const readings = wordReadings(word)
    const variantIds = wordVariantIds(word)
    const wordId = word.id ?? variantIds[0] ?? `${word.writing}-${word.kana}`
    const custom = isCustomWordId(wordId)
    const saved = isSaved(word)
    const learned = isLearned?.(word) ?? false
    const training = inTrainingList?.(word) ?? false
    const expanded = expandedId === wordId
    const primary = readings[0]
    const meaningLine =
      preferLexicalMeanings(primary?.meanings.length ? primary.meanings : word.meanings)
        .slice(0, 2)
        .map((meaning) => meaning.replace(/^\d+\)\s*/, ''))
        .join(' · ') || '—'
    const tagLabel = custom ? 'своё' : word.jlpt ? `N${word.jlpt}` : '—'
    const speakKana = primary?.kana || word.kana || word.writing

    return (
      <li
        key={wordId}
        className={[
          'kanji-word-list-item',
          expanded ? 'is-expanded' : '',
          learned ? 'is-learned' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-testid={`vocab-word-${word.writing}`}
      >
        <div className="vocab-dict-row">
          <button
            type="button"
            className="kanji-word-list-main"
            aria-expanded={expanded}
            onClick={() => setExpandedId((prev) => (prev === wordId ? null : wordId))}
          >
            <span className="kanji-word-list-writing">{word.writing}</span>
            <div className="kanji-word-list-body">
              <HighlightedReading
                writing={word.writing}
                kana={word.kana}
                focusKanji={focusChar(word.writing)}
                fallbackRomaji={word.romaji}
                colorize
              />
              <p className="kanji-word-list-meaning" title={meaningLine}>
                {meaningLine}
              </p>
            </div>
            <span className="kanji-word-list-tag vocab-dict-tag">
              <span className="vocab-dict-badge">{tagLabel}</span>
              {readings.length > 1 ? (
                <span className="vocab-dict-multi" title={`${readings.length} чтения`}>
                  {readings.length} чт.
                </span>
              ) : null}
            </span>
          </button>

          <WordActions
            word={word}
            isSaved={saved}
            onToggleSaved={onToggleSaved}
            inTrainingList={training}
            onToggleTraining={onToggleTraining}
            isLearned={learned}
            onToggleLearned={onToggleLearned}
            speakKana={speakKana}
            className="vocab-dict-row-actions"
          />
        </div>

        {expanded ? (
          <div className="kanji-word-detail" data-testid={`vocab-word-detail-${word.writing}`}>
            <div className="kanji-word-detail-readings">
              {readings.length > 1 ? (
                readings.map((reading) => (
                  <HighlightedReading
                    key={`${reading.kana}-${reading.romaji}`}
                    writing={word.writing}
                    kana={reading.kana}
                    focusKanji={focusChar(word.writing)}
                    fallbackRomaji={reading.romaji}
                    colorize
                  />
                ))
              ) : (
                <HighlightedReading
                  writing={word.writing}
                  kana={word.kana}
                  focusKanji={focusChar(word.writing)}
                  fallbackRomaji={word.romaji}
                  colorize
                />
              )}
            </div>
            <ul className="kanji-word-detail-meanings">
              {(primary?.meanings.length ? primary.meanings : word.meanings.length ? word.meanings : ['—']).map(
                (meaning) => (
                  <li key={meaning}>{meaning}</li>
                ),
              )}
            </ul>
            {onRemoveProblem || (custom && onEdit) ? (
              <div className="kanji-word-detail-actions">
                {onRemoveProblem ? (
                  <button
                    type="button"
                    className="ghost-button"
                    data-testid={`vocab-problem-remove-${wordId}`}
                    onClick={() => onRemoveProblem(word)}
                  >
                    Убрать из проблемных
                  </button>
                ) : null}
                {custom && onEdit ? (
                  <button
                    type="button"
                    className="ghost-button"
                    data-testid={`vocab-edit-${wordId}`}
                    onClick={() => onEdit(word)}
                  >
                    Изменить
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </li>
    )
  }

  if (narrow) {
    return (
      <div className="vocab-dict-columns is-narrow" data-testid="vocab-list">
        <ul className="kanji-word-list vocab-dict-list">{words.map(renderWord)}</ul>
      </div>
    )
  }

  return (
    <div className="vocab-dict-columns" data-testid="vocab-list">
      <ul className="kanji-word-list vocab-dict-list">{leftWords.map(renderWord)}</ul>
      {rightWords.length ? (
        <ul className="kanji-word-list vocab-dict-list">{rightWords.map(renderWord)}</ul>
      ) : null}
    </div>
  )
}
