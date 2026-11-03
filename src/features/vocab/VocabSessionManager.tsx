import { useState } from 'react'
import type { VocabTrainingSession, VocabTrainingSet } from '../../shared/lib/types'
import { getTrainingSet, resolveActiveTrainingSetId } from '../../shared/lib/trainingSets'
import { getVocabGroup } from './groups'
import { trainingSessionPoolLabel } from './trainingSessions'
import './sessions.css'

interface Props {
  sessions: VocabTrainingSession[]
  trainingSets: VocabTrainingSet[]
  onCreate: () => void
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function VocabSessionManager({ sessions, trainingSets, onCreate, onOpen, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  return (
    <section className="vocab-sessions" aria-label="Тренировки слов">
      <div className="vocab-sessions-intro">
        <div>
          <h3>Ваши тренировки</h3>
          <p>Продолжите с того же слова или начните новую тренировку.</p>
        </div>
        <button className="vocab-session-create" data-testid="new-vocab-session" type="button" onClick={onCreate}>+ Новая тренировка</button>
      </div>
      {!sessions.length ? <p className="vocab-sessions-empty">Здесь появятся сохранённые тренировки. Настройки и место в каждой сохраняются отдельно.</p> : null}
      <div className="vocab-session-list">
        {[...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map((session) => {
          const live = session.liveSession
          const preferences = session.preferences
          let poolLabel = trainingSessionPoolLabel(preferences)
          if (live?.session.targetedIds?.length) poolLabel = 'Выбранные слова'
          else if (preferences.sessionMode !== 'adaptive') {
            if (preferences.source === 'list') {
              poolLabel = `Набор: ${getTrainingSet(trainingSets, resolveActiveTrainingSetId(preferences.trainingSetId, trainingSets))?.name ?? 'Основной'}`
            } else if (preferences.source === 'group') {
              poolLabel = getVocabGroup(preferences.groupId)?.label ?? poolLabel
            } else if (preferences.source === 'kanji' && preferences.selectedKanji.length) {
              poolLabel = `Кандзи: ${preferences.selectedKanji.join(' · ')}`
            }
          }
          return (
            <article key={session.id} className="vocab-session-card" data-testid="vocab-session-card">
              {editingId === session.id ? (
                <form className="vocab-session-rename" onSubmit={(event) => {
                  event.preventDefault()
                  if (!name.trim()) return
                  onRename(session.id, name)
                  setEditingId(null)
                }}>
                  <input aria-label="Название тренировки" value={name} maxLength={64} autoFocus onChange={(event) => setName(event.target.value)} />
                  <button type="submit" disabled={!name.trim()}>Сохранить</button>
                  <button type="button" onClick={() => setEditingId(null)}>Отмена</button>
                </form>
              ) : <h4>{session.name}</h4>}
              <div className="vocab-session-details">
                <span className={session.preferences.sessionMode === 'adaptive' ? 'vocab-session-mode review' : 'vocab-session-mode'}>
                  {session.preferences.sessionMode === 'adaptive' ? 'Повторение' : 'Равномерная'}
                </span>
                <span>{poolLabel}</span>
                {session.preferences.sessionMode === 'adaptive' ? <span>Окно: {session.preferences.reviewWindowSize}</span> : null}
              </div>
              <p className="vocab-session-progress">
                {live ? `${live.session.poolIds.length} слов · ${live.sessionStats.answered} ответов · ${live.sessionStats.clean} верных` : 'Готова к настройке'}
              </p>
              <div className="vocab-session-actions">
                <button type="button" className="vocab-session-open" onClick={() => onOpen(session.id)}>{live ? 'Продолжить' : 'Открыть'}</button>
                <button type="button" onClick={() => { setEditingId(session.id); setName(session.name) }}>Переименовать</button>
                <button type="button" className="vocab-session-delete" aria-label={`Удалить тренировку ${session.name}`} onClick={() => onDelete(session.id)}>Удалить</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
