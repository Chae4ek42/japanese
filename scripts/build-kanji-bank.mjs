/**
 * Собирает банк кандзи N5–N1 + Jōyō и слов из JMDict (rus) + теги JLPT vocab.
 * Вливает компоненты/мнемоники из скрейпа Kanshudo (после russify) и KRADFILE.
 *
 * Источники:
 * - OpenJLPT kanji/vocab JSON
 * - joyo2010 (CJKVI / Wikipedia Joyo list)
 * - jmdict-simplified jmdict-rus (EDRDG / CC-BY-SA)
 * - Kanshudo scrape (локальный кэш; не публиковать без проверки лицензий)
 * - KRADFILE (EDRDG) — запасной граф разложения
 *
 * Запуск: node scripts/build-kanji-bank.mjs
 */
import {
  copyFileSync,
  createReadStream,
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
import { createGunzip } from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'kanji-bank')
const OUT_DIR = path.join(ROOT, 'src', 'data', 'words')
const RU_COMPONENTS = path.join(ROOT, '.cache', 'ru', 'components-ru.json')

const OPENJLPT_BASE =
  'https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json'
const JOYO_URL =
  'https://gist.githubusercontent.com/KEINOS/fb660943484008b7f5297bb627e0e1b1/raw/joyo2010.json'
const JMDICT_RELEASE_API =
  'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest'
const KRADFILE_URL = 'http://ftp.edrdg.org/pub/Nihongo/kradfile.gz'
const RADKFILE_URL = 'http://ftp.edrdg.org/pub/Nihongo/radkfile.gz'

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

