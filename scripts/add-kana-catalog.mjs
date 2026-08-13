/**
 * Builds src/data/words/kana-catalog.json:
 * - JLPT tags for kana-written bank words (これ → N5)
 * - extra JMDict entries listed in OpenJLPT as kana but missing from the bank
 *
 * Usage: node scripts/add-kana-catalog.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.cache', 'kanji-bank')
const OUT = path.join(ROOT, 'src', 'data', 'words', 'kana-catalog.json')
const WORDS_PATH = path.join(ROOT, 'src', 'data', 'words', 'words.json')
const JMDICT = path.join(CACHE, 'jmdict-rus.json')

const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/u
const RARE_KANJI_TAGS = new Set(['rK', 'oK', 'iK', 'sK'])

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

function extractKanji(text) {
  return [...new Set(String(text).match(KANJI_RE) ?? [])]
}

function openJlptKanaKeys() {
  const keys = new Map()
  for (const n of [5, 4, 3, 2, 1]) {
    const list = JSON.parse(readFileSync(path.join(CACHE, `openjlpt-vocab-n${n}.json`), 'utf8'))
    for (const item of list) {
      const raw = String(item.word ?? '')
      const parts = raw
        .split('/')
        .map((part) => part.replace(/\s*\(.*\)\s*/g, '').trim())
        .filter(Boolean)
      for (const part of parts) {
        if (KANJI_RE.test(part)) continue
        const prev = keys.get(part)
        if (!prev || n > prev) keys.set(part, n)
      }
    }
  }
  return keys
}

function indexJmdict(jmdict) {
  const byKana = new Map()
  for (const entry of jmdict.words ?? []) {
    for (const form of entry.kana ?? []) {
      if (form.tags?.includes('sk') || !form.text) continue
      const list = byKana.get(form.text)
      if (list) list.push(entry)
      else byKana.set(form.text, [entry])
    }
  }
  return byKana
}

function kanaForm(entry, key) {
  return (entry.kana ?? []).find((form) => form.text === key && !form.tags?.includes('sk'))
}

function pickJmdictEntry(candidates, key) {
  if (!candidates?.length) return null
  const pool = candidates.filter((entry) => kanaForm(entry, key))
  if (!pool.length) return null
  return (
    pool.find((entry) => preferredWriting(entry) === key) ||
    pool.find((entry) => kanaForm(entry, key)?.common) ||
    pool.find((entry) => hasPriority(entry)) ||
    pool[0]
  )
}

function buildWord(entry, writing, jlpt) {
  const kanaForms = (entry.kana ?? []).filter((k) => !k.tags?.includes('sk'))
  const reading = kanaForms.find((k) => k.text === writing)?.text ?? kanaForms[0]?.text
  if (!reading) return null
  const meanings = pickMeanings(entry)
  if (!meanings.length) return null
  return {
    id: String(entry.id),
    writing,
    kana: reading,
    romaji: kanaToRomaji(reading),
    meanings,
    jlpt,
    common: hasPriority(entry),
    kanji: extractKanji(writing),
  }
}

function main() {
  if (!existsSync(JMDICT)) {
    throw new Error(`Нет кэша JMDict: ${JMDICT}`)
  }

  const words = JSON.parse(readFileSync(WORDS_PATH, 'utf8'))
  const byId = new Map(words.map((word) => [word.id, word]))
  const byWriting = new Map()
  for (const word of words) {
    if (!byWriting.has(word.writing)) byWriting.set(word.writing, [])
    byWriting.get(word.writing).push(word)
  }

  const jlptById = {}
  const extra = []
  const extraIds = new Set()
  const kanaKeys = openJlptKanaKeys()
  const jmByKana = indexJmdict(JSON.parse(readFileSync(JMDICT, 'utf8')))

  for (const [key, level] of kanaKeys) {
    const existing = (byWriting.get(key) ?? []).find((word) => word.writing === key)
    if (existing?.id) {
      const current = existing.jlpt ?? 0
      if (level > current) jlptById[existing.id] = level
      continue
    }

    const alreadyHasReading = words.some(
      (word) => word.kana === key && (word.common || typeof word.jlpt === 'number'),
    )
    if (alreadyHasReading) continue

    const entry = pickJmdictEntry(jmByKana.get(key), key)
    if (!entry) continue
    const id = String(entry.id)
    if (byId.has(id) || extraIds.has(id)) continue
    const kanaCommon = Boolean(kanaForm(entry, key)?.common)
    if (preferredWriting(entry) !== key && !kanaCommon) continue
    if (!hasPriority(entry) && level < 4) continue
    const word = buildWord(entry, key, level)
    if (!word) continue
    extra.push(word)
    extraIds.add(id)
  }

  extra.sort((a, b) => Number(a.id) - Number(b.id))
  const payload = {
    jlpt: jlptById,
    extra,
  }
  writeFileSync(OUT, `${JSON.stringify(payload)}\n`)
  console.log(
    `kana-catalog: jlpt patches ${Object.keys(jlptById).length}, extra words ${extra.length}`,
  )
}

main()
