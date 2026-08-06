import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { KanjiWord } from '../../shared/lib/types'
import './styles.css'
import { getJlptWords, searchWords } from '../../data/words/bank'
import { useLoadMoreOnScroll } from '../../shared/lib/useLoadMoreOnScroll'
import { useKanjiState, useVocabState } from '../../shared/state/AppStateContext'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { VOCAB_GROUPS, getWordsForGroup } from './groups'
import { isWordSaved, mergeWordsByWriting, wordVariantIds } from './mergeHomographs'
import { DictionaryWordList } from './DictionaryWordList'

const PAGE_SIZE = 40

type CatalogMode = 'level' | 'group'
type LevelFilter = 5 | 4 | 3 | 2 | 1 | 'other'

const LEVEL_OPTIONS: Array<{ id: LevelFilter; label: string }> = [
  { id: 5, label: 'N5' },
  { id: 4, label: 'N4' },
  { id: 3, label: 'N3' },
  { id: 2, label: 'N2' },
  { id: 1, label: 'N1' },
  { id: 'other', label: 'Вне JLPT' },
]

export function DictionaryPage() {
  const vocab = useVocabState()
  const kanji = useKanjiState()
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('level')
  const [level, setLevel] = useState<LevelFilter>(5)
  const [groupId, setGroupId] = useState(VOCAB_GROUPS[0]?.id ?? 'family')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query.trim())
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const myWords = vocab?.myWords ?? []
  const hiddenWordIds = vocab?.hiddenWordIds ?? []
  const learnedWordIds = vocab?.learnedWordIds ?? []
  const trainingWordIds = vocab?.trainingWordIds ?? []
  const kanjiLearned = kanji?.learned ?? []
  const onToggleMyWord = vocab?.toggleMyWord ?? (() => {})
  const onAddMyWords = vocab?.addMyWords ?? (() => {})
  const onRemoveMyWords = vocab?.removeMyWords ?? (() => {})
  const onToggleLearnedWords = vocab?.toggleLearnedWords ?? (() => {})
  const onAddTrainingWords = vocab?.addTrainingWords ?? (() => {})
  const onRemoveTrainingWords = vocab?.removeTrainingWords ?? (() => {})
  const onToggleTrainingWord = vocab?.toggleTrainingWord ?? (() => {})
  const onToggleKanjiLearned = kanji?.toggleLearned

  const myWordSet = useMemo(() => new Set(myWords), [myWords])
  const learnedWordSet = useMemo(() => new Set(learnedWordIds), [learnedWordIds])
  const trainingWordSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])
  const hiddenSet = useMemo(() => new Set(hiddenWordIds), [hiddenWordIds])
  const learnedSet = useMemo(() => new Set(kanjiLearned), [kanjiLearned])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setInfoKanji(null)
  }, [catalogMode, level, groupId, deferredQuery])

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

  const list = catalogWords
  const visible = list.slice(0, visibleCount)
  const hasMore = visible.length < list.length
  const activeGroup = VOCAB_GROUPS.find((group) => group.id === groupId) ?? null

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

  const listCaption = deferredQuery
    ? `Поиск «${deferredQuery}»`
    : catalogMode === 'group'
      ? (activeGroup?.label ?? 'Группа')
      : level === 'other'
        ? 'Вне JLPT'
        : `JLPT N${level}`

  return (
    <main className="vocab-page" data-testid="vocab-page">
      <header className="vocab-hero">
        <div className="vocab-hero-copy">
          <h2 className="vocab-title">Словарь</h2>
        </div>
      </header>

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

      <div className="vocab-list-head">
        <h3 className="vocab-list-title">{listCaption}</h3>
        <p className="vocab-count" data-testid="vocab-count">
          {list.length ? `${visible.length} из ${list.length}` : 'Ничего не найдено.'}
        </p>
      </div>

      <DictionaryWordList
        words={visible}
        isSaved={(word) => isWordSaved(word, myWordSet)}
        onToggleSaved={handleToggleSaved}
        isLearned={(word) => isWordSaved(word, learnedWordSet)}
        onToggleLearned={handleToggleLearned}
        inTrainingList={(word) => isWordSaved(word, trainingWordSet)}
        onToggleTraining={handleToggleTraining}
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
