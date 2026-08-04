import { useState } from 'react'
import type { KanjiWord } from '../../shared/lib/types'
import { speakJapanese } from '../../shared/lib/speech'
import { HighlightedReading } from '../kanji/HighlightedReading'
import { KanjiWritingHotspots } from '../kanji/KanjiWritingHotspots'
import { isCustomWordId } from './customWords'
import { wordReadings, wordVariantIds } from './mergeHomographs'

export interface DictionaryWordListProps {
  words: KanjiWord[]
  isSaved: (word: KanjiWord) => boolean
  onToggleSaved: (word: KanjiWord) => void
  onEdit?: (word: KanjiWord) => void
  isLearned?: (word: KanjiWord) => boolean
  onToggleLearned?: (word: KanjiWord) => void
  inTrainingList?: (word: KanjiWord) => boolean
  onToggleTraining?: (word: KanjiWord) => void
}

function focusChar(writing: string): string {
  for (const ch of writing) {
    if (/\p{Script=Han}/u.test(ch)) return ch
  }
  return writing[0] ?? ''
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
}: DictionaryWordListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <ul className="kanji-word-list vocab-dict-list" data-testid="vocab-list">
      {words.map((word) => {
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
          (primary?.meanings.length ? primary.meanings : word.meanings)
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
                <span className="kanji-word-list-writing">
                  <KanjiWritingHotspots writing={word.writing} kana={word.kana} interactive={false} />
                </span>
                <div className="kanji-word-list-body">
                  <HighlightedReading
                    writing={word.writing}
                    kana={word.kana}
                    focusKanji={focusChar(word.writing)}
                    fallbackRomaji={word.romaji}
                  />
                  <p className="kanji-word-list-meaning" title={meaningLine}>
                    {meaningLine}
                  </p>
                </div>
                <span className="kanji-word-list-tag vocab-dict-tag">
                  <span className="vocab-dict-badge">{tagLabel}</span>
                  {readings.length > 1 ? (
                    <span className="vocab-dict-multi">{readings.length}</span>
                  ) : null}
                </span>
              </button>

              <div className="vocab-dict-row-actions">
                <button
                  type="button"
                  className="vocab-icon-button"
                  data-testid={`vocab-speak-${word.writing}`}
                  aria-label={`Озвучить ${word.writing}`}
                  onClick={() => speakJapanese(speakKana)}
                >
                  ▶︎
                </button>
                {wordId ? (
                  <button
                    type="button"
                    className={saved ? 'vocab-save-button is-saved' : 'vocab-save-button'}
                    data-testid={`vocab-toggle-${wordId}`}
                    onClick={() => onToggleSaved(word)}
                  >
                    {custom ? 'Удалить' : saved ? 'В моих' : '+ В мои'}
                  </button>
                ) : null}
              </div>
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
                      />
                    ))
                  ) : (
                    <HighlightedReading
                      writing={word.writing}
                      kana={word.kana}
                      focusKanji={focusChar(word.writing)}
                      fallbackRomaji={word.romaji}
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
                <div className="kanji-word-detail-actions">
                  {onToggleLearned ? (
                    <label className="vocab-learned-toggle" data-testid={`vocab-learned-${wordId}`}>
                      <input type="checkbox" checked={learned} onChange={() => onToggleLearned(word)} />
                      Выученные
                    </label>
                  ) : null}
                  {onToggleTraining ? (
                    <button
                      type="button"
                      className={training ? 'ghost-button is-active' : 'ghost-button'}
                      data-testid={`vocab-training-${wordId}`}
                      onClick={() => onToggleTraining(word)}
                    >
                      {training ? 'В наборе' : '+ В набор'}
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
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