const RADICAL_MEANING_RU = {
  一: 'один', 丨: 'черта', 丶: 'точка', 丿: 'наклон', 乙: 'второй',
  亅: 'крюк', 二: 'два', 亠: 'крышка', 人: 'человек', 亻: 'человек',
  儿: 'ноги', 入: 'вход', 八: 'восемь', 冂: 'ограничение', 冖: 'крышка',
  冫: 'лёд', 几: 'столик', 凵: 'ёмкость', 刀: 'нож', 刂: 'нож',
  力: 'сила', 勹: 'обёртка', 匕: 'ложка', 匚: 'короб', 匸: 'скрыть',
  十: 'десять', 卜: 'гадание', 卩: 'печать', 厂: 'обрыв', 厶: 'личный',
  又: 'снова', 口: 'рот', 囗: 'ограда', 土: 'земля', 士: 'самурай',
  夂: 'идти', 夊: 'идти медленно', 夕: 'вечер', 大: 'большой', 女: 'женщина',
  子: 'ребёнок', 宀: 'крыша', 寸: 'сун', 小: 'маленький', 尢: 'хромой',
  尸: 'труп', 屮: 'росток', 山: 'гора', 巛: 'река', 川: 'река',
  工: 'работа', 己: 'сам', 巾: 'ткань', 干: 'сухой', 幺: 'короткий',
  广: 'навес', 廴: 'длинный шаг', 廾: 'две руки', 弋: 'стрела', 弓: 'лук',
  彐: 'свинья', 彡: 'щетина', 彳: 'шаг', 心: 'сердце', 忄: 'сердце',
  戈: 'алебарда', 戸: 'дверь', 手: 'рука', 扌: 'рука', 支: 'ветвь',
  攵: 'ударять', 文: 'письменность', 斗: 'мера', 斤: 'топор', 方: 'направление',
  无: 'нет', 日: 'солнце', 曰: 'сказать', 月: 'луна', 木: 'дерево',
  欠: 'нехватка', 止: 'стоп', 歹: 'смерть', 殳: 'оружие', 毋: 'не',
  母: 'мать', 比: 'сравнение', 毛: 'шерсть', 氏: 'клан', 气: 'пар',
  水: 'вода', 氵: 'вода', 火: 'огонь', 灬: 'огонь', 爪: 'коготь',
  父: 'отец', 爻: 'перекрестье', 爿: 'доска', 片: 'кусок', 牙: 'клык',
  牛: 'корова', 犬: 'собака', 犭: 'собака', 玄: 'тёмный', 玉: 'нефрит',
  王: 'король', 瓜: 'дыня', 瓦: 'черепица', 甘: 'сладкий', 生: 'жизнь',
  用: 'использовать', 田: 'поле', 疋: 'рулон', 疒: 'болезнь', 癶: 'ноги',
  白: 'белый', 皮: 'кожа', 皿: 'посуда', 目: 'глаз', 矛: 'копьё',
  矢: 'стрела', 石: 'камень', 示: 'показывать', 礻: 'алтарь', 禸: 'след',
  禾: 'зерно', 穴: 'дыра', 立: 'стоять', 竹: 'бамбук', 米: 'рис',
  糸: 'нить', 缶: 'банка', 网: 'сеть', 罒: 'сеть', 羊: 'овца',
  羽: 'перо', 老: 'старый', 而: 'и', 耒: 'плуг', 耳: 'ухо',
  聿: 'кисть', 肉: 'мясо', '⺼': 'мясо', 臣: 'министр', 自: 'сам',
  至: 'достигать', 臼: 'ступа', 舌: 'язык', 舛: 'ошибка', 舟: 'лодка',
  艮: 'остановка', 色: 'цвет', 艸: 'трава', 艹: 'трава', 虍: 'тигр',
  虫: 'насекомое', 血: 'кровь', 行: 'идти', 衣: 'одежда', 衤: 'одежда',
  襾: 'крышка', 見: 'видеть', 角: 'угол', 言: 'слово', 谷: 'долина',
  豆: 'боб', 豕: 'свинья', 豸: 'зверь', 貝: 'раковина', 赤: 'красный',
  走: 'бежать', 足: 'нога', 身: 'тело', 車: 'машина', 辛: 'острый',
  辰: 'дракон', 辵: 'движение', '⻌': 'движение', 邑: 'селение', 阝: 'холм',
  酉: 'саке', 釆: 'различать', 里: 'деревня', 金: 'металл', 長: 'длинный',
  門: 'ворота', 阜: 'холм', 隶: 'раб', 隹: 'птица', 雨: 'дождь',
  青: 'синий', 非: 'не', 面: 'лицо', 革: 'кожа', 韋: 'кожа',
  韭: 'лук', 音: 'звук', 頁: 'страница', 風: 'ветер', 飛: 'летать',
  食: 'еда', 飠: 'еда', 首: 'голова', 香: 'аромат', 馬: 'лошадь',
  骨: 'кость', 高: 'высокий', 髟: 'волосы', 鬥: 'борьба', 鬯: 'жертва',
  鬲: 'треножник', 鬼: 'демон', 魚: 'рыба', 鳥: 'птица', 鹵: 'соль',
  鹿: 'олень', 麦: 'пшеница', 麻: 'конопля', 黄: 'жёлтый', 黍: 'просо',
  黒: 'чёрный', 黹: 'вышивка', 黽: 'лягушка', 鼎: 'треножник', 鼓: 'барабан',
  鼠: 'крыса', 鼻: 'нос', 齊: 'ровный', 歯: 'зуб', 龍: 'дракон',
  龜: 'черепаха', 龠: 'флейта', 五: 'пять', 吾: 'я', 语: 'язык',
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
  if (typeof level === 'number' && level >= 1 && level <= 5) return level
  if (level === 'N5' || level === 5 || level === 'n5') return 5
  if (level === 'N4' || level === 4 || level === 'n4') return 4
  if (level === 'N3' || level === 3 || level === 'n3') return 3
  if (level === 'N2' || level === 2 || level === 'n2') return 2
  if (level === 'N1' || level === 1 || level === 'n1') return 1
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

async function downloadGunzipText(url, destGz, destTxt, { encoding = 'utf8' } = {}) {
  if (existsSync(destTxt)) {
    console.log(`cache hit: ${path.basename(destTxt)}`)
    return destTxt
  }
  await download(url, destGz)
  console.log(`gunzip: ${path.basename(destGz)}`)
  const chunks = []
  const gunzipped = createReadStream(destGz).pipe(createGunzip())
  for await (const chunk of gunzipped) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  let text
  if (encoding === 'euc-jp') {
    text = new TextDecoder('euc-jp').decode(buffer)
  } else {
    text = buffer.toString('utf8')
  }
  writeFileSync(destTxt, text)
  return destTxt
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
  // jmdict-rus JSON exposes priority as `common: true` on kanji/kana forms
  // (not as ichi1/news1 tags — those appear in the XML dump).
  const forms = [...(entry.kanji ?? []), ...(entry.kana ?? [])]
  if (forms.some((form) => form?.common === true)) return true
  const tags = forms.flatMap((form) => form.tags ?? [])
  return tags.some((tag) => /^(ichi|news|spec|gai)\d/.test(String(tag)))
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
      const wordKey = item.word
      const prevWord = map.get(wordKey)
      if (!prevWord || n > prevWord) {
        map.set(wordKey, n)
      }
    }
  }
  return map
}

function parseKradfile(text) {
  const map = new Map()
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('[')) continue
    const parts = line.split(/\s*:\s*/)
    if (parts.length < 2) continue
    const kanji = parts[0].trim()
    const radicals = parts[1]
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .filter((r) => r !== kanji)
    if (kanji) map.set(kanji, radicals)
  }
  return map
}

function loadRuComponents() {
  if (!existsSync(RU_COMPONENTS)) {
    console.warn('no russified scrape yet — components from KRADFILE only')
    return {}
  }
  return JSON.parse(readFileSync(RU_COMPONENTS, 'utf8'))
}

