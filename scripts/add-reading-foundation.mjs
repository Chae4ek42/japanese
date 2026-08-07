/**
 * Добавляет в банк распространённые слова, которые в текстах пишут каной
 * (これ, です, ありがとう…), и собирает группы «Чтение» по уровням.
 *
 * Источник: кэш jmdict-rus + OpenJLPT vocab из build:kanji-bank.
 * Запуск: node scripts/add-reading-foundation.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'kanji-bank')
const JMDICT = path.join(CACHE, 'jmdict-rus.json')
const WORDS_PATH = path.join(ROOT, 'src', 'data', 'words', 'words.json')
const META_PATH = path.join(ROOT, 'src', 'data', 'words', 'meta.json')
const GROUPS_PATH = path.join(ROOT, 'src', 'features', 'vocab', 'groups.json')
const IDS_PATH = path.join(ROOT, 'src', 'data', 'words', 'reading-foundation-ids.json')

const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/u
const LATIN_RE = /[A-Za-zＡ-Ｚａ-ｚ0-9０-９]/
const HIRAGANA_RE = /^[\u3040-\u309Fーゝゞ]+$/
const KATAKANA_RE = /^[\u30A0-\u30FFーヽヾ]+$/
const RARE_KANJI_TAGS = new Set(['rK', 'oK', 'iK', 'sK'])

/** Compact must-have for comfortable reading (writings / kana keys). */
const MUST_HAVE_KEYS = [
  // demonstratives / places
  'これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'どの',
  'ここ', 'そこ', 'あそこ', 'どこ', 'こう', 'そう', 'どう',
  // people / questions
  '私', 'わたし', 'あなた', '誰', 'だれ', '何', 'なに', 'いつ', 'なぜ', 'どうして',
  // copula / endings
  'です', 'である', 'だ', 'でした', 'じゃない', 'ではない',
  // conjunctions / particles (as lexicon allows)
  'から', 'まで', 'など', 'のに', 'ので', 'けど', 'けれど', 'けれども',
  'と', 'や', 'へ', 'か', 'よ', 'ね', 'さ', 'ぞ', 'かな',
  'だけ', 'しか', 'ばかり', 'ほど', 'くらい', 'ぐらい', 'ずつ', 'など',
  'について', 'として', 'によって',
  // connectors
  'そして', 'それから', 'それで', 'しかし', 'でも', 'また', 'または',
  // adverbs / frequency
  'まだ', 'もう', 'いつも', 'みんな', 'みな', 'とても', 'ちょっと', 'すこし', '少し',
  'たくさん', 'あまり', 'ぜんぜん', 'きっと', 'たぶん', 'やはり', 'やっぱり',
  'ほんとう', '本当', 'もちろん', 'ぜひ', 'ちょうど', 'すぐ', 'ゆっくり',
  'いろいろ', 'こんな', 'そんな', 'あんな', 'どんな',
  // light verbs / auxiliaries
  'ください', '下さい', 'しまう', 'いる', 'ある', 'なる', 'する', 'できる',
  'みる', '見る', 'いく', '行く', 'くる', '来る', 'いう', '言う',
  'くれる', 'あげる', 'もらう',
  // nouns / frames
  'こと', 'もの', 'とき', 'ところ', 'ため', 'よう', 'つもり', 'はず', 'わけ',
  'まえ', '前', 'あと', '後', 'なか', '中', 'うえ', '上', 'した', '下',
  'ばあい', '場合', 'ほう',
  // phrases / greetings
  'ありがとう', 'すみません', 'こんにちは', 'こんばんは', 'おはよう',
  'おはようございます', 'さようなら', 'はい', 'いいえ', 'ええ', 'うん',
  'もう一度', '大丈夫', 'だいじょうぶ', 'だめ', 'いい', 'よい', 'ない',
  'おいしい', 'すごい', 'かわいい', 'おもしろい',
]

const ROMAJI = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo', っ: '', ー: '',
}

function toHiragana(ch) {
  if (!ch) return ''
  const code = ch.codePointAt(0)
  if (code >= 0x30a1 && code <= 0x30f6) return String.fromCodePoint(code - 0x60)
  return ch
}

function kanaToRomaji(kana) {
  let out = ''
  const s = String(kana).normalize('NFKC')
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    const next = s[i + 1]
    if (ch === 'っ' || ch === 'ッ') {
      const nextRomaji = ROMAJI[toHiragana(next)] || ''
      out += nextRomaji ? nextRomaji[0] : ''
      continue
    }
    if (next && 'ゃゅょャュョ'.includes(next)) {
      const base = ROMAJI[toHiragana(ch)] || ''
      const small = ROMAJI[toHiragana(next)] || ''
      if (base.endsWith('i') && small) {
        out += `${base.slice(0, -1)}${small}`
        i += 1
        continue
      }
    }
    out += ROMAJI[toHiragana(ch)] ?? (/[a-zA-Z0-9]/.test(ch) ? ch : '')
  }
  return out
}

