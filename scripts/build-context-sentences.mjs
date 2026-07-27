/**
 * Builds context sentence bank from seed (+ optional Tatoeba match).
 *
 * Usage:
 *   node scripts/build-context-sentences.mjs
 *   node scripts/build-context-sentences.mjs --tatoeba   # also scan local Tatoeba dump if present
 *
 * Optional Tatoeba files (CC-BY):
 *   .cache/tatoeba/jpn_sentences.tsv   (id \t lang \t text)
 *   .cache/tatoeba/jpn_rus.tsv         (jpn_id \t rus_id)  OR eng links
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const seedPath = join(root, 'scripts/data/context-seed.json')
const wordsPath = join(root, 'src/data/words/words.json')
const outDir = join(root, 'src/features/context/data')
const outPath = join(outDir, 'sentences.json')
const indexPath = join(outDir, 'sentences-by-word.json')

const GRAMMAR_DETECT = [
  ['copula_desu', /です|ます/],
  ['particle_wa', /は/],
  ['particle_ga', /が/],
  ['particle_wo', /を/],
  ['particle_ni', /に/],
  ['particle_no', /の/],
  ['particle_de', /で/],
  ['particle_to', /と/],
  ['particle_mo', /も/],
  ['question_ka', /か[？?]?$|ですか|ますか/],
  ['past_ta', /[っいん]た|ました|だった/],
  ['te_form', /て[、。]|んで/],
  ['negative_nai', /ない|ません/],
  ['want_tai', /たい/],
  ['existence_aru_iru', /ある|いる|あります|います/],
]

function detectGrammar(text) {
  return GRAMMAR_DETECT.filter(([, re]) => re.test(text)).map(([id]) => id)
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))]
}

const words = JSON.parse(readFileSync(wordsPath, 'utf8'))
const byId = new Map(words.map((w) => [w.id, w]))

/** Surface forms longest-first for greedy matching. */
const surfaces = []
for (const word of words) {
  if (!word.id) continue
  if (word.writing && word.writing.length >= 1) {
    surfaces.push({ form: word.writing, id: word.id, len: [...word.writing].length })
  }
  if (word.kana && word.kana !== word.writing && word.kana.length >= 2) {
    surfaces.push({ form: word.kana, id: word.id, len: [...word.kana].length })
  }
}
surfaces.sort((a, b) => b.len - a.len || b.form.length - a.form.length)

function matchWordIds(text) {
  let rest = text
  const found = []
  // Greedy left-to-right with longest match at each position
  let i = 0
  const chars = [...text]
  while (i < chars.length) {
    const slice = chars.slice(i).join('')
    let hit = null
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
  return uniq(found)
}

const seed = JSON.parse(readFileSync(seedPath, 'utf8'))
const sentences = []
let seedOk = 0
for (const [index, item] of seed.entries()) {
  const wordIds = uniq(item.wordIds).filter((id) => byId.has(id))
  if (!wordIds.length) {
    console.warn('skip seed (no valid wordIds):', item.text)
    continue
  }
  const grammarIds = uniq(item.grammarIds?.length ? item.grammarIds : detectGrammar(item.text))
  sentences.push({
    id: `seed:${index + 1}`,
    text: item.text,
    reading: item.reading || undefined,
    glossRu: item.glossRu,
    wordIds,
    grammarIds,
    themeHints: item.themeHints || [],
    source: 'seed',
  })
  seedOk += 1
}

const useTatoeba = process.argv.includes('--tatoeba')
const tatoebaSentences = join(root, '.cache/tatoeba/jpn_sentences.tsv')
const tatoebaLinks = join(root, '.cache/tatoeba/jpn_rus.tsv')

if (useTatoeba && existsSync(tatoebaSentences)) {
  console.log('Matching Tatoeba dump…')
  const glossByJpn = new Map()
  if (existsSync(tatoebaLinks)) {
    // format: jpn_id \t rus_text  OR jpn_id \t rus_id — support "jpn_id\trus_text"
    for (const line of readFileSync(tatoebaLinks, 'utf8').split(/\r?\n/)) {
      if (!line) continue
      const [jpnId, gloss] = line.split('\t')
      if (jpnId && gloss && /[а-яё]/i.test(gloss)) glossByJpn.set(jpnId, gloss.trim())
    }
  }

  let added = 0
  const maxAdd = 400
  for (const line of readFileSync(tatoebaSentences, 'utf8').split(/\r?\n/)) {
    if (added >= maxAdd) break
    if (!line) continue
    const [id, lang, text] = line.split('\t')
    if (lang !== 'jpn' || !text) continue
    if ([...text].length > 28) continue
    if (!/[。！？]$/.test(text) && !text.endsWith('。')) continue
    const wordIds = matchWordIds(text)
    if (wordIds.length < 1 || wordIds.length > 6) continue
    const glossRu = glossByJpn.get(id) || '—'
    if (glossRu === '—' && !process.argv.includes('--allow-no-gloss')) continue
    sentences.push({
      id: `tatoeba:${id}`,
      text,
      glossRu,
      wordIds,
      grammarIds: detectGrammar(text),
      themeHints: [],
      source: 'tatoeba',
    })
    added += 1
  }
  console.log('tatoeba added', added)
} else if (useTatoeba) {
  console.warn('Tatoeba dump not found at', tatoebaSentences, '— seed only')
}

const byWord = {}
for (const sentence of sentences) {
  for (const wordId of sentence.wordIds) {
    if (!byWord[wordId]) byWord[wordId] = []
    byWord[wordId].push(sentence.id)
  }
}

mkdirSync(outDir, { recursive: true })
writeFileSync(
  outPath,
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      counts: { sentences: sentences.length, seed: seedOk },
      sentences,
    },
    null,
    0,
  ),
)
writeFileSync(indexPath, JSON.stringify(byWord))
console.log('wrote', outPath, 'sentences=', sentences.length)
