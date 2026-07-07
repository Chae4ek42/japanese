import fs from 'node:fs/promises'
import { existsSync, mkdirSync, createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const tempDir = path.join(repoRoot, '.codex-temp', 'n5-word-bank')
const outputDataPath = path.join(repoRoot, 'public', 'data', 'jlpt-n5-words-300.json')
const outputAudioDir = path.join(repoRoot, 'public', 'audio', 'n5-words')
const audioZipPath = path.join(tempDir, 'kanji-alive-audio-mp3.zip')
const kaCsvPath = path.join(tempDir, 'ka_data.csv')
const jlptCsvPath = path.join(tempDir, 'jlpt_all.csv')
const anchorDir = path.join(tempDir, 'anchor')

const JLPT_URL = 'https://raw.githubusercontent.com/elzup/jlpt-word-list/master/out/all.csv'
const KA_URL = 'https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/language-data/ka_data.csv'
const ANCHOR_URLS = [1, 2, 3, 4].map(
  (index) => `https://raw.githubusercontent.com/AnchorI/jlpt-kanji-dictionary/main/dictionary_part_${index}.json`,
)
const AUDIO_ZIP_URL = 'https://media.kanjialive.com/examples_audio/audio-mp3.zip'

const MAX_WORDS = 300

await fs.mkdir(tempDir, { recursive: true })
await fs.mkdir(anchorDir, { recursive: true })
await fs.mkdir(outputAudioDir, { recursive: true })
await fs.mkdir(path.dirname(outputDataPath), { recursive: true })

await ensureFile(JLPT_URL, jlptCsvPath)
await ensureFile(KA_URL, kaCsvPath)
for (const [index, url] of ANCHOR_URLS.entries()) {
  await ensureFile(url, path.join(anchorDir, `dictionary_part_${index + 1}.json`))
}
await ensureFile(AUDIO_ZIP_URL, audioZipPath)

const jlptRows = parseCsv(await fs.readFile(jlptCsvPath, 'utf8'))
const kaRows = parseCsv(await fs.readFile(kaCsvPath, 'utf8'))
const anchorEntries = (
  await Promise.all(
    [1, 2, 3, 4].map(async (index) =>
      JSON.parse(await fs.readFile(path.join(anchorDir, `dictionary_part_${index}.json`), 'utf8')),
    ),
  )
).flat()

const n5Map = new Map()
for (const row of jlptRows) {
  if (!row.tags.includes('JLPT_N5')) {
    continue
  }

  const expression = normalizeWord(row.expression)
  const reading = normalizeReading(row.reading)
  if (!expression || !reading) {
    continue
  }

  const key = `${expression}||${reading}`
  if (!n5Map.has(key)) {
    n5Map.set(key, {
      expression,
      reading,
      meaningEn: row.meaning.trim(),
      tags: row.tags,
    })
  }
}

const anchorMap = new Map()
for (const entry of anchorEntries) {
  const expression = normalizeWord(entry.kanji)
  const reading = normalizeReading(entry.reading)
  if (!expression || !reading) {
    continue
  }

  const key = `${expression}||${reading}`
  if (!anchorMap.has(key)) {
    anchorMap.set(key, {
      glossaryRu: (entry.glossary_ru ?? []).filter(Boolean),
      glossaryEn: (entry.glossary_en ?? []).filter(Boolean),
      sequence: typeof entry.sequence === 'number' ? entry.sequence : Number(entry.sequence ?? 9_999_999),
      pos: entry.pos ?? '',
    })
  }
}

const candidates = []
for (const row of kaRows) {
  const examples = safeParseExamples(row.examples)
  for (let index = 0; index < examples.length; index += 1) {
    const [jp, meaningEn] = examples[index]
    const match = jp.match(/^(.*)（(.*)）$/)
    if (!match) {
      continue
    }

    const expression = normalizeWord(match[1])
    const reading = normalizeReading(match[2])
    const key = `${expression}||${reading}`
    const jlpt = n5Map.get(key)
    if (!jlpt) {
      continue
    }

    const anchor = anchorMap.get(key)
    candidates.push({
      id: slugify(`${expression}-${reading}`),
      expression,
      reading,
      translationEn: compactGloss(jlpt.meaningEn || meaningEn),
      translationRu: compactGloss(anchor?.glossaryRu?.[0]) || compactGloss(anchor?.glossaryEn?.[0]) || compactGloss(meaningEn),
      notesRu: anchor?.glossaryRu?.slice(1, 3) ?? [],
      pos: anchor?.pos ?? '',
      sequence: anchor?.sequence ?? 9_999_999,
      jlptTags: jlpt.tags,
      jlpt: 'N5',
      audioZipEntry: `audio-mp3/${row.kname}_06_${String.fromCharCode(97 + index)}.mp3`,
      source: {
        jlpt: 'elzup/jlpt-word-list',
        translation: anchor?.glossaryRu?.length ? 'AnchorI/jlpt-kanji-dictionary' : 'Kanji Alive / JLPT list',
        audio: 'Kanji Alive',
      },
    })
  }
}

const uniqueCandidates = Array.from(new Map(candidates.map((entry) => [`${entry.expression}||${entry.reading}`, entry])).values())
uniqueCandidates.sort(compareCandidates)

const selected = uniqueCandidates.slice(0, MAX_WORDS)
if (selected.length < MAX_WORDS) {
  throw new Error(`Expected at least ${MAX_WORDS} matched words, got ${selected.length}`)
}

for (const entry of selected) {
  const audioFileName = `${entry.id}.mp3`
  const outputAudioPath = path.join(outputAudioDir, audioFileName)
  if (!existsSync(outputAudioPath)) {
    await extractZipEntry(audioZipPath, entry.audioZipEntry, outputAudioPath)
  }
  entry.audio = `/audio/n5-words/${audioFileName}`
  delete entry.audioZipEntry
}

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  count: selected.length,
  schema: {
    id: 'stable slug',
    kanji: 'word spelling with kanji or katakana when applicable',
    kana: 'hiragana/katakana reading',
    translation_ru: 'primary Russian gloss',
    translation_en: 'primary English gloss',
    notes_ru: 'extra Russian glosses when available',
    audio: 'local mp3 path with native-speaker recording',
    pos: 'part of speech tags from source dictionary',
    jlpt: 'target level',
    sources: 'source attribution per entry',
  },
  sources: {
    vocabulary: 'https://github.com/elzup/jlpt-word-list',
    translations: 'https://github.com/AnchorI/jlpt-kanji-dictionary',
    audio: 'https://github.com/kanjialive/kanji-data-media',
    audioLicense: 'Kanji Alive media is published under CC BY 4.0; verify redistribution terms before production use.',
  },
  words: selected.map((entry) => ({
    id: entry.id,
    kanji: entry.expression,
    kana: entry.reading,
    translation_ru: entry.translationRu,
    translation_en: entry.translationEn,
    notes_ru: entry.notesRu,
    audio: entry.audio,
    pos: entry.pos,
    jlpt: entry.jlpt,
    sources: entry.source,
  })),
}

