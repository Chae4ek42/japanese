import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { KanjiWord, StatsRecord, VocabPreferences } from '../../shared/lib/types'
import './styles.css'
import { getJlptWords, searchWords } from '../kanji/data/bank'
import { CustomWordForm } from './CustomWordForm'
import { resolveMyWords } from './customWords'
import { VOCAB_GROUPS, getWordsForGroup } from './groups'
import { VocabTrainer } from './VocabTrainer'
import { WordCard } from './WordCard'

const PAGE_SIZE = 40

type Section = 'catalog' | 'train' | 'mine'
type CatalogMode = 'level' | 'group'
type LevelFilter = 5 | 4 | 3 | 'other'

export type VocabSection = Section

const LEVEL_OPTIONS: Array<{ id: LevelFilter; label: string }> = [
  { id: 5, label: 'N5' },
  { id: 4, label: 'N4' },
  { id: 3, label: 'N3' },
  { id: 'other', label: 'Вне JLPT' },
]

export interface DictionaryPageProps {
  myWords: string[]
  customWords: Record<string, KanjiWord>
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
  section: VocabSection
  onSectionChange: (section: VocabSection) => void
  onToggleMyWord: (wordId: string) => void
  onAddCustomWord: (word: KanjiWord) => void
  onPatchPreferences: (patch: Partial<VocabPreferences>) => void
  onUpdateStats: (
    cardId: string,
    outcome: 'correct' | 'wrong' | 'hint' | 'seen',
    context: {
      now: number
      latencyMs?: number
      mistakesOnCard?: number
      hintUsed?: boolean
      inputMode?: VocabPreferences['inputMode']
    },
  ) => void
}

export function DictionaryPage({
  myWords,
  customWords,
  preferences,
  stats,
  section,
  onSectionChange,
  onToggleMyWord,
  onAddCustomWord,
  onPatchPreferences,
  onUpdateStats,
}: DictionaryPageProps) {
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('level')
  const [level, setLevel] = useState<LevelFilter>(5)
  const [groupId, setGroupId] = useState(VOCAB_GROUPS[0]?.id ?? 'family')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editingWord, setEditingWord] = useState<KanjiWord | null>(null)
  const deferredQuery = useDeferredValue(query.trim())
  const myWordSet = useMemo(() => new Set(myWords), [myWords])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    setEditingWord(null)
  }, [section])

  const catalogWords = useMemo(() => {
    if (deferredQuery) {
      return searchWords(deferredQuery, { limit: 120 })
    }
    if (catalogMode === 'group') {
      return getWordsForGroup(groupId)
    }
    return getJlptWords(level)
  }, [catalogMode, deferredQuery, groupId, level])

  const mineWords = useMemo(() => resolveMyWords(myWords, customWords), [myWords, customWords])
  const activeGroup = VOCAB_GROUPS.find((group) => group.id === groupId) ?? null

  const list = section === 'mine' ? mineWords : catalogWords
  const visible = list.slice(0, visibleCount)
  const hasMore = visible.length < list.length

  function resetPaging() {
    setVisibleCount(PAGE_SIZE)
  }

  const listCaption = deferredQuery
    ? `Поиск «${deferredQuery}»`
    : section === 'mine'
      ? 'Мои слова'
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
          <p className="vocab-lead">Каталог, личный список и тренировка слов — ромадзи или выбор перевода.</p>
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
            data-testid="vocab-tab-train"
            className={section === 'train' ? 'vocab-section-tab is-active' : 'vocab-section-tab'}
            onClick={() => onSectionChange('train')}
          >
            Тренировка
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

          {section === 'train' ? (
        <VocabTrainer
          preferences={preferences}
          stats={stats}
          myWords={myWords}
          customWords={customWords}
          onPatchPreferences={onPatchPreferences}
          onUpdateStats={onUpdateStats}
        />
      ) : (
        <>
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
              <p className="vocab-note">
                Добавьте или измените своё слово — либо сохраните из каталога и тренажёра кандзи.
              </p>
              <CustomWordForm
                editingWord={editingWord}
                onSave={(word) => {
                  onAddCustomWord(word)
                  setEditingWord(null)
                }}
                onCancelEdit={() => setEditingWord(null)}
              />
            </section>
          )}

          <div className="vocab-list-head">
            <h3 className="vocab-list-title">{listCaption}</h3>
            <p className="vocab-count" data-testid="vocab-count">
              {list.length
                ? `${visible.length} из ${list.length}`
                : section === 'mine'
                  ? 'Пока пусто — заполните форму выше или нажмите «+ В мои» в каталоге.'
                  : 'Ничего не найдено.'}
            </p>
          </div>

          <div className="vocab-list" data-testid="vocab-list">
            {visible.map((word) => (
              <WordCard
                key={word.id ?? `${word.writing}-${word.kana}`}
                word={word}
                isSaved={Boolean(word.id && myWordSet.has(word.id))}
                onToggleSaved={onToggleMyWord}
                onEdit={section === 'mine' ? setEditingWord : undefined}
              />
            ))}
          </div>

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
        </>
      )}
    </main>
  )
}
