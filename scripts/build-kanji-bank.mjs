/**
 * Собирает банк кандзи N5–N3 и слов из JMDict (rus) + теги JLPT vocab (OpenJLPT).
 *
 * Источники:
 * - OpenJLPT kanji/vocab JSON
 * - jmdict-simplified jmdict-rus (EDRDG / CC-BY-SA)
 *
 * Запуск: node scripts/build-kanji-bank.mjs
 */
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'kanji-bank')
const OUT_DIR = path.join(ROOT, 'src', 'features', 'kanji', 'data')

const OPENJLPT_BASE =
  'https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json'
const JMDICT_RELEASE_API =
  'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest'

const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/gu

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
  if (code >= 0x30a1 && code <= 0x30f6) {
    return String.fromCodePoint(code - 0x60)
  }
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

function levelToNumber(level) {
  if (level === 'N5' || level === 5) return 5
  if (level === 'N4' || level === 4) return 4
  if (level === 'N3' || level === 3) return 3
  return null
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

async function download(url, dest) {
  if (existsSync(dest)) {
    console.log(`cache hit: ${path.basename(dest)}`)
    return dest
  }
  console.log(`download: ${url}`)
  const response = await fetch(url, {
    headers: { 'User-Agent': 'jp-kanji-bank-builder' },
  })
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
  return dest
}

async function downloadJson(url, dest) {
  await download(url, dest)
  return JSON.parse(readFileSync(dest, 'utf8'))
}

function walkFind(dir, pred) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      const found = walkFind(full, pred)
      if (found) return found
    } else if (pred(name, full)) {
      return full
    }
  }
  return null
}

