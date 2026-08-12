import { useEffect, useMemo, useRef, useState } from 'react'
import { useVocabState } from '../../shared/state/AppStateContext'
import { PARTICLES_CHEAT_SHEET, VERB_FORMS_CHEAT_SHEET } from '../../data/cheatSheets'
import {
  CheatSheetActions,
  CheatSheetPopup,
  CheatSheetTrigger,
} from '../../shared/ui/CheatSheetPopup'
import { getVocabGroup } from '../vocab/groups'
import { AUTOSTART_TRAIN_KEY } from '../vocab/autostart'
import { THEORY_LOOKUP, exampleKey, sectionKey } from './resolveTheoryWords'
import {
  THEORY_UNITS,
  getTheoryUnit,
  type TheoryExample,
  type TheoryUnit,
} from './units'
import './styles.css'

const EMPTY_IDS: string[] = []

type SetChooser =
  | { mode: 'train'; wordIds: string[] }
  | { mode: 'add'; wordIds: string[]; label: string }

function unitNavLabel(unit: TheoryUnit): string {
  const head = unit.title.split(':')[0]?.trim()
  return head && head.length < unit.title.length ? head : unit.title
}

function unitGlyph(unit: TheoryUnit): string {
  const fromTitle = unit.title.match(/[\u3040-\u30ff\u3400-\u9fff]/)?.[0]
  if (fromTitle) return fromTitle
  const fromExample = unit.sections
    .flatMap((section) => section.examples ?? [])
    .find((example) => example.writing)?.writing?.[0]
  return fromExample || '語'
}

