import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { KanjiWord } from '../../shared/lib/types'
import type { VocabRouteSection } from '../../shared/lib/routes'
import './styles.css'
import { getJlptWords, searchWords } from '../../data/words/bank'
import { useAppRouter } from '../../shared/lib/useAppRouter'
import { useKanjiState, useVocabState } from '../../shared/state/AppStateContext'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { CustomWordForm } from './CustomWordForm'
import { resolveMyWords } from './customWords'
import { VOCAB_GROUPS, getWordsForGroup } from './groups'
import { isWordSaved, mergeWordsByWriting, wordVariantIds } from './mergeHomographs'
import { resolveTrainingListWords } from './pool'
import { formatWritingsForClipboard } from './copyWritings'
import { DictionaryWordList } from './DictionaryWordList'

const PAGE_SIZE = 40

type CatalogMode = 'level' | 'group'
type MineView = 'saved' | 'learned' | 'training' | 'problem'
type LevelFilter = 5 | 4 | 3 | 2 | 1 | 'other'

export type VocabSection = VocabRouteSection

const LEVEL_OPTIONS: Array<{ id: LevelFilter; label: string }> = [
  { id: 5, label: 'N5' },
  { id: 4, label: 'N4' },
  { id: 3, label: 'N3' },
  { id: 2, label: 'N2' },
  { id: 1, label: 'N1' },
  { id: 'other', label: 'Вне JLPT' },
]