async function resolveJmdictRusUrl() {
  const response = await fetch(JMDICT_RELEASE_API, {
    headers: {
      'User-Agent': 'jp-kanji-bank-builder',
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub API failed: ${response.status}`)
  }
  const release = await response.json()
  const asset = release.assets.find((item) => /^jmdict-rus-.*\.json\.tgz$/.test(item.name))
  if (!asset) {
    throw new Error('jmdict-rus asset not found in latest release')
  }
  return { url: asset.browser_download_url, name: asset.name, tag: release.tag_name }
}

function extractTgzJson(tgzPath, outJsonPath) {
  if (existsSync(outJsonPath)) {
    console.log(`cache hit: ${path.basename(outJsonPath)}`)
    return outJsonPath
  }
  console.log('extract jmdict-rus…')
  const tmpDir = path.join(CACHE, 'jmdict-extract')
  ensureDir(tmpDir)
  execFileSync('tar', ['-xzf', tgzPath, '-C', tmpDir], { stdio: 'inherit' })
  const found = walkFind(tmpDir, (name) => name.endsWith('.json'))
  if (!found) {
    throw new Error('JSON not found inside jmdict-rus archive')
  }
  copyFileSync(found, outJsonPath)
  return outJsonPath
}

function hasPriority(entry) {
  const tags = [
    ...(entry.kanji ?? []).flatMap((k) => k.tags ?? []),
    ...(entry.kana ?? []).flatMap((k) => k.tags ?? []),
  ]
  return tags.some((tag) => /^(ichi|news|spec|gai)\d/.test(tag))
}

function pickSurface(entry) {
  const kanjiForms = (entry.kanji ?? []).filter((k) => !k.tags?.includes('sK'))
  if (kanjiForms.length) {
    return kanjiForms[0].text
  }
  const kanaForms = (entry.kana ?? []).filter((k) => !k.tags?.includes('sk'))
  return kanaForms[0]?.text ?? null
}

function pickReading(entry, surface) {
  const kanaForms = (entry.kana ?? []).filter((k) => !k.tags?.includes('sk'))
  if (!kanaForms.length) return null

  const applies = kanaForms.find((k) => {
    if (!k.appliesToKanji?.length || k.appliesToKanji.includes('*')) return true
    return k.appliesToKanji.includes(surface)
  })
  return (applies ?? kanaForms[0]).text
}

function pickMeanings(entry) {
  const glosses = []
  for (const sense of entry.sense ?? []) {
    for (const gloss of sense.gloss ?? []) {
      const text = typeof gloss === 'string' ? gloss : gloss.text
      if (text && !glosses.includes(text)) {
        glosses.push(text)
      }
      if (glosses.length >= 3) return glosses
    }
  }
  return glosses
}

function buildJlptVocabMap(vocabLists) {
  const map = new Map()
  for (const [level, words] of Object.entries(vocabLists)) {
    const n = levelToNumber(level)
    for (const item of words) {
      const key = `${item.word}::${item.reading}`
      const prev = map.get(key)
      if (!prev || n > prev) {
        map.set(key, n)
      }
      // also by word alone as weaker fallback
      const wordKey = item.word
      const prevWord = map.get(wordKey)
      if (!prevWord || n > prevWord) {
        map.set(wordKey, n)
      }
    }
  }
  return map
}

async function main() {
  ensureDir(CACHE)
  ensureDir(OUT_DIR)

  const kanjiByLevel = {}
  for (const level of ['n5', 'n4', 'n3']) {
    kanjiByLevel[level] = await downloadJson(
      `${OPENJLPT_BASE}/kanji/${level}.json`,
      path.join(CACHE, `openjlpt-kanji-${level}.json`),
    )
  }

  const vocabByLevel = {}
  for (const level of ['n5', 'n4', 'n3']) {
    vocabByLevel[level.toUpperCase()] = await downloadJson(
      `${OPENJLPT_BASE}/vocab/${level}.json`,
      path.join(CACHE, `openjlpt-vocab-${level}.json`),
    )
  }

  const jlptVocab = buildJlptVocabMap(vocabByLevel)

  const kanjiList = []
  const kanjiLevelMap = new Map()
  for (const level of ['n5', 'n4', 'n3']) {
    const n = levelToNumber(level.toUpperCase())
    for (const item of kanjiByLevel[level]) {
      const ch = item.character
      if (kanjiLevelMap.has(ch)) continue
      kanjiLevelMap.set(ch, n)
      kanjiList.push({
        id: ch,
        character: ch,
        level: n,
        levelLabel: `N${n}`,
        strokes: item.strokes ?? null,
        meanings: (item.meanings ?? []).slice(0, 4),
        onyomi: item.onyomi ?? [],
        kunyomi: item.kunyomi ?? [],
      })
    }
  }

  const targetKanji = new Set(kanjiLevelMap.keys())
  console.log(`kanji N5–N3: ${targetKanji.size}`)

  const { url: jmdictUrl, name: jmdictName, tag } = await resolveJmdictRusUrl()
  console.log(`jmdict release: ${tag}`)
  const tgzPath = path.join(CACHE, jmdictName)
  await download(jmdictUrl, tgzPath)
  const jmdictJsonPath = path.join(CACHE, 'jmdict-rus.json')
  extractTgzJson(tgzPath, jmdictJsonPath)

  console.log('parse jmdict-rus…')
  const jmdict = JSON.parse(readFileSync(jmdictJsonPath, 'utf8'))
  const words = []
  const wordsByKanji = Object.fromEntries([...targetKanji].map((ch) => [ch, []]))

  for (const entry of jmdict.words ?? []) {
    const surface = pickSurface(entry)
    if (!surface) continue
    const kanjiInWord = extractKanji(surface)
    if (!kanjiInWord.length) continue
    if (!kanjiInWord.some((ch) => targetKanji.has(ch))) continue

    const reading = pickReading(entry, surface)
    if (!reading) continue
    const meanings = pickMeanings(entry)
    if (!meanings.length) continue

    const jlpt =
      jlptVocab.get(`${surface}::${reading}`) ??
      jlptVocab.get(surface) ??
      null

    const word = {
      id: String(entry.id),
      writing: surface,
      kana: reading,
      romaji: kanaToRomaji(reading),
      meanings,
      jlpt,
      common: hasPriority(entry),
      kanji: kanjiInWord,
    }
    const index = words.length
    words.push(word)
    for (const ch of kanjiInWord) {
      if (wordsByKanji[ch]) {
        wordsByKanji[ch].push(index)
      }
    }
  }

  // Sort word indexes: JLPT first, then common, then shorter writing
  for (const ch of Object.keys(wordsByKanji)) {
    wordsByKanji[ch].sort((a, b) => {
      const left = words[a]
      const right = words[b]
      const jlptA = left.jlpt ?? 0
      const jlptB = right.jlpt ?? 0
      if (jlptA !== jlptB) return jlptB - jlptA
      if (left.common !== right.common) return Number(right.common) - Number(left.common)
      return left.writing.length - right.writing.length
    })
  }

  const meta = {
    builtAt: new Date().toISOString(),
    sources: {
      kanji: 'OpenJLPT',
      vocabTags: 'OpenJLPT',
      dictionary: `jmdict-simplified ${tag} (rus)`,
    },
    counts: {
      kanji: kanjiList.length,
      words: words.length,
      n5: kanjiList.filter((k) => k.level === 5).length,
      n4: kanjiList.filter((k) => k.level === 4).length,
      n3: kanjiList.filter((k) => k.level === 3).length,
    },
  }

  writeFileSync(path.join(OUT_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  writeFileSync(path.join(OUT_DIR, 'kanji-list.json'), `${JSON.stringify(kanjiList)}\n`)
  writeFileSync(path.join(OUT_DIR, 'words.json'), `${JSON.stringify(words)}\n`)
  writeFileSync(path.join(OUT_DIR, 'words-by-kanji.json'), `${JSON.stringify(wordsByKanji)}\n`)

  console.log('done:', meta.counts)
  console.log(`output: ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
