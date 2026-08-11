/**
 * Apply kana-preferred surfaces for words usually written in kana
 * (何処→どこ, 何故→なぜ, …) and rebuild words-by-kanji.json.
 *
 * Usage: node scripts/apply-kana-preferred-surfaces.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORDS_PATH = path.join(ROOT, 'src/data/words/words.json')
const BY_KANJI_PATH = path.join(ROOT, 'src/data/words/words-by-kanji.json')
const IDS_PATH = path.join(ROOT, 'src/data/words/kana-preferred-ids.json')

const KANJI_RE = /[\u3400-\u9fff]/u

const preferredIds = new Set(JSON.parse(readFileSync(IDS_PATH, 'utf8')))
const words = JSON.parse(readFileSync(WORDS_PATH, 'utf8'))

let changed = 0
for (const word of words) {
  if (!preferredIds.has(word.id)) continue
  const kana = typeof word.kana === 'string' ? word.kana.trim() : ''
  if (!kana) continue
  if (word.writing === kana && (!word.kanji || word.kanji.length === 0)) continue
  word.writing = kana
  word.kanji = []
  changed += 1
  console.log(`  ${word.id}: → ${kana}`)
}

const wordsByKanji = {}
for (let i = 0; i < words.length; i += 1) {
  const word = words[i]
  const chars = new Set([
    ...(Array.isArray(word.kanji) ? word.kanji : []),
    ...[...(word.writing ?? '')].filter((ch) => KANJI_RE.test(ch)),
  ])
  for (const ch of chars) {
    if (!wordsByKanji[ch]) wordsByKanji[ch] = []
    wordsByKanji[ch].push(i)
  }
}

writeFileSync(WORDS_PATH, `${JSON.stringify(words)}\n`)
writeFileSync(BY_KANJI_PATH, `${JSON.stringify(wordsByKanji)}\n`)
console.log(`Updated ${changed} word(s); rebuilt words-by-kanji.json`)
