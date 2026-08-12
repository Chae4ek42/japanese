import { useEffect, type ReactNode } from 'react'
import type { CheatSheetDoc, CheatSheetSection } from '../../data/cheatSheets'
import './cheatSheet.css'

function CheatSectionView({ section }: { section: CheatSheetSection }) {
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
              {section.rows.map((row, index) => (
                <tr key={`${section.id}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${index}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.examples?.length ? (
        <ul className="cheat-examples">
          {section.examples.map((example) => (
            <li key={`${example.jp}-${example.gloss}`}>
              <span className="cheat-example-jp">{example.jp}</span>
              <span className="cheat-example-gloss">{example.gloss}</span>
              {example.note ? <span className="cheat-example-note">{example.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export interface CheatSheetPopupProps {
  doc: CheatSheetDoc
  onClose: () => void
  testId?: string
}

export function CheatSheetPopup({ doc, onClose, testId }: CheatSheetPopupProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previous
    }
  }, [onClose])

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
        aria-label={doc.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cheat-sheet-popup-head">
          <div className="cheat-sheet-head">
            <h2 className="cheat-sheet-title">{doc.title}</h2>
            <p className="cheat-sheet-lead">{doc.lead}</p>
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
          {doc.sections.map((section) => (
            <CheatSectionView key={section.id} section={section} />
          ))}
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
