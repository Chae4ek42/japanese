import type { KanjiWord } from '../../shared/lib/types'
import { speakJapanese } from '../../shared/lib/speech'
import { isCustomWordId } from './customWords'
import { wordVariantIds } from './mergeHomographs'

export interface WordActionsProps {
  word: KanjiWord
  isSaved: boolean
  onToggleSaved: (word: KanjiWord) => void
  onEdit?: (word: KanjiWord) => void
  inTrainingList?: boolean
  onToggleTraining?: (word: KanjiWord) => void
  isLearned?: boolean
  onToggleLearned?: (word: KanjiWord) => void
  speakKana?: string
  showSpeak?: boolean
  className?: string
}

/** Mine / training-set / speak / edit buttons shared by dictionary cards. */
export function WordActions({
  word,
  isSaved,
  onToggleSaved,
  onEdit,
  inTrainingList = false,
  onToggleTraining,
  isLearned = false,
  onToggleLearned,
  speakKana,
  showSpeak = true,
  className = 'vocab-word-actions',
}: WordActionsProps) {
  const variantIds = wordVariantIds(word)
  const wordId = word.id ?? variantIds[0]
  const custom = isCustomWordId(wordId)
  const kana = speakKana || word.kana || word.writing

  return (
    <div className={className}>
      {showSpeak ? (
      <button
        type="button"
        className="vocab-icon-button"
        data-testid={`vocab-speak-${word.writing}`}
        aria-label={`Озвучить ${word.writing}`}
        onClick={() => speakJapanese(kana)}
      >
        ▶︎
      </button>
      ) : null}
      {custom && wordId && onEdit ? (
        <button
          type="button"
          className="vocab-save-button"
          data-testid={`vocab-edit-${wordId}`}
          onClick={() => onEdit(word)}
        >
          Изменить
        </button>
      ) : null}
      {wordId && onToggleTraining ? (
        <button
          type="button"
          className={inTrainingList ? 'vocab-save-button is-saved' : 'vocab-save-button'}
          data-testid={`vocab-training-${wordId}`}
          onClick={() => onToggleTraining(word)}
        >
          {inTrainingList ? 'В наборе' : '+ В набор'}
        </button>
      ) : null}
      {wordId ? (
        <button
          type="button"
          className={isSaved ? 'vocab-save-button is-saved' : 'vocab-save-button'}
          data-testid={`vocab-toggle-${wordId}`}
          onClick={() => onToggleSaved(word)}
        >
          {custom ? 'Удалить' : isSaved ? 'В моих' : '+ В мои'}
        </button>
      ) : null}
      {wordId && onToggleLearned ? (
        <button
          type="button"
          className={isLearned ? 'vocab-save-button is-saved' : 'vocab-save-button'}
          data-testid={`vocab-learned-${wordId}`}
          aria-pressed={isLearned}
          aria-label={
            isLearned
              ? `Убрать ${word.writing} из выученных`
              : `Добавить ${word.writing} в выученные`
          }
          onClick={() => onToggleLearned(word)}
        >
          {isLearned ? 'Выучено' : '+ Выуч.'}
        </button>
      ) : null}
    </div>
  )
}