function mergeComponents(character, scraped, kradParts) {
  if (scraped?.components?.length) {
    return scraped.components.map((c) => ({
      id: c.id || c.glyph,
      glyph: c.glyph || c.id,
      role: c.role || 'grapheme',
      meaningRu: c.meaningRu || RADICAL_MEANING_RU[c.glyph] || RADICAL_MEANING_RU[c.id] || '',
      nameRu: c.nameRu,
    }))
  }
  if (!kradParts?.length) return []
  return kradParts.map((glyph) => ({
    id: glyph,
    glyph,
    role: 'radical',
    meaningRu: RADICAL_MEANING_RU[glyph] || '',
  }))
}

function buildCompositionNote(character, components, scrapedNote) {
  if (scrapedNote) return scrapedNote
  if (!components?.length) return undefined
  const formula = `${components.map((c) => c.glyph).join(' + ')} → ${character}`
  const meanings = components
    .map((c) => c.meaningRu)
    .filter(Boolean)
    .join(', ')
  return meanings ? `${formula}: ${meanings}` : formula
}

async function main() {
  ensureDir(CACHE)
  ensureDir(OUT_DIR)

  const kanjiByLevel = {}
  for (const level of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    kanjiByLevel[level] = await downloadJson(
      `${OPENJLPT_BASE}/kanji/${level}.json`,
      path.join(CACHE, `openjlpt-kanji-${level}.json`),
    )
  }

  const joyoData = await downloadJson(JOYO_URL, path.join(CACHE, 'joyo2010.json'))
  const joyoSet = new Set(
    Object.values(joyoData)
      .map((entry) => entry?.joyo_kanji)
      .filter(Boolean),
  )
  console.log(`joyo: ${joyoSet.size}`)

  const vocabByLevel = {}
  for (const level of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    vocabByLevel[level.toUpperCase()] = await downloadJson(
      `${OPENJLPT_BASE}/vocab/${level}.json`,
      path.join(CACHE, `openjlpt-vocab-${level}.json`),
    )
  }

  const jlptVocab = buildJlptVocabMap(vocabByLevel)

  let kradMap = new Map()
  try {
    const kradPath = await downloadGunzipText(
      KRADFILE_URL,
      path.join(CACHE, 'kradfile.gz'),
      path.join(CACHE, 'kradfile.txt'),
      { encoding: 'euc-jp' },
    )
    kradMap = parseKradfile(readFileSync(kradPath, 'utf8'))
    console.log(`kradfile entries: ${kradMap.size}`)
  } catch (error) {
    console.warn('kradfile download failed:', error.message)
  }

  // optional radkfile presence (not required for build)
  try {
    await downloadGunzipText(
      RADKFILE_URL,
      path.join(CACHE, 'radkfile.gz'),
      path.join(CACHE, 'radkfile.txt'),
      { encoding: 'euc-jp' },
    )
  } catch {
    /* optional */
  }

  const ruByChar = loadRuComponents()

  const kanjiList = []
  const kanjiLevelMap = new Map()

  // Prefer higher JLPT number first so N5 wins over N1 if duplicates (shouldn't happen).
  for (const level of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    const n = levelToNumber(level)
    for (const item of kanjiByLevel[level]) {
      const ch = item.character
      if (kanjiLevelMap.has(ch)) continue
      kanjiLevelMap.set(ch, n)
      const scraped = ruByChar[ch]
      const components = mergeComponents(ch, scraped, kradMap.get(ch))
      kanjiList.push({
        id: ch,
        character: ch,
        level: n,
        levelLabel: `N${n}`,
        strokes: item.strokes ?? scraped?.strokes ?? null,
        meanings: (item.meanings ?? []).slice(0, 4),
        meaningsRu: scraped?.meaningsRu?.length ? scraped.meaningsRu.slice(0, 4) : undefined,
        onyomi: item.onyomi ?? [],
        kunyomi: item.kunyomi ?? [],
        joyo: joyoSet.has(ch) || Boolean(scraped?.joyo),
        grade: scraped?.grade,
        radicalNumber: scraped?.radicalNumber,
        components,
        mnemonicRu: scraped?.mnemonicRu,
        compositionNoteRu: buildCompositionNote(ch, components, scraped?.compositionNoteRu),
      })
    }
  }

  // Add Joyo-only kanji missing from OpenJLPT.
  for (const ch of joyoSet) {
    if (kanjiLevelMap.has(ch)) continue
    const scraped = ruByChar[ch]
    const joyoEntry = Object.values(joyoData).find((e) => e?.joyo_kanji === ch)
    const components = mergeComponents(ch, scraped, kradMap.get(ch))
    kanjiLevelMap.set(ch, 0)
    kanjiList.push({
      id: ch,
      character: ch,
      level: 0,
      levelLabel: 'Jōyō',
      strokes: scraped?.strokes ?? null,
      meanings: [],
      meaningsRu: scraped?.meaningsRu?.length ? scraped.meaningsRu.slice(0, 4) : undefined,
      onyomi: joyoEntry?.yomi?.on_yomi ?? [],
      kunyomi: joyoEntry?.yomi?.kun_yomi ?? [],
      joyo: true,
      grade: scraped?.grade,
      radicalNumber: scraped?.radicalNumber,
      components,
      mnemonicRu: scraped?.mnemonicRu,
      compositionNoteRu: buildCompositionNote(ch, components, scraped?.compositionNoteRu),
    })
  }

  // Mark joyo on all matching entries.
  for (const item of kanjiList) {
    if (joyoSet.has(item.character)) item.joyo = true
  }

  const targetKanji = new Set(kanjiLevelMap.keys())
  console.log(`kanji total: ${targetKanji.size}`)

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

    const jlpt = jlptVocab.get(`${surface}::${reading}`) ?? jlptVocab.get(surface) ?? null

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

  // Build components catalog + usedIn
  const componentMap = new Map()
  for (const item of kanjiList) {
    for (const ref of item.components ?? []) {
      const id = ref.id || ref.glyph
      if (!id) continue
      let entry = componentMap.get(id)
      if (!entry) {
        entry = {
          id,
          glyph: ref.glyph || id,
          kind: targetKanji.has(id) ? 'kanji' : 'radical',
          meaningsRu: ref.meaningRu ? [ref.meaningRu] : RADICAL_MEANING_RU[id] ? [RADICAL_MEANING_RU[id]] : [],
          mnemonicRu: undefined,
          strokes: undefined,
          usedIn: [],
        }
        componentMap.set(id, entry)
      } else if (ref.meaningRu && !entry.meaningsRu.includes(ref.meaningRu)) {
        entry.meaningsRu.push(ref.meaningRu)
      }
      if (!entry.usedIn.includes(item.character)) {
        entry.usedIn.push(item.character)
      }
    }
  }

  // Enrich component entries that are themselves kanji.
  for (const [id, entry] of componentMap) {
    const asKanji = kanjiList.find((k) => k.character === id)
    if (asKanji) {
      entry.kind = 'kanji'
      entry.strokes = asKanji.strokes ?? undefined
      entry.mnemonicRu = asKanji.mnemonicRu
      if (asKanji.meaningsRu?.length) {
        entry.meaningsRu = [...new Set([...asKanji.meaningsRu, ...entry.meaningsRu])]
      } else if (asKanji.meanings?.length && !entry.meaningsRu.length) {
        entry.meaningsRu = asKanji.meanings.slice(0, 3)
      }
    }
    entry.usedIn.sort((a, b) => a.localeCompare(b, 'ja'))
  }

  const components = [...componentMap.values()].sort((a, b) => a.glyph.localeCompare(b.glyph, 'ja'))

  const meta = {
    builtAt: new Date().toISOString(),
    sources: {
      kanji: 'OpenJLPT N5–N1 + joyo2010',
      vocabTags: 'OpenJLPT',
      dictionary: `jmdict-simplified ${tag} (rus)`,
      components: existsSync(RU_COMPONENTS)
        ? 'Kanshudo scrape (local) + KRADFILE fallback'
        : 'KRADFILE',
      radicals: 'EDRDG KRADFILE',
    },
    counts: {
      kanji: kanjiList.length,
      words: words.length,
      components: components.length,
      joyo: kanjiList.filter((k) => k.joyo).length,
      n5: kanjiList.filter((k) => k.level === 5).length,
      n4: kanjiList.filter((k) => k.level === 4).length,
      n3: kanjiList.filter((k) => k.level === 3).length,
      n2: kanjiList.filter((k) => k.level === 2).length,
      n1: kanjiList.filter((k) => k.level === 1).length,
      joyoOnly: kanjiList.filter((k) => k.level === 0).length,
      withComponents: kanjiList.filter((k) => (k.components ?? []).length > 0).length,
    },
  }

  writeFileSync(path.join(OUT_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  writeFileSync(path.join(OUT_DIR, 'kanji-list.json'), `${JSON.stringify(kanjiList)}\n`)
  writeFileSync(path.join(OUT_DIR, 'words.json'), `${JSON.stringify(words)}\n`)
  writeFileSync(path.join(OUT_DIR, 'words-by-kanji.json'), `${JSON.stringify(wordsByKanji)}\n`)
  writeFileSync(path.join(OUT_DIR, 'components.json'), `${JSON.stringify(components)}\n`)

  console.log('done:', meta.counts)
  console.log(`output: ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
