import type { KanjiPageProps } from '../../shared/lib/component-props'
import { useMemo, useState } from 'react'
import './styles.css'
import {
  KANJI_BANK_META,
  getKanjiByLevel,
  getWordsForKanji,
  pickRandomUnlearnedKanji,
} from './data/bank'
import { KanjiInfoCard } from './KanjiInfoCard'
import { KanjiTrainer } from './KanjiTrainer'

const LEVELS = [
  { id: 5, label: 'N5' },
  { id: 4, label: 'N4' },
  { id: 3, label: 'N3' },
]

export function KanjiPage({
  kanjiState,
  myWords,
  onToggleLearned,
  onPatchPreferences,
  onToggleMyWord,
}: KanjiPageProps) {
  const [focusKanji, setFocusKanji] = useState<string | null>(null)
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const learnedSet = useMemo(() => new Set(kanjiState.learned), [kanjiState.learned])
  const complexityFilter = kanjiState.preferences.complexityFilter

  function startRandom() {
    const next = pickRandomUnlearnedKanji(kanjiState.learned) ?? pickRandomUnlearnedKanji([])
    if (next) {
      setInfoKanji(null)
      setFocusKanji(next.character)
    }
  }

  function openInfoCard(character: string, event: React.MouseEvent) {
    event.preventDefault()
    setInfoKanji(character)
  }

  if (focusKanji) {
    return (
      <>
        <KanjiTrainer
          character={focusKanji}
          learned={kanjiState.learned}
          complexityFilter={complexityFilter}
          myWords={myWords}
          onPatchPreferences={onPatchPreferences}
          onToggleLearned={onToggleLearned}
          onToggleMyWord={onToggleMyWord}
          onBack={() => setFocusKanji(null)}
          onOpenInfo={(character) => setInfoKanji(character)}
        />
        {infoKanji ? (
          <KanjiInfoCard
            character={infoKanji}
            learned={learnedSet.has(infoKanji)}
            myWords={myWords}
            onClose={() => setInfoKanji(null)}
            onToggleLearned={onToggleLearned}
            onToggleMyWord={onToggleMyWord}
          />
        ) : null}
      </>
    )
  }

  return (
    <main className="kanji-page" data-testid="kanji-page">
      <section className="page-surface kanji-page-surface">
        <div className="section-heading kanji-page-head">
          <div>
            <h2>Кандзи</h2>
            <p className="subsection-note">
              {KANJI_BANK_META.counts.kanji} знаков JLPT N5–N3 · {KANJI_BANK_META.counts.words} слов.
              Клик — практика · колёсико — карточка знака.
            </p>
          </div>
          <div className="kanji-page-actions">
            <label className="kanji-filter-toggle">
              <input
                type="checkbox"
                data-testid="kanji-complexity-filter"
                checked={complexityFilter}
                onChange={(event) => onPatchPreferences({ complexityFilter: event.target.checked })}
              />
              Только посильные слова
            </label>
            <button type="button" className="primary-button" data-testid="kanji-random" onClick={startRandom}>
              Случайный знак
            </button>
          </div>
        </div>

        {LEVELS.map((level) => {
          const items = getKanjiByLevel(level.id)
          const learnedCount = items.filter((item) => learnedSet.has(item.character)).length
          return (
            <section key={level.id} className="kanji-level-block" data-testid={`kanji-level-${level.label}`}>
              <div className="kanji-level-heading">
                <h3>{level.label}</h3>
                <p className="kanji-level-meta">
                  {learnedCount} из {items.length} отмечено
                </p>
              </div>
              <div className="kanji-grid">
                {items.map((item) => {
                  const learned = learnedSet.has(item.character)
                  const sampleCount = getWordsForKanji(item.character).length
                  return (
                    <button
                      key={item.character}
                      type="button"
                      data-testid={`kanji-cell-${item.character}`}
                      className={learned ? 'kanji-cell is-learned' : 'kanji-cell'}
                      title={`${item.meanings.join(', ')} · ${sampleCount} слов · колёсико — карточка`}
                      onClick={() => setFocusKanji(item.character)}
                      onAuxClick={(event) => {
                        if (event.button === 1) {
                          openInfoCard(item.character, event)
                        }
                      }}
                      onMouseDown={(event) => {
                        // Prevent autoscroll / default middle-click behavior in some browsers.
                        if (event.button === 1) {
                          event.preventDefault()
                        }
                      }}
                    >
                      <span className="kanji-cell-char">{item.character}</span>
                      <span className="kanji-cell-meta">{item.meanings[0] ?? '—'}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </section>

      {infoKanji ? (
        <KanjiInfoCard
          character={infoKanji}
          learned={learnedSet.has(infoKanji)}
          myWords={myWords}
          onClose={() => setInfoKanji(null)}
          onToggleLearned={onToggleLearned}
          onToggleMyWord={onToggleMyWord}
          onStartPractice={(character) => {
            setInfoKanji(null)
            setFocusKanji(character)
          }}
        />
      ) : null}
    </main>
  )
}
