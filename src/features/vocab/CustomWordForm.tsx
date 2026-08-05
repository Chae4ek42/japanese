import { useEffect, useState, type FormEvent } from 'react'
import type { KanjiWord } from '../../shared/lib/types'
import { buildCustomWord, meaningsToInput } from './customWords'

export interface CustomWordFormProps {
  editingWord?: KanjiWord | null
  onSave: (word: KanjiWord) => void
  onCancelEdit?: () => void
}

const EMPTY = {
  writing: '',
  kana: '',
  romaji: '',
  meanings: '',
}

export function CustomWordForm({ editingWord = null, onSave, onCancelEdit }: CustomWordFormProps) {
  const [fields, setFields] = useState(EMPTY)
  const [error, setError] = useState('')
  const isEditing = Boolean(editingWord?.id)

  useEffect(() => {
    if (editingWord) {
      setFields({
        writing: editingWord.writing,
        kana: editingWord.kana,
        romaji: editingWord.romaji,
        meanings: meaningsToInput(editingWord.meanings),
      })
      setError('')
      return
    }
    setFields(EMPTY)
    setError('')
  }, [editingWord])

  function update(key: keyof typeof EMPTY, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    if (error) setError('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const word = buildCustomWord({
      ...fields,
      id: editingWord?.id,
    })
    if (!word) {
      setError('Заполните кандзи, кану, ромадзи и хотя бы одно значение.')
      return
    }
    onSave(word)
    if (!isEditing) {
      setFields(EMPTY)
    }
    setError('')
  }

  return (
    <form
      className={isEditing ? 'custom-word-form is-editing' : 'custom-word-form'}
      data-testid="custom-word-form"
      onSubmit={handleSubmit}
    >
      {isEditing ? (
        <p className="vocab-note" data-testid="custom-word-editing-label">
          Редактирование: {editingWord?.writing}
        </p>
      ) : null}
      <div className="custom-word-grid">
        <label>
          Кандзи / написание
          <input
            data-testid="custom-word-writing"
            value={fields.writing}
            onChange={(event) => update('writing', event.target.value)}
            placeholder="日本語"
            autoComplete="off"
          />
        </label>
        <label>
          Кана
          <input
            data-testid="custom-word-kana"
            value={fields.kana}
            onChange={(event) => update('kana', event.target.value)}
            placeholder="にほんご"
            autoComplete="off"
          />
        </label>
        <label>
          Ромадзи
          <input
            data-testid="custom-word-romaji"
            value={fields.romaji}
            onChange={(event) => update('romaji', event.target.value)}
            placeholder="nihongo"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="custom-word-wide">
          Значения
          <input
            data-testid="custom-word-meanings"
            value={fields.meanings}
            onChange={(event) => update('meanings', event.target.value)}
            placeholder="японский язык, японский"
            autoComplete="off"
          />
        </label>
      </div>
      {error ? (
        <p className="vocab-note" data-testid="custom-word-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="vocab-note">Несколько значений можно перечислить через запятую.</p>
      )}
      <div className="custom-word-actions">
        <button type="submit" className="secondary-button" data-testid="custom-word-submit">
          {isEditing ? 'Сохранить' : 'Добавить слово'}
        </button>
        {onCancelEdit ? (
          <button
            type="button"
            className="text-button"
            data-testid="custom-word-cancel"
            onClick={onCancelEdit}
          >
            Отмена
          </button>
        ) : null}
      </div>
    </form>
  )
}
