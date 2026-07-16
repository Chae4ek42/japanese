import { useMemo, useState } from 'react'
import {
  KANJI_BANK_META,
  getKanjiByLevel,
  getWordsForKanji,
  pickRandomUnlearnedKanji,
} from '../data/kanji/bank'
import { KanjiInfoCard } from './KanjiInfoCard'
import { KanjiTrainer } from './KanjiTrainer'

const LEVELS = [
  { id: 5, label: 'N5' },
  { id: 4, label: 'N4' },
  { id: 3, label: 'N3' },
]

export function KanjiPage({ kanjiState, onToggleLearned, onPatchPreferences }) {
  const [focusKanji, setFocusKanji] = useState(null)
  const [infoKanji, setInfoKanji] = useState(null)
  const learnedSet = useMemo(() => new Set(kanjiState.learned), [kanjiState.learned])
  const complexityFilter = kanjiState.preferences.complexityFilter

  function startRandom() {
    const next = pickRandomUnlearnedKanji(kanjiState.learned) ?? pickRandomUnlearnedKanji([])
    if (next) {
      setInfoKanji(null)
      setFocusKanji(next.character)
    }
  }

  function openInfoCard(character, event) {
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
          onPatchPreferences={onPatchPreferences}
          onToggleLearned={onToggleLearned}
          onBack={() => setFocusKanji(null)}
          onOpenInfo={(character) => setInfoKanji(character)}
        />
        {infoKanji ? (
          <KanjiInfoCard
            character={infoKanji}
            learned={learnedSet.has(infoKanji)}
            onClose={() => setInfoKanji(null)}
            onToggleLearned={onToggleLearned}
          />
        ) : null}
      </>
    )
  }

  return (
    <main className="kanji-page" data-testid="kanji-page">
      <section className="panel">
        <div className="section-heading kanji-page-head">
          <div>
            <h2>Кандзи JLPT</h2>
            <p className="subsection-note">
              {KANJI_BANK_META.counts.kanji} знаков · {KANJI_BANK_META.counts.words} слов из JMDict (рус.).
              ЛКМ — тренажёр · колёсико — карточка знака.
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
              Фильтр сложности слов
            </label>
            <button type="button" className="primary-button" data-testid="kanji-random" onClick={startRandom}>
              Случайный кандзи
            </button>
          </div>
        </div>

        {LEVELS.map((level) => {
          const items = getKanjiByLevel(level.id)
          const learnedCount = items.filter((item) => learnedSet.has(item.character)).length
          return (
            <section key={level.id} className="kanji-level-block" data-testid={`kanji-level-${level.label}`}>
              <div className="subsection-heading">
                <h3>{level.label}</h3>
                <p className="subsection-note">
                  Выучено {learnedCount} / {items.length}
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
                      title={`${item.meanings.join(', ')} · слов: ${sampleCount} · колёсико — карточка`}
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
          onClose={() => setInfoKanji(null)}
          onToggleLearned={onToggleLearned}
          onStartPractice={(character) => {
            setInfoKanji(null)
            setFocusKanji(character)
          }}
        />
      ) : null}
    </main>
  )
}
