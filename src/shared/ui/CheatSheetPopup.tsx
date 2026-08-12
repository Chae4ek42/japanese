import { useEffect, useState, type ReactNode } from 'react'
import type {
  CheatSheetDoc,
  CheatSheetSection,
  CheatSheetTopic,
} from '../../data/cheatSheets'
import { getCheatSheetTopic } from '../../data/cheatSheets'
import './cheatSheet.css'

function CheatExamples({
  examples,
}: {
  examples: NonNullable<CheatSheetSection['examples']>
}) {
  return (
    <ul className="cheat-examples">
      {examples.map((example) => (
        <li key={`${example.jp}-${example.gloss}`}>
          <span className="cheat-example-jp">{example.jp}</span>
          <span className="cheat-example-gloss">{example.gloss}</span>
          {example.note ? <span className="cheat-example-note">{example.note}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function CheatSectionView({
  section,
  onOpenTopic,
}: {
  section: CheatSheetSection
  onOpenTopic: (topicId: string) => void
}) {
  return (
    <section className="cheat-section" data-testid={`cheat-section-${section.id}`}>
      <h3 className="cheat-section-title">{section.title}</h3>
      {section.lead ? <p className="cheat-note">{section.lead}</p> : null}
      {section.notes?.map((note) => (
        <p key={note} className="cheat-note">
          {note}
        </p>
      ))}
      {section.bullets?.length ? (
        <ul className="cheat-bullets">
          {section.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.headers && section.rows?.length ? (
        <div className="cheat-table-wrap">
          <table className="cheat-table">
            <thead>
              <tr>
                {section.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, index) => {
                const topicId = section.topicByCell?.[row[0] ?? '']
                return (
                  <tr
                    key={`${section.id}-${index}`}
                    className={topicId ? 'cheat-row-clickable' : undefined}
                    data-testid={topicId ? `cheat-topic-open-${topicId}` : undefined}
                    tabIndex={topicId ? 0 : undefined}
                    role={topicId ? 'link' : undefined}
                    aria-label={topicId ? `Открыть примеры: ${row[0]}` : undefined}
                    onClick={topicId ? () => onOpenTopic(topicId) : undefined}
                    onKeyDown={
                      topicId
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onOpenTopic(topicId)
                            }
                          }
                        : undefined
                    }
                  >
                    {row.map((cell, cellIndex) => (
                      <td key={`${index}-${cellIndex}`}>
                        {cellIndex === 0 && topicId ? (
                          <span className="cheat-row-key">{cell}</span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.examples?.length ? <CheatExamples examples={section.examples} /> : null}
    </section>
  )
}

function CheatTopicView({
  topic,
  onBack,
}: {
  topic: CheatSheetTopic
  onBack: () => void
}) {
  return (
    <div className="cheat-topic" data-testid={`cheat-topic-${topic.id}`}>
      <button
        type="button"
        className="text-button cheat-topic-back"
        data-testid="cheat-topic-back"
        onClick={onBack}
      >
        ← К списку
      </button>

      <header className="cheat-topic-head">
        <p className="cheat-topic-badge">
          <span className="cheat-topic-surface">{topic.badge}</span>
          {topic.reading ? <span className="cheat-topic-reading">{topic.reading}</span> : null}
        </p>
        <h3 className="cheat-topic-title">{topic.title}</h3>
        <p className="cheat-topic-lead">{topic.lead}</p>
      </header>

      <div className="cheat-topic-senses">
        {topic.senses.map((sense) => (
          <section key={sense.id} className="cheat-topic-sense" data-testid={`cheat-sense-${sense.id}`}>
            <h4 className="cheat-topic-sense-title">{sense.title}</h4>
            {sense.lead ? <p className="cheat-note">{sense.lead}</p> : null}
            {sense.bullets?.length ? (
              <ul className="cheat-bullets">
                {sense.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <CheatExamples examples={sense.examples} />
          </section>
        ))}
      </div>

      {topic.tips?.length ? (
        <section className="cheat-topic-tips">
          <h4 className="cheat-topic-sense-title">На заметку</h4>
          <ul className="cheat-bullets">
            {topic.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

export interface CheatSheetPopupProps {
  doc: CheatSheetDoc
  onClose: () => void
  testId?: string
  /** Open a topic immediately (e.g. deep link). */
  initialTopicId?: string | null
}

export function CheatSheetPopup({
  doc,
  onClose,
  testId,
  initialTopicId = null,
}: CheatSheetPopupProps) {
  const [topicId, setTopicId] = useState<string | null>(initialTopicId)
  const topic = getCheatSheetTopic(doc.topics, topicId)

  useEffect(() => {
    setTopicId(initialTopicId)
  }, [doc.id, initialTopicId])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (topicId) {
        setTopicId(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previous
    }
  }, [onClose, topicId])

  useEffect(() => {
    const body = document.querySelector('.cheat-sheet-popup')
    body?.scrollTo({ top: 0 })
  }, [topicId])

  return (
    <div
      className="cheat-sheet-overlay"
      data-testid={testId ?? `cheat-sheet-${doc.id}`}
      onClick={onClose}
      role="presentation"
    >
      <article
        className="cheat-sheet-popup"
        role="dialog"
        aria-modal="true"
        aria-label={topic ? `${doc.title}: ${topic.badge}` : doc.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cheat-sheet-popup-head">
          <div className="cheat-sheet-head">
            <h2 className="cheat-sheet-title">{doc.title}</h2>
            {!topic ? <p className="cheat-sheet-lead">{doc.lead}</p> : null}
          </div>
          <button
            type="button"
            className="text-button"
            data-testid="cheat-sheet-close"
            onClick={onClose}
          >
            Закрыть
          </button>
        </header>

        <div className="cheat-sheet-popup-body">
          {topic ? (
            <CheatTopicView topic={topic} onBack={() => setTopicId(null)} />
          ) : (
            doc.sections.map((section) => (
              <CheatSectionView
                key={section.id}
                section={section}
                onOpenTopic={setTopicId}
              />
            ))
          )}
        </div>
      </article>
    </div>
  )
}

export function CheatSheetTrigger({
  label,
  testId,
  onClick,
}: {
  label: string
  testId?: string
  onClick: () => void
}) {
  return (
    <button type="button" className="ghost-button cheat-sheet-trigger" data-testid={testId} onClick={onClick}>
      {label}
    </button>
  )
}

export function CheatSheetActions({ children }: { children: ReactNode }) {
  return <div className="cheat-sheet-actions">{children}</div>
}
