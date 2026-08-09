import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { AppPage, VocabTrainingSet } from '../lib/types'
import { MAIN_TRAINING_SET_ID } from '../lib/trainingSets'
import { useVocabState } from '../state/AppStateContext'
import { AUTOSTART_TRAIN_KEY } from '../../features/vocab/autostart'
import { wordVariantIds } from '../../features/vocab/mergeHomographs'
import { resolveTrainingListWords } from '../../features/vocab/pool'

export function TrainingSetsMenu({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const vocab = useVocabState()
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (renameId) {
          setRenameId(null)
          return
        }
        if (expandedId) {
          setExpandedId(null)
          return
        }
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, renameId, expandedId])

  const customWords = vocab?.customWords ?? {}
  const hiddenWordIds = vocab?.hiddenWordIds ?? []
  const trainingSets = vocab?.trainingSets ?? []

  const expandedWords = useMemo(() => {
    if (!expandedId) return []
    const set = trainingSets.find((item) => item.id === expandedId)
    if (!set?.wordIds.length) return []
    return resolveTrainingListWords(set.wordIds, customWords, hiddenWordIds)
  }, [expandedId, trainingSets, customWords, hiddenWordIds])

  if (!vocab) return null

  const {
    activeTrainingSetId,
    activeTrainingSet,
    setActiveTrainingSet,
    createTrainingSet,
    renameTrainingSet,
    deleteTrainingSet,
    moveTrainingWords,
    removeTrainingWords,
    patchPreferences,
  } = vocab

  const activeCount = activeTrainingSet?.wordIds.length ?? 0

  function trainSet(set: VocabTrainingSet) {
    if (!set.wordIds.length) return
    setActiveTrainingSet(set.id)
    patchPreferences({
      sessionMode: 'drill',
      source: 'list',
      trainFullGroup: false,
      trainingSetId: set.id,
    })
    try {
      sessionStorage.setItem(AUTOSTART_TRAIN_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
    onNavigate('train')
  }

  function beginRename(set: VocabTrainingSet) {
    setRenameId(set.id)
    setRenameDraft(set.name)
  }

  function commitRename() {
    if (!renameId) return
    const name = renameDraft.trim()
    if (name) renameTrainingSet(renameId, name)
    setRenameId(null)
  }

  function removeWordFromSet(setId: string, wordIds: string[]) {
    removeTrainingWords(wordIds, setId)
  }

  return (
    <div className="sets-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? 'text-button sets-menu-trigger is-open' : 'text-button sets-menu-trigger'}
        data-testid="training-sets-menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Наборы
        <span className="sets-menu-badge" data-testid="training-sets-active-count">
          {activeCount}
        </span>
      </button>

      {open ? (
        <div
          className="sets-menu-panel"
          id={panelId}
          role="dialog"
          aria-label="Наборы для тренировки"
          data-testid="training-sets-panel"
        >
          <div className="sets-menu-head">
            <p className="sets-menu-title">Наборы</p>
            <button
              type="button"
              className="sets-menu-new"
              data-testid="training-sets-create"
              onClick={() => {
                const id = createTrainingSet({ makeActive: true })
                if (id) setExpandedId(id)
              }}
            >
              + Новый
            </button>
          </div>

          <ul className="sets-menu-list">
            {trainingSets.map((set) => {
              const isActive = set.id === activeTrainingSetId
              const expanded = expandedId === set.id
              return (
                <li
                  key={set.id}
                  className={[
                    'sets-menu-item',
                    isActive ? 'is-active' : '',
                    expanded ? 'is-expanded' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-testid={`training-set-${set.id}`}
                >
                  <div className="sets-menu-row">
                    {renameId === set.id ? (
                      <form
                        className="sets-menu-rename"
                        onSubmit={(event) => {
                          event.preventDefault()
                          commitRename()
                        }}
                      >
                        <input
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          autoFocus
                          maxLength={48}
                          data-testid={`training-set-rename-input-${set.id}`}
                          onBlur={commitRename}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="sets-menu-name"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : set.id)}
                        title={expanded ? 'Свернуть слова' : 'Показать слова'}
                      >
                        <span className="sets-menu-chevron" aria-hidden="true">
                          {expanded ? '▾' : '▸'}
                        </span>
                        <span>{set.name}</span>
                        <span className="sets-menu-count">{set.wordIds.length}</span>
                        {isActive ? <span className="sets-menu-active-tag">активный</span> : null}
                      </button>
                    )}
                  </div>

                  {expanded ? (
                    <div
                      className="sets-menu-words"
                      data-testid={`training-set-words-${set.id}`}
                    >
                      {!set.wordIds.length ? (
                        <p className="sets-menu-preview is-empty">Пусто</p>
                      ) : (
                        <ul className="sets-menu-word-list">
                          {expandedWords.map((word) => {
                            const ids = wordVariantIds(word)
                            const label = word.writing || word.kana || word.id
                            const reading = word.kana && word.kana !== word.writing ? word.kana : ''
                            return (
                              <li key={word.id || label} className="sets-menu-word">
                                <div className="sets-menu-word-copy">
                                  <span className="sets-menu-word-writing">{label}</span>
                                  {reading ? (
                                    <span className="sets-menu-word-reading">{reading}</span>
                                  ) : null}
                                  {word.meanings?.[0] ? (
                                    <span className="sets-menu-word-meaning">{word.meanings[0]}</span>
                                  ) : null}
                                </div>
                                <div className="sets-menu-word-actions">
                                  {set.id !== MAIN_TRAINING_SET_ID ? (
                                    <button
                                      type="button"
                                      title="В основной"
                                      data-testid={`training-set-word-to-main-${word.id}`}
                                      onClick={() =>
                                        moveTrainingWords({
                                          fromSetId: set.id,
                                          toSetId: MAIN_TRAINING_SET_ID,
                                          wordIds: ids,
                                        })
                                      }
                                    >
                                      → осн.
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="is-danger"
                                    title="Убрать из набора"
                                    data-testid={`training-set-word-remove-${word.id}`}
                                    onClick={() => removeWordFromSet(set.id, ids)}
                                  >
                                    Убрать
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}

                  <div className="sets-menu-actions">
                    {!isActive ? (
                      <button
                        type="button"
                        data-testid={`training-set-activate-${set.id}`}
                        onClick={() => setActiveTrainingSet(set.id)}
                      >
                        Активный
                      </button>
                    ) : null}
                    <button
                      type="button"
                      data-testid={`training-set-train-${set.id}`}
                      disabled={!set.wordIds.length}
                      onClick={() => trainSet(set)}
                    >
                      Тренировать
                    </button>
                    <button
                      type="button"
                      data-testid={`training-set-rename-${set.id}`}
                      onClick={() => beginRename(set)}
                    >
                      Имя
                    </button>
                    {set.id !== MAIN_TRAINING_SET_ID ? (
                      <>
                        <button
                          type="button"
                          data-testid={`training-set-to-main-${set.id}`}
                          disabled={!set.wordIds.length}
                          onClick={() =>
                            moveTrainingWords({
                              fromSetId: set.id,
                              toSetId: MAIN_TRAINING_SET_ID,
                              wordIds: set.wordIds,
                            })
                          }
                        >
                          В основной
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          data-testid={`training-set-delete-${set.id}`}
                          onClick={() => {
                            if (expandedId === set.id) setExpandedId(null)
                            deleteTrainingSet(set.id)
                          }}
                        >
                          Удалить
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
