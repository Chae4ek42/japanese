import { collectGlossFootnotes } from '../../shared/lib/jmdict-gloss'

export interface GlossFootnotesProps {
  meanings: string[]
  testId?: string
}

export function GlossFootnotes({ meanings, testId = 'gloss-footnotes' }: GlossFootnotesProps) {
  const notes = collectGlossFootnotes(meanings)
  if (!notes.length) {
    return null
  }

  return (
    <ul className="gloss-footnotes" data-testid={testId} aria-label="Пояснения к словарным пометкам">
      {notes.map((note) => (
        <li key={note.marker}>
          <span className="gloss-footnote-marker">{note.marker}</span>
          <span className="gloss-footnote-text">{note.text}</span>
        </li>
      ))}
    </ul>
  )
}