export function DictionaryPage() {
  const { vocabSection: section, goPage } = useAppRouter()
  const vocab = useVocabState()
  const kanji = useKanjiState()
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('level')
  const [mineView, setMineView] = useState<MineView>('saved')
  const [level, setLevel] = useState<LevelFilter>(5)
  const [groupId, setGroupId] = useState(VOCAB_GROUPS[0]?.id ?? 'family')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editingWord, setEditingWord] = useState<KanjiWord | null>(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const deferredQuery = useDeferredValue(query.trim())

  const myWords = vocab?.myWords ?? []
  const customWords = vocab?.customWords ?? {}
  const myWordAddedAt = vocab?.myWordAddedAt ?? {}
  const hiddenWordIds = vocab?.hiddenWordIds ?? []
  const learnedWordIds = vocab?.learnedWordIds ?? []
  const trainingWordIds = vocab?.trainingWordIds ?? []
  const problemWordIds = vocab?.problemWordIds ?? []
  const kanjiLearned = kanji?.learned ?? []
  const onSectionChange = (next: VocabRouteSection) => goPage('vocab', next)
  const onToggleMyWord = vocab?.toggleMyWord ?? (() => {})
  const onAddMyWords = vocab?.addMyWords ?? (() => {})
  const onRemoveMyWords = vocab?.removeMyWords ?? (() => {})
  const onAddCustomWord = vocab?.addCustomWord ?? (() => {})
  const onToggleLearnedWords = vocab?.toggleLearnedWords ?? (() => {})
  const onAddTrainingWords = vocab?.addTrainingWords ?? (() => {})
  const onRemoveTrainingWords = vocab?.removeTrainingWords ?? (() => {})
  const onToggleTrainingWord = vocab?.toggleTrainingWord ?? (() => {})
  const onRemoveProblemWords = vocab?.removeProblemWords ?? (() => {})
  const onToggleKanjiLearned = kanji?.toggleLearned

  const myWordSet = useMemo(() => new Set(myWords), [myWords])
  const learnedWordSet = useMemo(() => new Set(learnedWordIds), [learnedWordIds])
  const trainingWordSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])
  const hiddenSet = useMemo(() => new Set(hiddenWordIds), [hiddenWordIds])
  const learnedSet = useMemo(() => new Set(kanjiLearned), [kanjiLearned])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setEditingWord(null)
    setShowCustomForm(false)
    setInfoKanji(null)
    if (section !== 'mine') setMineView('saved')
  }, [section])

  useEffect(() => {
    if (editingWord) {
      setShowCustomForm(true)
      setMineView('saved')
    }
  }, [editingWord])

  const catalogWords = useMemo(() => {
    const raw = deferredQuery
      ? searchWords(deferredQuery, { limit: 120 })
      : catalogMode === 'group'
        ? getWordsForGroup(groupId)
        : getJlptWords(level)
    return mergeWordsByWriting(raw).filter(
      (word) => !wordVariantIds(word).some((id) => hiddenSet.has(id)),
    )
  }, [catalogMode, deferredQuery, groupId, level, hiddenSet])

  const mineWords = useMemo(() => {
    const resolved = resolveMyWords(myWords, customWords, hiddenWordIds)
    return [...resolved].sort((a, b) => {
      const aAt = Math.max(0, ...wordVariantIds(a).map((id) => myWordAddedAt[id] ?? 0))
      const bAt = Math.max(0, ...wordVariantIds(b).map((id) => myWordAddedAt[id] ?? 0))
      if (aAt !== bAt) return bAt - aAt
      return (a.writing || '').localeCompare(b.writing || '', 'ja')
    })
  }, [myWords, customWords, hiddenWordIds, myWordAddedAt])

  const trainingWords = useMemo(() => {
    return resolveTrainingListWords(trainingWordIds, customWords, hiddenWordIds)
  }, [trainingWordIds, customWords, hiddenWordIds])

  const learnedWords = useMemo(() => {
    return resolveTrainingListWords(learnedWordIds, customWords, hiddenWordIds)
  }, [learnedWordIds, customWords, hiddenWordIds])

  const problemWords = useMemo(() => {
    return resolveTrainingListWords(problemWordIds, customWords, hiddenWordIds)
  }, [problemWordIds, customWords, hiddenWordIds])

  const activeGroup = VOCAB_GROUPS.find((group) => group.id === groupId) ?? null
  const showMine = section === 'mine'
  const showLearnedList = showMine && mineView === 'learned'
  const showTrainingList = showMine && mineView === 'training'
  const showProblemList = showMine && mineView === 'problem'

  const list = showMine
    ? showProblemList
      ? problemWords
      : showTrainingList
        ? trainingWords
        : showLearnedList
          ? learnedWords
          : mineWords
    : catalogWords
  const visible = list.slice(0, visibleCount)
  const hasMore = visible.length < list.length

  if (!vocab || !kanji) return null

  function resetPaging() {
    setVisibleCount(PAGE_SIZE)
  }

  function handleToggleSaved(word: KanjiWord) {
    const ids = wordVariantIds(word)
    if (!ids.length) return
    if (isWordSaved(word, myWordSet)) {
      onRemoveMyWords(ids)
      return
    }
    onAddMyWords(ids)
  }

  function handleToggleLearned(word: KanjiWord) {
    const ids = wordVariantIds(word)
    if (!ids.length) return
    onToggleLearnedWords(ids)
  }

  function handleToggleTraining(word: KanjiWord) {
    const ids = wordVariantIds(word)
    if (!ids.length) return
    if (ids.some((id) => trainingWordSet.has(id))) {
      onRemoveTrainingWords(ids)
      return
    }
    onAddTrainingWords(ids)
  }

  function handleRemoveProblem(word: KanjiWord) {
    const ids = wordVariantIds(word)
    if (!ids.length) return
    onRemoveProblemWords(ids)
  }

  async function handleCopyWords() {
    const text = formatWritingsForClipboard(list)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('done')
    } catch {
      setCopyStatus('error')
    }
    window.setTimeout(() => setCopyStatus('idle'), 1600)
  }

  const listCaption = deferredQuery
    ? `Поиск «${deferredQuery}»`
    : showProblemList
      ? 'Проблемные'
      : showTrainingList
        ? 'Для тренировки'
        : showLearnedList
          ? 'Выученные'
          : showMine
            ? 'Мои слова'
            : catalogMode === 'group'
              ? (activeGroup?.label ?? 'Группа')
              : level === 'other'
                ? 'Вне JLPT'
                : `JLPT N${level}`

  const emptyMessage = showProblemList
    ? 'Пока пусто — слова появятся после ошибок или «Не помню» в тренировке.'
    : showTrainingList
      ? 'Набор пуст — добавьте слова кнопкой «+ В набор».'
      : showLearnedList
        ? 'Пока пусто — отметьте слова кнопкой «+ Выуч.».'
        : showMine
          ? 'Пока пусто — добавьте своё слово или нажмите «+ В мои» в каталоге.'
          : 'Ничего не найдено.'

  return (
    <main className="vocab-page" data-testid="vocab-page">
      <header className="vocab-hero">
        <div className="vocab-hero-copy">
          <h2 className="vocab-title">Словарь</h2>
        </div>

        <div className="vocab-section-tabs" role="tablist" aria-label="Разделы словаря">
          <button
            type="button"
            role="tab"
            data-testid="vocab-tab-catalog"
            className={section === 'catalog' ? 'vocab-section-tab is-active' : 'vocab-section-tab'}
            onClick={() => {
              onSectionChange('catalog')
              resetPaging()
            }}
          >
            Все слова
          </button>
          <button
            type="button"
            role="tab"
            data-testid="vocab-tab-mine"
            className={section === 'mine' ? 'vocab-section-tab is-active' : 'vocab-section-tab'}
            onClick={() => {
              onSectionChange('mine')
              resetPaging()
            }}
          >
            Мои слова
            <span className="vocab-section-count">{myWords.length}</span>
          </button>
        </div>
      </header>

      {section === 'catalog' ? (
        <section className="vocab-controls">
          <label className="vocab-search">
            <span className="visually-hidden">Поиск</span>
            <input
              type="search"
              value={query}
              data-testid="vocab-search"
              placeholder="Написание, кана, ромадзи или перевод"
              onChange={(event) => {
                setQuery(event.target.value)
                resetPaging()
              }}
            />
          </label>

          {!deferredQuery ? (
            <>
              <div className="vocab-mode-row" aria-label="Вид каталога">
                <button
                  type="button"
                  data-testid="vocab-mode-level"
                  className={catalogMode === 'level' ? 'vocab-mode-link is-active' : 'vocab-mode-link'}
                  onClick={() => {
                    setCatalogMode('level')
                    resetPaging()
                  }}
                >
                  По уровню
                </button>
                <button
                  type="button"
                  data-testid="vocab-mode-group"
                  className={catalogMode === 'group' ? 'vocab-mode-link is-active' : 'vocab-mode-link'}
                  onClick={() => {
                    setCatalogMode('group')
                    resetPaging()
                  }}
                >
                  По группам
                </button>
              </div>

              {catalogMode === 'level' ? (
                <div className="vocab-level-row" aria-label="Уровень JLPT">
                  {LEVEL_OPTIONS.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      data-testid={`vocab-level-${item.id}`}
                      className={level === item.id ? 'vocab-level-chip is-active' : 'vocab-level-chip'}
                      onClick={() => {
                        setLevel(item.id)
                        resetPaging()
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="vocab-group-grid" role="list">
                  {VOCAB_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      role="listitem"
                      data-testid={`vocab-group-${group.id}`}
                      className={groupId === group.id ? 'vocab-group-card is-active' : 'vocab-group-card'}
                      onClick={() => {
                        setGroupId(group.id)
                        resetPaging()
                      }}
                    >
                      <span className="vocab-group-label">{group.label}</span>
                      <span className="vocab-group-count">{group.wordIds.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>
      ) : (
        <section className="vocab-mine-tools">
          <div className="vocab-mode-row" aria-label="Разделы моих слов">
            <button
              type="button"
              data-testid="vocab-mine-saved"
              className={mineView === 'saved' ? 'vocab-mode-link is-active' : 'vocab-mode-link'}
              onClick={() => {
                setMineView('saved')
                resetPaging()
              }}
            >
              Сохранённые
              <span className="vocab-mine-mode-count">{mineWords.length}</span>
            </button>
            <button
              type="button"
              data-testid="vocab-mine-learned"
              className={mineView === 'learned' ? 'vocab-mode-link is-active' : 'vocab-mode-link'}
              onClick={() => {
                setMineView('learned')
                setShowCustomForm(false)
                setEditingWord(null)
                resetPaging()
              }}
            >
              Выученные
              <span className="vocab-mine-mode-count">{learnedWords.length}</span>
            </button>
            <button
              type="button"
              data-testid="vocab-mine-training"
              className={mineView === 'training' ? 'vocab-mode-link is-active' : 'vocab-mode-link'}
              onClick={() => {
                setMineView('training')
                setShowCustomForm(false)
                setEditingWord(null)
                resetPaging()
              }}
            >
              Для тренировки
              <span className="vocab-mine-mode-count">{trainingWords.length}</span>
            </button>
            <button
              type="button"
              data-testid="vocab-mine-problem"
              className={mineView === 'problem' ? 'vocab-mode-link is-active' : 'vocab-mode-link'}
              onClick={() => {
                setMineView('problem')
                setShowCustomForm(false)
                setEditingWord(null)
                resetPaging()
              }}
            >
              Проблемные
              <span className="vocab-mine-mode-count">{problemWords.length}</span>
            </button>
          </div>

          {mineView === 'saved' && showCustomForm ? (
            <CustomWordForm
              editingWord={editingWord}
              onSave={(word) => {
                onAddCustomWord(word)
                setEditingWord(null)
                setShowCustomForm(false)
              }}
              onCancelEdit={() => {
                setEditingWord(null)
                setShowCustomForm(false)
              }}
            />
          ) : (
            <div className="vocab-mine-actions">
              {mineView === 'saved' ? (
                <button
                  type="button"
                  className="secondary-button vocab-add-word-button"
                  data-testid="custom-word-open"
                  onClick={() => setShowCustomForm(true)}
                >
                  Добавить новое слово
                </button>
              ) : null}
              {list.length > 0 ? (
                <button
                  type="button"
                  className="secondary-button vocab-add-word-button"
                  data-testid="vocab-mine-copy-words"
                  onClick={() => {
                    void handleCopyWords()
                  }}
                >
                  {copyStatus === 'done'
                    ? 'Скопировано'
                    : copyStatus === 'error'
                      ? 'Не удалось'
                      : 'Скопировать слова'}
                </button>
              ) : null}
            </div>
          )}
        </section>
      )}

      <div className="vocab-list-head">
        <h3 className="vocab-list-title">{listCaption}</h3>
        <p className="vocab-count" data-testid="vocab-count">
          {list.length ? `${visible.length} из ${list.length}` : emptyMessage}
        </p>
      </div>

      <DictionaryWordList
        words={visible}
        isSaved={(word) => isWordSaved(word, myWordSet)}
        onToggleSaved={handleToggleSaved}
        onEdit={showMine && mineView === 'saved' ? setEditingWord : undefined}
        isLearned={(word) => isWordSaved(word, learnedWordSet)}
        onToggleLearned={handleToggleLearned}
        inTrainingList={(word) => isWordSaved(word, trainingWordSet)}
        onToggleTraining={handleToggleTraining}
        onRemoveProblem={showProblemList ? handleRemoveProblem : undefined}
      />

      {hasMore ? (
        <div className="vocab-more">
          <button
            type="button"
            className="vocab-more-button"
            data-testid="vocab-load-more"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            Показать ещё
          </button>
        </div>
      ) : null}

      {infoKanji ? (
        <KanjiInfoCard
          character={infoKanji}
          learned={learnedSet.has(infoKanji)}
          myWords={myWords}
          trainingWordIds={trainingWordIds}
          onClose={() => setInfoKanji(null)}
          onToggleLearned={onToggleKanjiLearned}
          onToggleMyWord={onToggleMyWord}
          onToggleTrainingWord={onToggleTrainingWord}
        />
      ) : null}
    </main>
  )
}
