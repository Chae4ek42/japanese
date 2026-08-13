import type { KanjiWord } from '../../shared/lib/types'
import { isCustomWordId } from './customWords'
import { wordReadings, wordVariantIds } from './mergeHomographs'
import { WordActions } from './WordActions'

export interface WordCardProps {
  word: KanjiWord
  isSaved: boolean
  onToggleSaved: (word: KanjiWord) => void
  onEdit?: (word: KanjiWord) => void
  /** When set, shows «Выученные» checkbox (my-words list). */
  isLearned?: boolean
  onToggleLearned?: (word: KanjiWord) => void
  inTrainingList?: boolean
  onToggleTraining?: (word: KanjiWord) => void
}

function writingSizeClass(writing: string): string {
  const length = Array.from(writing).length
  if (length <= 2) return 'is-short'
  if (length <= 4) return 'is-medium'
  if (length <= 6) return 'is-long'
  return 'is-xl'
}

export function WordCard({
  word,
  isSaved,
  onToggleSaved,
  onEdit,
  isLearned = false,
  onToggleLearned,
  inTrainingList = false,
  onToggleTraining,
}: WordCardProps) {
  const readings = wordReadings(word)
  const variantIds = wordVariantIds(word)
  const wordId = word.id ?? variantIds[0]
  const custom = isCustomWordId(wordId)
  const badgeLabel = custom ? 'своё' : word.jlpt ? `N${word.jlpt}` : 'вне JLPT'
  const badgeClass = custom ? ' is-custom' : word.jlpt ? ` is-n${word.jlpt}` : ' is-other'
  const multi = readings.length > 1
  const speakKana = readings[0]?.kana || word.kana || word.writing

  return (
    <article
      className={isLearned ? 'vocab-word is-learned' : 'vocab-word'}
      data-testid={`vocab-word-${word.writing}`}
    >
      <div className="vocab-word-glyph" aria-hidden="true">
        <span className={`vocab-word-writing ${writingSizeClass(word.writing)}`}>{word.writing}</span>
      </div>

      <div className="vocab-word-main">
        <div className="vocab-word-meta">
          <span className={`vocab-word-badge${badgeClass}`}>{badgeLabel}</span>
          {!multi && word.romaji ? <span className="vocab-word-romaji">{readings[0]?.romaji || word.romaji}</span> : null}
          {multi ? <span className="vocab-word-romaji">{readings.length} чтения</span> : null}
        </div>

        {multi ? (
          <ul className="vocab-word-readings" data-testid={`vocab-readings-${word.writing}`}>
            {readings.map((reading) => (
              <li key={`${reading.kana}-${reading.romaji}`} className="vocab-word-reading">
                <p className="vocab-word-kana">
                  <span className="vocab-word-label">чтение</span>
                  {reading.kana}
                  {reading.romaji ? <span className="vocab-word-romaji-inline">{reading.romaji}</span> : null}
                </p>
                <ul className="vocab-word-meanings">
                  <li className="vocab-word-label">значение</li>
                  {(reading.meanings.length ? reading.meanings.slice(0, 3) : ['—']).map((meaning) => (
                    <li key={meaning}>{meaning}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="vocab-word-kana">
              <span className="vocab-word-label">чтение</span>
              {readings[0]?.kana || word.kana}
            </p>
            <ul className="vocab-word-meanings">
              <li className="vocab-word-label">значение</li>
              {(readings[0]?.meanings.length
                ? readings[0].meanings.slice(0, 3)
                : word.meanings.length
                  ? word.meanings.slice(0, 3)
                  : ['—']
              ).map((meaning) => (
                <li key={meaning}>{meaning}</li>
              ))}
            </ul>
          </>
        )}

        {onToggleLearned ? (
          <label className="vocab-learned-toggle" data-testid={`vocab-learned-${wordId}`}>
            <input type="checkbox" checked={isLearned} onChange={() => onToggleLearned(word)} />
            Выученные
          </label>
        ) : null}
      </div>

      <WordActions
        word={word}
        isSaved={isSaved}
        onToggleSaved={onToggleSaved}
        onEdit={onEdit}
        inTrainingList={inTrainingList}
        onToggleTraining={onToggleTraining}
        speakKana={speakKana}
      />
    </article>
  )
}
