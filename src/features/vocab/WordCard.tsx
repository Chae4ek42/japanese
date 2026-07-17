import type { KanjiWord } from '../../shared/lib/types'
import { speakJapanese } from '../../shared/lib/speech'

export interface WordCardProps {
  word: KanjiWord
  isSaved: boolean
  onToggleSaved: (wordId: string) => void
}

function writingSizeClass(writing: string): string {
  const length = Array.from(writing).length
  if (length <= 2) return 'is-short'
  if (length <= 4) return 'is-medium'
  if (length <= 6) return 'is-long'
  return 'is-xl'
}

export function WordCard({ word, isSaved, onToggleSaved }: WordCardProps) {
  const wordId = word.id
  const jlptLabel = word.jlpt ? `N${word.jlpt}` : 'вне JLPT'

  return (
    <article className="vocab-word" data-testid={`vocab-word-${word.writing}`}>
      <div className="vocab-word-glyph" aria-hidden="true">
        <span className={`vocab-word-writing ${writingSizeClass(word.writing)}`}>{word.writing}</span>
      </div>

      <div className="vocab-word-main">
        <div className="vocab-word-meta">
          <span className={`vocab-word-badge${word.jlpt ? ` is-n${word.jlpt}` : ' is-other'}`}>{jlptLabel}</span>
          {word.romaji ? <span className="vocab-word-romaji">{word.romaji}</span> : null}
        </div>
        <p className="vocab-word-kana">
          <span className="vocab-word-label">чтение</span>
          {word.kana}
        </p>
        <ul className="vocab-word-meanings">
          <li className="vocab-word-label">значение</li>
          {(word.meanings.length ? word.meanings.slice(0, 3) : ['—']).map((meaning) => (
            <li key={meaning}>{meaning}</li>
          ))}
        </ul>
      </div>

      <div className="vocab-word-actions">
        <button
          type="button"
          className="vocab-icon-button"
          data-testid={`vocab-speak-${word.writing}`}
          aria-label={`Озвучить ${word.writing}`}
          onClick={() => speakJapanese(word.kana || word.writing)}
        >
          ▶︎
        </button>
        {wordId ? (
          <button
            type="button"
            className={isSaved ? 'vocab-save-button is-saved' : 'vocab-save-button'}
            data-testid={`vocab-toggle-${wordId}`}
            onClick={() => onToggleSaved(wordId)}
          >
            {isSaved ? 'В моих' : '+ В мои'}
          </button>
        ) : null}
      </div>
    </article>
  )
}
