/** Split a cloze prompt on a blank marker (`___` by default). */
export function splitCloze(text: string, marker = '___'): { before: string; after: string } {
  const index = text.indexOf(marker)
  if (index < 0) return { before: text, after: '' }
  return { before: text.slice(0, index), after: text.slice(index + marker.length) }
}
