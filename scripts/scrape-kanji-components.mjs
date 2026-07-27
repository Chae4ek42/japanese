/**
 * Скрейп компонентов/заметок Kanshudo для локального использования.
 *
 * Кэш: .cache/kanshudo/{char}.html
 * Выход: .cache/kanshudo/components-raw.json
 *
 * Rate-limit + resume. Артефакты скрейпа не коммитить без проверки лицензий.
 *
 * Запуск:
 *   node scripts/scrape-kanji-components.mjs
 *   node scripts/scrape-kanji-components.mjs --limit=50
 *   node scripts/scrape-kanji-components.mjs --chars=日,語,緑
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'kanshudo')
const BANK_CACHE = path.join(ROOT, '.cache', 'kanji-bank')
const OUT = path.join(CACHE, 'components-raw.json')
const JOYO_URL =
  'https://gist.githubusercontent.com/KEINOS/fb660943484008b7f5297bb627e0e1b1/raw/joyo2010.json'
const OPENJLPT_BASE =
  'https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json/kanji'

const UA = 'jp-local-kanji-component-scraper/1.0 (+local educational use)'
const DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 450)

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripQuotes(text) {
  return String(text)
    .replace(/^['"‘’“”]+|['"‘’“”]+$/g, '')
    .trim()
}

function parseArgs(argv) {
  const out = { limit: null, chars: null, force: false }
  for (const arg of argv) {
    if (arg === '--force') out.force = true
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.slice(8))
    else if (arg.startsWith('--chars=')) {
      out.chars = arg
        .slice(8)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return out
}

async function downloadJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`Failed ${url}: ${response.status}`)
  return response.json()
}

async function loadTargetChars(args) {
  if (args.chars?.length) return [...new Set(args.chars)]

  ensureDir(BANK_CACHE)
  const joyoPath = path.join(BANK_CACHE, 'joyo2010.json')
  let joyo
  if (existsSync(joyoPath)) {
    joyo = JSON.parse(readFileSync(joyoPath, 'utf8'))
  } else {
    console.log('download joyo2010…')
    joyo = await downloadJson(JOYO_URL)
    writeFileSync(joyoPath, `${JSON.stringify(joyo)}\n`)
  }

  const chars = new Set()
  for (const entry of Object.values(joyo)) {
    if (entry?.joyo_kanji) chars.add(entry.joyo_kanji)
  }

  for (const level of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    const dest = path.join(BANK_CACHE, `openjlpt-kanji-${level}.json`)
    let list
    if (existsSync(dest)) {
      list = JSON.parse(readFileSync(dest, 'utf8'))
    } else {
      list = await downloadJson(`${OPENJLPT_BASE}/${level}.json`)
      writeFileSync(dest, `${JSON.stringify(list)}\n`)
    }
    for (const item of list) {
      if (item?.character) chars.add(item.character)
    }
  }

  let all = [...chars]
  if (args.limit && Number.isFinite(args.limit)) {
    all = all.slice(0, args.limit)
  }
  return all
}

function cachePath(character) {
  const code = [...character].map((ch) => ch.codePointAt(0).toString(16)).join('-')
  return path.join(CACHE, `${code}.html`)
}

async function fetchPage(character, { force = false } = {}) {
  const dest = cachePath(character)
  if (!force && existsSync(dest)) {
    return { html: readFileSync(dest, 'utf8'), cached: true }
  }
  const url = `https://www.kanshudo.com/kanji/${encodeURIComponent(character)}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${character}`)
  }
  const html = await response.text()
  writeFileSync(dest, html)
  return { html, cached: false }
}

function extractRow(html, label) {
  const re = new RegExp(
    `col-colors search[^>]*>\\s*${label}\\s*<\\/div>\\s*<div class="col-3-4">([\\s\\S]*?)<\\/div>\\s*<\\/div>`,
    'i',
  )
  const match = html.match(re)
  return match ? match[1] : ''
}

function parseMeanings(html, character) {
  const escaped = character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sources = []
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1) sources.push(decodeEntities(h1[1]))
  const titleMatch = html.match(new RegExp(`${escaped}\\s+means\\s+([^.<\\n]+)`, 'i'))
  if (titleMatch) sources.push(decodeEntities(titleMatch[0]))

  for (const text of sources) {
    const m = text.match(/means\s+(.+)$/i)
    if (!m) continue
    const meanings = m[1]
      .split(/\s+or\s+/i)
      .map((part) => stripQuotes(part))
      .filter(Boolean)
    if (meanings.length) return meanings
  }
  return []
}

function parseKeywords(html) {
  const section =
    html.match(/class="kdetails2"[\s\S]{0,3500}/i)?.[0] ??
    html.match(/>KEYWORDS<\/a>[\s\S]{0,3500}/i)?.[0] ??
    ''
  const plain = decodeEntities(section.replace(/<br\s*\/?>/gi, ' '))
  const strokes = Number(plain.match(/Strokes\s*:\s*(\d+)/i)?.[1] ?? NaN)
  const radicalNumber = Number(plain.match(/Radical number:\s*(\d+)/i)?.[1] ?? NaN)
  const jlpt = plain.match(/JLPT:\s*N(\d)/i)?.[1]
  const grade = Number(plain.match(/Grade:\s*(\d+)/i)?.[1] ?? NaN)
  const joyo = /Jōyō\s*\(|Joyo\s*\(/i.test(plain) || /Jōyō \(常用\)/i.test(section)
  return {
    strokes: Number.isFinite(strokes) ? strokes : undefined,
    radicalNumber: Number.isFinite(radicalNumber) ? radicalNumber : undefined,
    jlpt: jlpt ? Number(jlpt) : undefined,
    grade: Number.isFinite(grade) ? grade : undefined,
    joyo,
  }
}

function parseComponentsRow(html) {
  const row = extractRow(html, 'Components')
  if (!row || /Not used as a component/i.test(row)) return []

  const parts = []
  const seen = new Set()
  const linkRe = /<a[^>]*href=['"]\/kanji\/([^'"]+)['"][^>]*>\s*([^<]+)\s*<\/a>((?:(?!<a\b)[\s\S])*?)(?=<a\b|⿰|⿱|⿲|⿳|⿴|⿵|⿶|⿷|⿸|⿹|⿺|⿻|<div|$)/gi
  let match
  while ((match = linkRe.exec(row))) {
    const glyph = decodeURIComponent(match[1])
    if (seen.has(glyph)) continue
    seen.add(glyph)
    const display = decodeEntities(match[2]) || glyph
    const meaning = decodeEntities(match[3])
      .replace(/^[\s;&]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
    parts.push({
      id: glyph,
      glyph: display || glyph,
      role: 'grapheme',
      meaningEn: meaning || undefined,
    })
  }
  return parts
}

function parseCascadeDirectChildren(html) {
  const section = html.match(/Cascading kanji view[\s\S]*?(?=<div class="spaced problem_report"|<\/div>\s*<div class="callout")/i)?.[0]
  if (!section) return []

  const rows = [...section.matchAll(/<div class='kanjirow level(\d+)[^']*'[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<div class='reading'>([\s\S]*?)<\/div>/gi)]
  const children = []
  for (const row of rows) {
    const level = Number(row[1])
    if (level !== 1) continue
    const glyph = decodeEntities(row[2])
    const reading = decodeEntities(row[3])
    // meaning often after readings: "... say; word ..."
    const meaningMatch = reading.match(/([a-z][a-z ;,-]{1,80})$/i)
    children.push({
      id: glyph,
      glyph,
      role: 'grapheme',
      meaningEn: meaningMatch?.[1]?.trim(),
    })
  }
  return children
}

function parseNotes(html) {
  const row = extractRow(html, 'Notes')
  if (!row) return undefined
  const text = decodeEntities(row)
  if (!text || text.length < 8) return undefined
  return text
}

function parsePage(character, html) {
  const keywords = parseKeywords(html)
  const fromRow = parseComponentsRow(html)
  const fromCascade = parseCascadeDirectChildren(html)
  const components = fromRow.length ? fromRow : fromCascade
  return {
    character,
    meaningsEn: parseMeanings(html, character),
    mnemonicEn: parseNotes(html),
    compositionNoteEn: parseNotes(html),
    components,
    ...keywords,
    scrapedAt: new Date().toISOString(),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  ensureDir(CACHE)

  const targets = await loadTargetChars(args)
  console.log(`targets: ${targets.length}`)

  const raw = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  let fetched = 0
  let cached = 0
  let failed = 0

  for (let i = 0; i < targets.length; i += 1) {
    const character = targets[i]
    const progress = `[${i + 1}/${targets.length}] ${character}`
    try {
      const { html, cached: wasCached } = await fetchPage(character, { force: args.force })
      if (wasCached) cached += 1
      else {
        fetched += 1
        await sleep(DELAY_MS)
      }
      raw[character] = parsePage(character, html)
      if ((i + 1) % 25 === 0 || i === targets.length - 1) {
        writeFileSync(OUT, `${JSON.stringify(raw)}\n`)
        console.log(`${progress} saved (fetched=${fetched} cached=${cached} failed=${failed})`)
      } else if (!wasCached) {
        console.log(`${progress} ok`)
      }
    } catch (error) {
      failed += 1
      console.warn(`${progress} FAIL: ${error.message}`)
      await sleep(DELAY_MS * 2)
    }
  }

  writeFileSync(OUT, `${JSON.stringify(raw, null, 2)}\n`)
  console.log('done:', { total: Object.keys(raw).length, fetched, cached, failed, out: OUT })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
