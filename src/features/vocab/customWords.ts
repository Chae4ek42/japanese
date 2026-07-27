import type { KanjiWord } from '../../shared/lib/types'
import { getWordById } from '../../data/words/bank'

const HAN_RE = /\p{Script=Han}/u

export function isCustomWordId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith('custom:'))
}

export function createCustomWordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom:${crypto.randomUUID()}`
  }
  return `custom:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function extractKanjiChars(writing: string): string[] {
  return [...new Set([...writing].filter((ch) => HAN_RE.test(ch)))]
}

export function parseMeaningsInput(value: string): string[] {
  return String(value ?? '')
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildCustomWord(input: {
  writing: string
  kana: string
  romaji: string
  meanings: string
  id?: string
}): KanjiWord | null {
  const writing = input.writing.trim()
  const kana = input.kana.trim()
  const romaji = input.romaji.trim()
  const meanings = parseMeaningsInput(input.meanings)
  if (!writing || !kana || !romaji || !meanings.length) {
    return null
  }

  const id = input.id && isCustomWordId(input.id) ? input.id : createCustomWordId()
  return {
    id,
    writing,
    kana,
    romaji,
    meanings,
    kanji: extractKanjiChars(writing),
  }
}

export function meaningsToInput(meanings: string[]): string {
  return meanings.filter(Boolean).join(', ')
}

export function resolveMyWords(ids: string[], customWords: Record<string, KanjiWord> = {}): KanjiWord[] {
  const words: KanjiWord[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    const word = customWords[id] ?? getWordById(id)
    if (!word) continue
    seen.add(id)
    words.push(word.id ? word : { ...word, id })
  }
  return words
}