export function TheoryPage({ onOpenTrain }: { onOpenTrain: () => void }) {
  const vocab = useVocabState()
  const [unitId, setUnitId] = useState(THEORY_UNITS[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [chooser, setChooser] = useState<SetChooser | null>(null)
  const [cheatSheet, setCheatSheet] = useState<'particles' | 'verbs' | null>(null)
  const contentRef = useRef<HTMLElement | null>(null)
  const noteTimer = useRef<number | null>(null)

  const unit = useMemo(() => getTheoryUnit(unitId) ?? THEORY_UNITS[0] ?? null, [unitId])
  const linkedGroup = unit?.readingGroupId ? getVocabGroup(unit.readingGroupId) : null
  const trainingWordIds = vocab?.trainingWordIds
  const activeSetName = vocab?.activeTrainingSet?.name ?? 'Основной'
  const trainingSet = useMemo(() => new Set(trainingWordIds ?? EMPTY_IDS), [trainingWordIds])

  const unitWordIds =
    (unit ? THEORY_LOOKUP.unitWordIds.get(unit.id) : undefined) ?? EMPTY_IDS
  const unitInTraining = unitWordIds.reduce(
    (count, id) => count + (trainingSet.has(id) ? 1 : 0),
    0,
  )
  const unitFullyInTraining =
    unitWordIds.length > 0 && unitInTraining >= unitWordIds.length
  const progressRatio = unitWordIds.length ? unitInTraining / unitWordIds.length : 0

  const navProgress = useMemo(() => {
    const map = new Map<string, { total: number; inSet: number }>()
    for (const [id, ids] of THEORY_LOOKUP.unitWordIds) {
      map.set(id, {
        total: ids.length,
        inSet: ids.reduce((count, wordId) => count + (trainingSet.has(wordId) ? 1 : 0), 0),
      })
    }
    return map
  }, [trainingSet])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [unitId])

  useEffect(() => {
    return () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!chooser) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChooser(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chooser])

  if (!unit || !vocab) return null
  const vocabApi = vocab
  const newSetName = unitNavLabel(unit).slice(0, 40)

  function flash(text: string) {
    setNote(text)
    if (noteTimer.current) window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(''), 2400)
  }

  function selectUnit(id: string) {
    setUnitId(id)
    setNote('')
    setChooser(null)
  }

  function startTrainWithSet(setId: string, wordIds: string[]) {
    vocabApi.addTrainingWords(wordIds, setId)
    vocabApi.patchPreferences({
      sessionMode: 'drill',
      source: 'list',
      trainFullGroup: false,
      trainingSetId: setId,
    })
    try {
      sessionStorage.setItem(AUTOSTART_TRAIN_KEY, '1')
    } catch {
      /* ignore */
    }
    setChooser(null)
    onOpenTrain()
  }

  function resolveChooser(target: 'active' | 'new') {
    if (!chooser) return
    const { wordIds } = chooser
    if (!wordIds.length) {
      setChooser(null)
      return
    }

    if (chooser.mode === 'train') {
      if (target === 'active') {
        startTrainWithSet(vocabApi.activeTrainingSetId, wordIds)
        return
      }
      const createdId = vocabApi.createTrainingSet({
        name: newSetName,
        wordIds,
        makeActive: true,
        train: true,
      })
      if (!createdId) {
        flash('Не удалось создать набор')
        return
      }
      vocabApi.patchPreferences({
        sessionMode: 'drill',
        source: 'list',
        trainFullGroup: false,
        trainingSetId: createdId,
      })
      try {
        sessionStorage.setItem(AUTOSTART_TRAIN_KEY, '1')
      } catch {
        /* ignore */
      }
      setChooser(null)
      onOpenTrain()
      return
    }

    // add
    if (target === 'active') {
      const missing = wordIds.filter((id) => !trainingSet.has(id))
      vocabApi.addTrainingWords(missing.length ? missing : wordIds)
      flash(
        missing.length
          ? `+${missing.length} · ${chooser.label} → ${activeSetName}`
          : `Уже в «${activeSetName}»`,
      )
      setChooser(null)
      return
    }
    const createdId = vocabApi.createTrainingSet({
      name: newSetName,
      wordIds,
      makeActive: true,
      train: false,
    })
    if (!createdId) {
      flash('Не удалось создать набор')
      return
    }
    flash(`Набор «${newSetName}» · ${wordIds.length} слов`)
    setChooser(null)
  }

  function openTrain() {
    if (!unitWordIds.length) {
      flash('В уроке нет слов для тренировки')
      return
    }
    setChooser({ mode: 'train', wordIds: unitWordIds })
  }

  function toggleUnitLessonWords() {
    if (!unitWordIds.length) return
    if (unitFullyInTraining) {
      vocabApi.removeTrainingWords(unitWordIds)
      flash(`Слова урока убраны из «${activeSetName}»`)
      return
    }
    const missing = unitWordIds.filter((id) => !trainingSet.has(id))
    setChooser({
      mode: 'add',
      wordIds: missing.length ? missing : unitWordIds,
      label: 'урок',
    })
  }

  function toggleExample(example: TheoryExample) {
    const ids = THEORY_LOOKUP.exampleWordIds.get(exampleKey(example)) ?? []
    if (!ids.length) {
      flash(`«${example.writing}» не найдено в словаре`)
      return
    }
    if (ids.some((id) => trainingSet.has(id))) {
      vocabApi.removeTrainingWords(ids)
      flash(`«${example.writing}» убрано из «${activeSetName}»`)
      return
    }
    vocabApi.addTrainingWords(ids)
    flash(`«${example.writing}» → ${activeSetName}`)
  }

  function addSectionExamples(heading: string) {
    const ids = THEORY_LOOKUP.sectionWordIds.get(sectionKey(unit.id, heading)) ?? []
    const missing = ids.filter((id) => !trainingSet.has(id))
    if (!missing.length) {
      flash(`«${heading}» уже в «${activeSetName}»`)
      return
    }
    setChooser({ mode: 'add', wordIds: missing, label: heading })
  }

  const unitIndex = Math.max(
    0,
    THEORY_UNITS.findIndex((item) => item.id === unit.id),
  )

  return (
    <main className="theory-page" data-testid="theory-page">
      <header className="theory-hero">
        <div className="theory-hero-copy">
          <p className="theory-kicker">Чтение</p>
          <h2 className="theory-title">Теория</h2>
          <p className="theory-lead">
            Сетки и формулы, на которых держится текст. Слова из урока — в активный набор или в новый.
          </p>
          <CheatSheetActions>
            <CheatSheetTrigger
              label="Шпаргалка: частицы"
              testId="theory-open-particles-cheatsheet"
              onClick={() => setCheatSheet('particles')}
            />
            <CheatSheetTrigger
              label="Шпаргалка: глаголы"
              testId="theory-open-verbs-cheatsheet"
              onClick={() => setCheatSheet('verbs')}
            />
          </CheatSheetActions>
        </div>
        <div className="theory-hero-stat" aria-label="Прогресс текущего урока">
          <div
            className="theory-progress-ring"
            style={{ ['--theory-progress' as string]: String(progressRatio) }}
          >
            <strong>
              {unitInTraining}/{unitWordIds.length || '—'}
            </strong>
          </div>
          <span>в «{activeSetName}»</span>
        </div>
      </header>

      <div className="theory-shell">
        <aside className="theory-rail" aria-label="Темы теории">
          <p className="theory-rail-label">Темы</p>
          <div className="theory-rail-list" role="list">
            {THEORY_UNITS.map((item, index) => {
              const progress = navProgress.get(item.id)
              const active = item.id === unit.id
              const done =
                Boolean(progress?.total) && progress!.inSet >= progress!.total
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  data-testid={`theory-nav-${item.id}`}
                  className={[
                    'theory-rail-item',
                    active ? 'is-active' : '',
                    done ? 'is-done' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectUnit(item.id)}
                >
                  <span className="theory-rail-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="theory-rail-glyph" aria-hidden="true">
                    {unitGlyph(item)}
                  </span>
                  <span className="theory-rail-copy">
                    <span className="theory-rail-title">{unitNavLabel(item)}</span>
                    {progress?.total ? (
                      <span className="theory-rail-meta">
                        {progress.inSet}/{progress.total}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="theory-stage">
          <article
            ref={contentRef}
            className="theory-unit"
            data-testid={`theory-unit-${unit.id}`}
          >
            <header className="theory-unit-head">
              <div className="theory-unit-heading">
                <p className="theory-unit-index">
                  Урок {unitIndex + 1} из {THEORY_UNITS.length}
                </p>
                <h3 className="theory-unit-title">{unit.title}</h3>
                <p className="theory-unit-sub">{unit.subtitle}</p>
              </div>

              <div className="theory-toolbar" role="group" aria-label="Действия урока">
                <button
                  type="button"
                  className="theory-btn theory-btn-primary"
                  data-testid="theory-train-group"
                  disabled={!unitWordIds.length}
                  onClick={openTrain}
                >
                  Тренировать
                </button>
                <button
                  type="button"
                  className={
                    unitFullyInTraining
                      ? 'theory-btn theory-btn-accent is-on'
                      : 'theory-btn theory-btn-accent'
                  }
                  data-testid="theory-add-lesson-words"
                  disabled={!unitWordIds.length}
                  onClick={toggleUnitLessonWords}
                >
                  {unitFullyInTraining
                    ? 'Убрать из набора'
                    : unitInTraining
                      ? `В набор · ещё ${unitWordIds.length - unitInTraining}`
                      : 'В набор'}
                </button>
              </div>
            </header>

            <div className="theory-unit-meta">
              <span>
                Активный набор · <strong>{activeSetName}</strong>
              </span>
              {linkedGroup ? (
                <span>
                  Связанная группа словаря ·{' '}
                  <strong>{linkedGroup.label.replace(/^Чтение ·\s*/, '')}</strong>
                </span>
              ) : null}
              {unitWordIds.length ? (
                <span>
                  Слова урока · <strong>{unitInTraining}</strong> / {unitWordIds.length}
                </span>
              ) : null}
              <div className="theory-unit-progress" aria-hidden="true">
                <span style={{ width: `${Math.round(progressRatio * 100)}%` }} />
              </div>
            </div>

            {unit.sections.map((section, sectionIndex) => {
              const sectionIds =
                THEORY_LOOKUP.sectionWordIds.get(sectionKey(unit.id, section.heading)) ?? []
              const sectionInSet = sectionIds.filter((id) => trainingSet.has(id)).length
              const sectionDone = sectionIds.length > 0 && sectionInSet >= sectionIds.length

              return (
                <section key={section.heading} className="theory-section">
                  <div className="theory-section-head">
                    <div className="theory-section-title-row">
                      <span className="theory-section-num" aria-hidden="true">
                        {sectionIndex + 1}
                      </span>
                      <h4 className="theory-section-title">{section.heading}</h4>
                    </div>
                    {section.examples?.length ? (
                      <button
                        type="button"
                        className={
                          sectionDone
                            ? 'theory-section-add is-done'
                            : 'theory-section-add'
                        }
                        data-testid={`theory-section-add-${section.heading}`}
                        onClick={() => addSectionExamples(section.heading)}
                      >
                        {sectionDone ? 'В наборе' : `Секцию · ${sectionIds.length}`}
                      </button>
                    ) : null}
                  </div>

                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="theory-paragraph">
                      {paragraph}
                    </p>
                  ))}

                  {section.table ? (
                    <div className="theory-table-wrap">
                      {section.table.caption ? (
                        <p className="theory-table-caption">{section.table.caption}</p>
                      ) : null}
                      <table className="theory-table" data-testid="theory-table">
                        <thead>
                          <tr>
                            {section.table.headers.map((header) => (
                              <th key={header}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row) => (
                            <tr key={row.join('|')}>
                              {row.map((cell, index) => (
                                <td
                                  key={`${cell}-${index}`}
                                  className={index === 0 ? 'is-label' : 'is-jp'}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {section.examples?.length ? (
                    <ul className="theory-examples" data-testid="theory-examples">
                      {section.examples.map((example) => {
                        const key = exampleKey(example)
                        const ids = THEORY_LOOKUP.exampleWordIds.get(key) ?? []
                        const inSet = ids.length > 0 && ids.some((id) => trainingSet.has(id))
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              className={
                                inSet ? 'theory-example is-in-set' : 'theory-example'
                              }
                              data-testid={`theory-toggle-${example.writing}-${example.romaji}`}
                              aria-pressed={inSet}
                              onClick={() => toggleExample(example)}
                            >
                              <span className="theory-example-writing">{example.writing}</span>
                              <span className="theory-example-meta">
                                {example.kana ? `${example.kana} · ` : ''}
                                {example.romaji}
                              </span>
                              <span className="theory-example-meaning">{example.meaning}</span>
                              <span className="theory-example-mark" aria-hidden="true">
                                {inSet ? '✓' : '+'}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </section>
              )
            })}
          </article>
        </div>
      </div>

      {chooser ? (
        <div
          className="theory-chooser-backdrop"
          data-testid="theory-set-chooser"
          onClick={() => setChooser(null)}
        >
          <div
            className="theory-chooser"
            role="dialog"
            aria-label="Куда добавить слова"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="theory-chooser-title">
              {chooser.mode === 'train' ? 'Тренировать' : 'Добавить в набор'}
            </p>
            <p className="theory-chooser-meta">{chooser.wordIds.length} слов</p>
            <button
              type="button"
              className="theory-chooser-option"
              data-testid="theory-chooser-active"
              onClick={() => resolveChooser('active')}
            >
              <span>В активный</span>
              <strong>{activeSetName}</strong>
            </button>
            <button
              type="button"
              className="theory-chooser-option"
              data-testid="theory-chooser-new"
              onClick={() => resolveChooser('new')}
            >
              <span>Новый набор</span>
              <strong>{newSetName}</strong>
            </button>
            <button
              type="button"
              className="theory-chooser-cancel"
              data-testid="theory-chooser-cancel"
              onClick={() => setChooser(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={note ? 'theory-toast is-visible' : 'theory-toast'}
        data-testid="theory-action-note"
        role="status"
        aria-live="polite"
      >
        {note}
      </div>

      {cheatSheet === 'particles' ? (
        <CheatSheetPopup doc={PARTICLES_CHEAT_SHEET} onClose={() => setCheatSheet(null)} />
      ) : null}
      {cheatSheet === 'verbs' ? (
        <CheatSheetPopup doc={VERB_FORMS_CHEAT_SHEET} onClose={() => setCheatSheet(null)} />
      ) : null}
    </main>
  )
}
