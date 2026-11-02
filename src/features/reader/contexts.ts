import type { ReaderSentence } from './analyze'

/** Recover source spans without presenting tokenizer reconstruction as an exact quote. */
export function readerSourceSentences(source: string, sentences: ReaderSentence[]) {
  let cursor = 0
  return sentences.map((sentence) => {
    let start = -1
    for (const token of sentence.tokens) {
      const found = source.indexOf(token.surface, cursor)
      if (found < 0 || source.slice(cursor, found).trim()) return null
      if (start < 0) start = found
      cursor = found + token.surface.length
    }
    return start < 0 ? null : { sentence: source.slice(start, cursor), start }
  })
}