function extractKanji(text) {
  return [...new Set(String(text).match(KANJI_RE) ?? [])]
}

function hasPriority(entry) {
  const forms = [...(entry.kanji ?? []), ...(entry.kana ?? [])]
  if (forms.some((form) => form?.common === true)) return true
  const tags = forms.flatMap((form) => form.tags ?? [])
  return tags.some((tag) => /^(ichi|news|spec|gai)\d/.test(String(tag)))
}

function isRareKanjiForm(form) {
  return (form.tags ?? []).some((tag) => RARE_KANJI_TAGS.has(String(tag)))
}

function preferredWriting(entry) {
  const kanaForms = (entry.kana ?? []).filter((k) => !k.tags?.includes('sk'))
  const commonKana = kanaForms.find((k) => k.common) ?? kanaForms[0]
  const kanjiForms = (entry.kanji ?? []).filter((k) => !k.tags?.includes('sK'))
  const commonModern = kanjiForms.find((k) => k.common && !isRareKanjiForm(k))
  if (commonModern) return commonModern.text
  if (commonKana) return commonKana.text
  return kanjiForms[0]?.text ?? commonKana?.text ?? null
}

function pickReading(entry, writing) {
  const kanaForms = (entry.kana ?? []).filter((k) => !k.tags?.includes('sk'))
  if (!kanaForms.length) return null
  if (!KANJI_RE.test(writing)) {
    const exact = kanaForms.find((k) => k.text === writing)
    if (exact) return exact.text
  }
  const applies = kanaForms.find((k) => {
    if (!k.appliesToKanji?.length || k.appliesToKanji.includes('*')) return true
    return k.appliesToKanji.includes(writing)
  })
  return (applies ?? kanaForms[0]).text
}

function pickMeanings(entry) {
  const glosses = []
  for (const sense of entry.sense ?? []) {
    for (const gloss of sense.gloss ?? []) {
      const text = typeof gloss === 'string' ? gloss : gloss.text
      if (text && !glosses.includes(text)) glosses.push(text)
      if (glosses.length >= 3) return glosses
    }
  }
  return glosses
}

function buildWord(entry, writing) {
  const reading = pickReading(entry, writing)
  if (!reading) return null
  const meanings = pickMeanings(entry)
  if (!meanings.length) return null
  return {
    id: String(entry.id),
    writing,
    kana: reading,
    romaji: kanaToRomaji(reading),
    meanings,
    jlpt: null,
    common: true,
    kanji: extractKanji(writing),
  }
}

function loadOpenJlptVocab() {
  /** @type {Map<string, number>} key = word or reading → best JLPT (5..1) */
  const map = new Map()
  for (const level of [5, 4, 3, 2, 1]) {
    const file = path.join(CACHE, `openjlpt-vocab-n${level}.json`)
    if (!existsSync(file)) continue
    const list = JSON.parse(readFileSync(file, 'utf8'))
    for (const item of list) {
      for (const key of [item.word, item.reading].filter(Boolean)) {
        const prev = map.get(key)
        if (!prev || level > prev) map.set(key, level)
      }
    }
  }
  return map
}

function upsertReadingGroups(groups, readingGroups) {
  const readingIds = new Set(readingGroups.map((g) => g.id))
  const kept = groups.filter((g) => !readingIds.has(g.id) && g.id !== 'reading-foundation')
  return [...readingGroups, ...kept]
}

function resolveMustHaveIds(words, foundationIds) {
  const foundation = new Set(foundationIds)
  const byWriting = new Map()
  const byKana = new Map()
  for (const word of words) {
    if (!word?.id) continue
    if (!byWriting.has(word.writing)) byWriting.set(word.writing, [])
    byWriting.get(word.writing).push(word)
    if (!byKana.has(word.kana)) byKana.set(word.kana, [])
    byKana.get(word.kana).push(word)
  }

  const pickBest = (candidates) => {
    if (!candidates?.length) return null
    return (
      candidates.find((w) => foundation.has(w.id) && !KANJI_RE.test(w.writing)) ||
      candidates.find((w) => foundation.has(w.id)) ||
      candidates.find((w) => !KANJI_RE.test(w.writing)) ||
      candidates.find((w) => w.common) ||
      candidates[0]
    )
  }

  const ids = []
  const seen = new Set()
  for (const key of MUST_HAVE_KEYS) {
    const hit =
      pickBest(byWriting.get(key)) ||
      pickBest(byKana.get(key))
    if (!hit || seen.has(hit.id)) continue
    seen.add(hit.id)
    ids.push(hit.id)
  }
  return ids
}

