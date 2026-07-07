// scripts/build-word-groups.mjs — проверка покрытия пачек слов.
import { readFileSync } from 'node:fs'
import { WORD_PACK_SIZE, WORD_THEME_CATEGORIES } from '../src/data/word-groups.data.js'

const words = JSON.parse(readFileSync('public/data/jlpt-n5-words-300.json', 'utf8')).words
const allIds = new Set(words.map((w) => w.id))
const used = new Map()

for (const category of WORD_THEME_CATEGORIES) {
  for (const group of category.groups) {
    if (group.wordIds.length !== WORD_PACK_SIZE) {
      console.error(`${group.id}: expected ${WORD_PACK_SIZE} words, got ${group.wordIds.length}`)
    }
    for (const id of group.wordIds) {
      if (used.has(id)) {
        console.error(`duplicate ${id} in ${group.id} and ${used.get(id)}`)
      }
      used.set(id, group.id)
      if (!allIds.has(id)) {
        console.error(`unknown id ${id} in ${group.id}`)
      }
    }
  }
}

const missing = [...allIds].filter((id) => !used.has(id))
const extra = [...used.keys()].filter((id) => !allIds.has(id))
console.log('groups', used.size / WORD_PACK_SIZE, 'words assigned', used.size, 'missing', missing.length)
if (missing.length) {
  for (const id of missing) {
    const w = words.find((entry) => entry.id === id)
    console.log('missing', id, w?.kanji, w?.translation_ru)
  }
}
if (extra.length) console.log('extra', extra)
