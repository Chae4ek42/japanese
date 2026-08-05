import type { KanjiWord } from '../../shared/lib/types'

/** Space-separated writings for clipboard export from «Мои слова». */
export function formatWritingsForClipboard(words: KanjiWord[]): string {
  return words
    .map((word) => word.writing.trim())
    .filter(Boolean)
    .join(' ')
}
