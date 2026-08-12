import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { KanjiWord } from '../../shared/lib/types'
import './styles.css'
import { getColloquialWords, getJlptWords, searchWords } from '../../data/words/bank'
import { useLoadMoreOnScroll } from '../../shared/lib/useLoadMoreOnScroll'
import { useKanjiState, useVocabState } from '../../shared/state/AppStateContext'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import {
  VOCAB_GROUPS,
  collectGroupTrainingIds,
  getVocabGroupsByKind,
  getWordsForGroup,
} from './groups'
import { isWordSaved, mergeWordsByWriting, wordVariantIds } from './mergeHomographs'
import { DictionaryWordList } from './DictionaryWordList'
import { isColloquialWord } from '../../shared/lib/colloquial'

const PAGE_SIZE = 40

type CatalogMode = 'level' | 'group' | 'colloquial'
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
  const [groupActionNote, setGroupActionNote] = useState('')
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
  const showColloquial = vocab?.preferences.showColloquial !== false
  const onPatchPreferences = vocab?.patchPreferences ?? (() => {})

  const myWordSet = useMemo(() => new Set(myWords), [myWords])
  const learnedWordSet = useMemo(() => new Set(learnedWordIds), [learnedWordIds])
  const trainingWordSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])
  const hiddenSet = useMemo(() => new Set(hiddenWordIds), [hiddenWordIds])
  const learnedSet = useMemo(() => new Set(kanjiLearned), [kanjiLearned])
  const readingGroups = useMemo(() => getVocabGroupsByKind('reading'), [])
  const themeGroups = useMemo(() => getVocabGroupsByKind('theme'), [])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setInfoKanji(null)
    setGroupActionNote('')
  }, [catalogMode, level, groupId, deferredQuery])

  const catalogWords = useMemo(() => {
    const raw = deferredQuery
      ? searchWords(deferredQuery, { limit: 120 })
      : catalogMode === 'group'
        ? getWordsForGroup(groupId)
        : catalogMode === 'colloquial'
          ? getColloquialWords()
          : getJlptWords(level)
    return mergeWordsByWriting(raw)
      .filter((word) => !wordVariantIds(word).some((id) => hiddenSet.has(id)))
      .filter((word) => {
        if (catalogMode === 'colloquial') return true
        if (showColloquial) return true
        return !isColloquialWord(word)
      })
  }, [catalogMode, deferredQuery, groupId, level, hiddenSet, showColloquial])

  const list = catalogWords
  const visible = list.slice(0, visibleCount)
  const hasMore = visible.length < list.length
  const activeGroup = VOCAB_GROUPS.find((group) => group.id === groupId) ?? null

  const groupTrainingIds = useMemo(
    () => (activeGroup ? collectGroupTrainingIds(activeGroup) : []),
    [activeGroup],
  )
  const groupInTrainingCount = useMemo(
    () => groupTrainingIds.filter((id) => trainingWordSet.has(id)).length,
    [groupTrainingIds, trainingWordSet],
  )
  const groupFullyInTraining =
    groupTrainingIds.length > 0 && groupInTrainingCount >= groupTrainingIds.length

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

  function handleToggleWholeGroup() {
    if (!activeGroup || !groupTrainingIds.length) return
    if (groupFullyInTraining) {
      onRemoveTrainingWords(groupTrainingIds)
      setGroupActionNote(`Группа «${activeGroup.label}» убрана из набора`)
      return
    }
    const missing = groupTrainingIds.filter((id) => !trainingWordSet.has(id))
    onAddTrainingWords(missing.length ? missing : groupTrainingIds)
    setGroupActionNote(
      missing.length
        ? `В набор добавлено: ${missing.length} из «${activeGroup.label}»`
        : `Группа «${activeGroup.label}» уже в наборе`,
    )
  }

  const listCaption = deferredQuery
    ? `Поиск «${deferredQuery}»`
    : catalogMode === 'group'
      ? (activeGroup?.label ?? 'Группа')
      : catalogMode === 'colloquial'
        ? 'Разговорные'
        : level === 'other'
          ? 'Вне JLPT'
          : `JLPT N${level}`

  function renderGroupSection(title: string, groups: typeof VOCAB_GROUPS) {
    if (!groups.length) return null
    return (
      <div className="vocab-group-section">
        <p className="vocab-group-section-label">{title}</p>
        <div className="vocab-group-grid" role="list">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="listitem"
              data-testid={`vocab-group-${group.id}`}
              title={group.description || group.label}
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
      </div>
    )
  }

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
              <button
                type="button"
                data-testid="vocab-mode-colloquial"
                className={catalogMode === 'colloquial' ? 'vocab-mode-link is-active' : 'vocab-mode-link'}
                onClick={() => {
                  setCatalogMode('colloquial')
                  resetPaging()
                }}
              >
                Разговорные
              </button>
            </div>

            {catalogMode !== 'colloquial' ? (
              <div className="control-group">
                <span className="group-label">Разговорные в списках</span>
                <div className="segmented-control" role="group" aria-label="Показ разговорных слов">
                  <button
                    type="button"
                    data-testid="vocab-show-colloquial-on"
                    className={showColloquial ? 'segmented-button is-active' : 'segmented-button'}
                    onClick={() => onPatchPreferences({ showColloquial: true })}
                  >
                    Показывать
                  </button>
                  <button
                    type="button"
                    data-testid="vocab-show-colloquial-off"
                    className={!showColloquial ? 'segmented-button is-active' : 'segmented-button'}
                    onClick={() => onPatchPreferences({ showColloquial: false })}
                  >
                    Скрывать
                  </button>
                </div>
              </div>
            ) : null}

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
            ) : catalogMode === 'group' ? (
              <div className="vocab-group-sections">
                {renderGroupSection('Чтение', readingGroups)}
                {renderGroupSection('Темы', themeGroups)}
              </div>
            ) : (
              <p className="control-hint">Слова с пометой (разг.) или (прост.) в словаре.</p>
            )}
          </>
        ) : null}
      </section>

      <div className="vocab-list-head">
        <div className="vocab-list-head-main">
          <h3 className="vocab-list-title">{listCaption}</h3>
          <p className="vocab-count" data-testid="vocab-count">
            {list.length ? `${visible.length} из ${list.length}` : 'Ничего не найдено.'}
            {catalogMode === 'group' && activeGroup?.description && !deferredQuery
              ? ` · ${activeGroup.description}`
              : ''}
          </p>
          {groupActionNote ? (
            <p className="vocab-group-action-note" data-testid="vocab-group-action-note">
              {groupActionNote}
            </p>
          ) : null}
        </div>
        {catalogMode === 'group' && activeGroup && !deferredQuery ? (
          <button
            type="button"
            className={
              groupFullyInTraining ? 'vocab-group-bulk-button is-in-set' : 'vocab-group-bulk-button'
            }
            data-testid="vocab-group-add-all"
            onClick={handleToggleWholeGroup}
          >
            {groupFullyInTraining
              ? 'Убрать группу из набора'
              : groupInTrainingCount
                ? `Добавить остаток в набор (${groupTrainingIds.length - groupInTrainingCount})`
                : 'Всю группу в набор'}
          </button>
        ) : null}
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
