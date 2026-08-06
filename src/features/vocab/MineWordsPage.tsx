import { useEffect, useMemo, useRef, useState } from 'react'
import type { KanjiWord } from '../../shared/lib/types'
import './styles.css'
import { useLoadMoreOnScroll } from '../../shared/lib/useLoadMoreOnScroll'
import { useKanjiState, useVocabState } from '../../shared/state/AppStateContext'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { CustomWordForm } from './CustomWordForm'
import { resolveMyWords } from './customWords'
import { isWordSaved, wordVariantIds } from './mergeHomographs'
import { resolveTrainingListWords } from './pool'
import { formatWritingsForClipboard } from './copyWritings'
import { DictionaryWordList } from './DictionaryWordList'

const PAGE_SIZE = 40

type MineView = 'saved' | 'learned' | 'training' | 'problem'

export function MineWordsPage() {
  const vocab = useVocabState()
  const kanji = useKanjiState()
  const [mineView, setMineView] = useState<MineView>('saved')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editingWord, setEditingWord] = useState<KanjiWord | null>(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const myWords = vocab?.myWords ?? []
  const customWords = vocab?.customWords ?? {}
  const myWordAddedAt = vocab?.myWordAddedAt ?? {}
  const hiddenWordIds = vocab?.hiddenWordIds ?? []
  const learnedWordIds = vocab?.learnedWordIds ?? []
  const trainingWordIds = vocab?.trainingWordIds ?? []
  const problemWordIds = vocab?.problemWordIds ?? []
  const kanjiLearned = kanji?.learned ?? []
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
  const learnedSet = useMemo(() => new Set(kanjiLearned), [kanjiLearned])

  useEffect(() => {
    if (editingWord) {
      setShowCustomForm(true)
      setMineView('saved')
    }
  }, [editingWord])

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

  const showLearnedList = mineView === 'learned'
  const showTrainingList = mineView === 'training'
  const showProblemList = mineView === 'problem'

  const list = showProblemList
    ? problemWords
    : showTrainingList
      ? trainingWords
      : showLearnedList
        ? learnedWords
        : mineWords
  const visible = list.slice(0, visibleCount)
  const hasMore = visible.length < list.length

  useLoadMoreOnScroll(loadMoreRef, {
    hasMore,
    onLoadMore: () => setVisibleCount((count) => count + PAGE_SIZE),
  })

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

  const listCaption = showProblemList
    ? 'Проблемные'
    : showTrainingList
      ? 'Для тренировки'
      : showLearnedList
        ? 'Выученные'
        : 'Мои слова'

  const emptyMessage = showProblemList
    ? 'Пока пусто — слова появятся после ошибок или «Не помню» в тренировке.'
    : showTrainingList
      ? 'Набор пуст — добавьте слова кнопкой «+ В набор».'
      : showLearnedList
        ? 'Пока пусто — отметьте слова кнопкой «+ Выуч.».'
        : 'Пока пусто — добавьте своё слово или нажмите «+ В мои» в каталоге.'

  return (
    <main className="vocab-page" data-testid="mine-page">
      <header className="vocab-hero">
        <div className="vocab-hero-copy">
          <h2 className="vocab-title">
            Мои слова
            <span className="vocab-section-count" data-testid="mine-word-count">
              {myWords.length}
            </span>
          </h2>
        </div>
      </header>

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
        onEdit={mineView === 'saved' ? setEditingWord : undefined}
        isLearned={(word) => isWordSaved(word, learnedWordSet)}
        onToggleLearned={handleToggleLearned}
        inTrainingList={(word) => isWordSaved(word, trainingWordSet)}
        onToggleTraining={handleToggleTraining}
        onRemoveProblem={showProblemList ? handleRemoveProblem : undefined}
      />

      {hasMore ? (
        <div className="vocab-more" ref={loadMoreRef} data-testid="vocab-load-more">
          <span className="vocab-more-hint">Подгружаем ещё…</span>
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