function buildLeveledGroups(words, foundationIds) {
  const byId = new Map(words.map((w) => [w.id, w]))
  const jlptMap = loadOpenJlptVocab()

  const mustIds = resolveMustHaveIds(words, foundationIds)
  const mustSet = new Set(mustIds)

  /** @type {Record<number, string[]>} */
  const byLevel = { 5: [], 4: [], 3: [], 2: [], 1: [] }
  const assigned = new Set(mustSet)

  // Levels only from kana-preferred foundation pool (not the whole JLPT bank).
  for (const id of foundationIds) {
    if (assigned.has(id)) continue
    const word = byId.get(id)
    if (!word) continue
    const level = jlptMap.get(word.writing) ?? jlptMap.get(word.kana)
    if (!level || !byLevel[level]) continue
    byLevel[level].push(id)
    assigned.add(id)
  }

  const hiraExtra = []
  for (const id of foundationIds) {
    if (assigned.has(id)) continue
    const word = byId.get(id)
    if (!word || !HIRAGANA_RE.test(word.writing)) continue
    hiraExtra.push(id)
    assigned.add(id)
  }

  const kataBasic = []
  for (const id of foundationIds) {
    if (assigned.has(id)) continue
    const word = byId.get(id)
    if (!word || !KATAKANA_RE.test(word.writing)) continue
    if (word.writing.length > 3) continue
    kataBasic.push(id)
    assigned.add(id)
  }

  const sortIds = (ids) => [...new Set(ids)].sort((a, b) => Number(a) - Number(b))

  return [
    { id: 'reading-must', label: 'Чтение · мастхев', wordIds: sortIds(mustIds) },
    { id: 'reading-n5', label: 'Чтение · N5', wordIds: sortIds(byLevel[5]) },
    { id: 'reading-n4', label: 'Чтение · N4', wordIds: sortIds(byLevel[4]) },
    { id: 'reading-n3', label: 'Чтение · N3', wordIds: sortIds(byLevel[3]) },
    { id: 'reading-n2', label: 'Чтение · N2', wordIds: sortIds(byLevel[2]) },
    { id: 'reading-n1', label: 'Чтение · N1', wordIds: sortIds(byLevel[1]) },
    { id: 'reading-hira', label: 'Чтение · хирагана+', wordIds: sortIds(hiraExtra) },
    { id: 'reading-kata', label: 'Чтение · катакана', wordIds: sortIds(kataBasic) },
  ]
}

function main() {
  if (!existsSync(JMDICT)) {
    throw new Error(`Нет кэша JMDict: ${JMDICT}. Сначала npm run build:kanji-bank`)
  }

  console.log('load jmdict + words…')
  const jmdict = JSON.parse(readFileSync(JMDICT, 'utf8'))
  const words = JSON.parse(readFileSync(WORDS_PATH, 'utf8'))
  const byId = new Map(words.map((w) => [w.id, w]))

  let added = 0
  let fixed = 0
  const foundationIds = []

  for (const entry of jmdict.words ?? []) {
    if (!hasPriority(entry)) continue
    const writing = preferredWriting(entry)
    if (!writing || LATIN_RE.test(writing)) continue
    if (KANJI_RE.test(writing)) continue

    const next = buildWord(entry, writing)
    if (!next) continue

    foundationIds.push(next.id)
    const prev = byId.get(next.id)
    if (!prev) {
      words.push(next)
      byId.set(next.id, next)
      added += 1
      continue
    }
    if (prev.writing !== next.writing || prev.kana !== next.kana) {
      Object.assign(prev, {
        writing: next.writing,
        kana: next.kana,
        romaji: next.romaji,
        kanji: next.kanji,
        common: true,
        meanings: prev.meanings?.length ? prev.meanings : next.meanings,
      })
      fixed += 1
    }
  }

  const uniqueFoundation = [...new Set(foundationIds)].sort((a, b) => Number(a) - Number(b))
  const readingGroups = buildLeveledGroups(words, uniqueFoundation)

  console.log(`add ${added}, fix writing ${fixed}, foundation ${uniqueFoundation.length}`)
  for (const group of readingGroups) {
    console.log(`  ${group.label}: ${group.wordIds.length}`)
  }

  writeFileSync(WORDS_PATH, `${JSON.stringify(words)}\n`)
  writeFileSync(IDS_PATH, `${JSON.stringify(uniqueFoundation, null, 2)}\n`)

  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
  meta.counts.words = words.length
  meta.counts.readingFoundation = uniqueFoundation.length
  meta.counts.readingGroups = Object.fromEntries(
    readingGroups.map((g) => [g.id, g.wordIds.length]),
  )
  meta.builtAt = new Date().toISOString()
  meta.sources.readingFoundation = 'jmdict common kana-preferred + OpenJLPT levels'
  writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`)

  const groups = JSON.parse(readFileSync(GROUPS_PATH, 'utf8'))
  writeFileSync(GROUPS_PATH, `${JSON.stringify(upsertReadingGroups(groups, readingGroups), null, 2)}\n`)

  console.log('done')
}

main()