await fs.writeFile(outputDataPath, JSON.stringify(payload, null, 2), 'utf8')

console.log(`Generated ${selected.length} words`)
console.log(outputDataPath)

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  const headers = rows.shift()
  return rows.map((current) => Object.fromEntries(headers.map((header, index) => [header, current[index] ?? ''])))
}

function normalizeWord(value = '') {
  return value
    .replace(/^\*/, '')
    .replace(/[()（）]/g, '')
    .replace(/[～〜]/g, '')
    .trim()
}

function normalizeReading(value = '') {
  return value.split(/[;；,/]/)[0].trim()
}

function compactGloss(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function safeParseExamples(value) {
  try {
    return JSON.parse(String(value).replace(/\r?\n/g, ' '))
  } catch {
    return []
  }
}

function slugify(value) {
  const digest = createHash('md5').update(value).digest('hex').slice(0, 8)
  return `${transliterate(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${digest}`
}

function transliterate(value) {
  const map = new Map([
    ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
    ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
    ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
    ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
    ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
    ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
    ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
    ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
    ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
    ['わ', 'wa'], ['を', 'wo'], ['ん', 'n'],
    ['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'],
    ['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'],
    ['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do'],
    ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'],
    ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po'],
    ['ゃ', 'ya'], ['ゅ', 'yu'], ['ょ', 'yo'], ['っ', ''], ['ー', '-'],
    ['ア', 'a'], ['イ', 'i'], ['ウ', 'u'], ['エ', 'e'], ['オ', 'o'],
    ['カ', 'ka'], ['キ', 'ki'], ['ク', 'ku'], ['ケ', 'ke'], ['コ', 'ko'],
    ['サ', 'sa'], ['シ', 'shi'], ['ス', 'su'], ['セ', 'se'], ['ソ', 'so'],
    ['タ', 'ta'], ['チ', 'chi'], ['ツ', 'tsu'], ['テ', 'te'], ['ト', 'to'],
    ['ナ', 'na'], ['ニ', 'ni'], ['ヌ', 'nu'], ['ネ', 'ne'], ['ノ', 'no'],
    ['ハ', 'ha'], ['ヒ', 'hi'], ['フ', 'fu'], ['ヘ', 'he'], ['ホ', 'ho'],
    ['マ', 'ma'], ['ミ', 'mi'], ['ム', 'mu'], ['メ', 'me'], ['モ', 'mo'],
    ['ヤ', 'ya'], ['ユ', 'yu'], ['ヨ', 'yo'],
    ['ラ', 'ra'], ['リ', 'ri'], ['ル', 'ru'], ['レ', 're'], ['ロ', 'ro'],
    ['ワ', 'wa'], ['ヲ', 'wo'], ['ン', 'n'],
    ['ガ', 'ga'], ['ギ', 'gi'], ['グ', 'gu'], ['ゲ', 'ge'], ['ゴ', 'go'],
    ['ザ', 'za'], ['ジ', 'ji'], ['ズ', 'zu'], ['ゼ', 'ze'], ['ゾ', 'zo'],
    ['ダ', 'da'], ['ヂ', 'ji'], ['ヅ', 'zu'], ['デ', 'de'], ['ド', 'do'],
    ['バ', 'ba'], ['ビ', 'bi'], ['ブ', 'bu'], ['ベ', 'be'], ['ボ', 'bo'],
    ['パ', 'pa'], ['ピ', 'pi'], ['プ', 'pu'], ['ペ', 'pe'], ['ポ', 'po'],
    ['ャ', 'ya'], ['ュ', 'yu'], ['ョ', 'yo'],
  ])

  return [...value].map((char) => map.get(char) ?? char).join('')
}

function compareCandidates(left, right) {
  const leftGenki = left.jlptTags?.includes('Genki') ? 0 : 1
  const rightGenki = right.jlptTags?.includes('Genki') ? 0 : 1
  if (leftGenki !== rightGenki) {
    return leftGenki - rightGenki
  }

  const leftRu = left.translationRu ? 0 : 1
  const rightRu = right.translationRu ? 0 : 1
  if (leftRu !== rightRu) {
    return leftRu - rightRu
  }

  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence
  }

  return left.expression.localeCompare(right.expression, 'ja')
}

async function ensureFile(url, targetPath) {
  if (existsSync(targetPath)) {
    return
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }

  mkdirSync(path.dirname(targetPath), { recursive: true })
  await pipeline(response.body, createWriteStream(targetPath))
}

async function extractZipEntry(zipPath, entryName, outputPath) {
  await execFileAsync('powershell', [
    '-NoProfile',
    '-Command',
    `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead('${escapePs(zipPath)}')
    try {
      $entry = $zip.GetEntry('${escapePs(entryName)}')
      if (-not $entry) { throw 'Missing zip entry: ${escapePs(entryName)}' }
      $outDir = Split-Path -Parent '${escapePs(outputPath)}'
      New-Item -ItemType Directory -Force -Path $outDir | Out-Null
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, '${escapePs(outputPath)}', $true)
    } finally {
      $zip.Dispose()
    }
    `,
  ])
}

function escapePs(value) {
  return value.replace(/'/g, "''")
}
