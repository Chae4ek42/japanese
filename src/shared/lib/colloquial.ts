import type { KanjiWord, KanjiWordReading } from './types'

/** JMDict-RU markers for colloquial / plain speech senses. */
const COLLOQUIAL_MARKER = /\(прост\.\)|\(разг\.\)/

export function meaningsLookColloquial(meanings: string[] | null | undefined): boolean {
  if (!meanings?.length) return false
  return meanings.some((item) => COLLOQUIAL_MARKER.test(item))
}

/** True when any sense is tagged colloquial / plain (прост./разг.). */
export function isColloquialWord(
  word: Pick<KanjiWord, 'meanings' | 'readings'> | Pick<KanjiWordReading, 'meanings'>,
): boolean {
  if (meaningsLookColloquial(word.meanings)) return true
  if ('readings' in word && Array.isArray(word.readings)) {
    return word.readings.some((reading) => meaningsLookColloquial(reading.meanings))
  }
  return false
}
