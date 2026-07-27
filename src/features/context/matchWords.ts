import type { KanjiWord } from '../../shared/lib/types'
import { KANJI_WORDS } from '../../data/words/bank'

let surfacesCache: Array<{ form: string; id: string; len: number }> | null = null

function getSurfaces(): Array<{ form: string; id: string; len: number }> {
  if (surfacesCache) return surfacesCache
  const surfaces: Array<{ form: string; id: string; len: number }> = []
  for (const word of KANJI_WORDS) {
    if (!word.id) continue
    if (word.writing) {
      surfaces.push({ form: word.writing, id: word.id, len: [...word.writing].length })
    }
    if (word.kana && word.kana !== word.writing && word.kana.length >= 2) {
      surfaces.push({ form: word.kana, id: word.id, len: [...word.kana].length })
    }
  }
  surfaces.sort((a, b) => b.len - a.len || b.form.length - a.form.length)
  surfacesCache = surfaces
  return surfaces
}

/** Greedy longest-match tokenization against the local word bank. */
export function matchWordIdsInText(text: string): string[] {
  const surfaces = getSurfaces()
  const chars = [...text]
  const found: string[] = []
  let i = 0
  while (i < chars.length) {
    const slice = chars.slice(i).join('')
    let hit: (typeof surfaces)[number] | null = null
    for (const item of surfaces) {
      if (slice.startsWith(item.form)) {
        hit = item
        break
      }
    }
    if (hit) {
      found.push(hit.id)
      i += hit.len
    } else {
      i += 1
    }
  }
  return [...new Set(found)]
}

export function wordContainsSurface(word: KanjiWord, text: string): boolean {
  return Boolean((word.writing && text.includes(word.writing)) || (word.kana && text.includes(word.kana)))
}
