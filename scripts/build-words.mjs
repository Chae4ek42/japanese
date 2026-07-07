// Преобразует public/data/jwords-vocabulary.json (или jlpt fallback) в src/data/words.data.js
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { kanaToRomaji } from '../src/lib/romaji.js'

const JWORDS_SOURCE = 'public/data/jwords-vocabulary.json'
const JLPT_SOURCE = 'public/data/jlpt-n5-words-300.json'
const TARGET = 'src/data/words.data.js'

const RU_OVERRIDES = {
  'o-okane-9859876a': ['деньги'],
  'i-yasui-ad63c41b': ['дешёвый', 'недорогой'],
  'kutsu-f0e2db11': ['обувь', 'ботинки', 'туфли'],
  'kiyoudai-38102230': ['братья и сёстры', 'брат', 'сестра'],
  'tsugi-fda41b7f': ['следующий', 'затем'],
  'sai-chiisai-9a481e9c': ['маленький', 'небольшой', 'мелкий'],
  'nai-sukunai-cec36ae5': ['мало', 'немногочисленный', 'скудный'],
  'i-karai-f55c2273': ['острый', 'горький', 'солёный'],
  'toshiyokan-3573eaf3': ['библиотека'],
  'i-aoi-2f1acf47': ['синий', 'голубой', 'зелёный'],
  'ku-hiku-b5c09767': ['играть (на инструменте)', 'играть'],
  'michi-cf2f4e74': ['дорога', 'путь', 'улица'],
  'otouto-8d83340a': ['младший брат'],
  'mise-1601280a': ['магазин', 'лавка'],
  'futari-a3f13d54': ['два человека', 'двое', 'пара'],
  'ru-tsukuru-5ad95ade': ['делать', 'изготовлять', 'создавать'],
  'ishiyo-50b753e4': ['вместе'],
  'ku-hiku-de627343': ['тянуть', 'тащить', 'вычитать'],
  'migi-7798e420': ['правый', 'направо', 'справа'],
  'shita-7b45beb2': ['низ', 'внизу', 'под'],
  'heta-d767c434': ['неумелый', 'плохой', 'неловкий'],
  'ru-kiru-9291c56d': ['резать', 'отрезать', 'вешать трубку'],
}

const POS_LABELS = {
  n: 'сущ.',
  'n-pref': 'префикс',
  'n-suf': 'суффикс',
  pn: 'местоим.',
  num: 'числит.',
  ctr: 'счётн. слово',
  exp: 'выражение',
  adv: 'наречие',
  'adj-i': 'い-прил.',
  'adj-na': 'な-прил.',
  'adj-no': 'の-прил.',
  'adj-f': 'приимен.',
  v1: 'глагол (ру)',
  v5b: 'глагол (у)',
  v5g: 'глагол (у)',
  v5k: 'глагол (у)',
  v5m: 'глагол (у)',
  v5n: 'глагол (у)',
  v5r: 'глагол (у)',
  v5s: 'глагол (у)',
  v5t: 'глагол (у)',
  v5u: 'глагол (у)',
  vs: 'суру-глагол',
  vi: 'неперех.',
  vt: 'перех.',
  vn: 'глагол',
  hon: 'вежл.',
  hum: 'скромн.',
  pol: 'вежл.',
  uk: 'обычно каной',
  abbr: 'сокр.',
  suf: 'суффикс',
}

const JP_CHARS = /[\u3040-\u30ff\u4e00-\u9fff\u3000-\u303f]/

function cleanRuText(text) {
  let result = text
  result = result.replace(/【[^】]*】/g, '')
  result = result.replace(/\{[^}]*\}/g, '')
  for (let i = 0; i < 4; i += 1) {
    result = result.replace(/\([^()]*\)/g, '')
  }
  result = result.replace(/\d+\)\s*/g, '')
  result = result.replace(/[а-яё]\)\s*/gi, '')
  result = result.replace(/[[\]]/g, '')
  result = result.replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, '')
  result = result.replace(/\s+/g, ' ')
  return result
}

function extractMeanings(word) {
  if (RU_OVERRIDES[word.id]) {
    return RU_OVERRIDES[word.id]
  }

  const chunks = [word.translation_ru, ...(word.notes_ru ?? [])]
    .flatMap((chunk) => String(chunk || '').split(';'))
    .map(cleanRuText)
    .filter((chunk) => chunk && !JP_CHARS.test(chunk))

  const meanings = []
  for (const chunk of chunks) {
    for (const piece of chunk.split(',')) {
      const meaning = piece.trim().replace(/^[\s:;.-]+|[\s:;.-]+$/g, '')
      const balanced =
        (meaning.match(/\(/g) ?? []).length === (meaning.match(/\)/g) ?? []).length
      if (meaning && meaning.length >= 2 && balanced && !meanings.includes(meaning)) {
        meanings.push(meaning)
      }
    }
  }

  return meanings
}

function extractPosLabels(pos) {
  const labels = []
  for (const tag of (pos ?? '').split(/\s+/)) {
    const label = POS_LABELS[tag]
    if (label && !labels.includes(label)) {
      labels.push(label)
    }
  }
  return labels
}

function cleanImportedMeanings(meanings) {
  const result = []
  for (const raw of meanings ?? []) {
    let meaning = String(raw).trim()
    if (!meaning) continue
    if (meaning.includes('(')) {
      meaning = meaning.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    }
    if (meaning.length > 40) {
      meaning = meaning.slice(0, 40).trim()
    }
    if (meaning && !result.includes(meaning)) {
      result.push(meaning)
    }
  }
  return result
}

function buildFromJwords(source) {
  const problems = []
  const words = source.words.map((word) => {
    const meanings = cleanImportedMeanings(word.meanings)
    if (!meanings.length) {
      problems.push(`${word.id}: нет перевода`)
    }
    let romaji = word.romaji
    if (!romaji) {
      romaji = kanaToRomaji(word.kana)
    }
    return {
      id: word.id,
      kanji: word.kanji,
      kana: word.kana,
      romaji,
      meanings,
      en: word.en || '',
      pos: word.pos ?? [],
      audio: word.audio || '',
      lessonId: word.lessonId ?? null,
    }
  })

  if (problems.length) {
    console.error('Проблемные записи:')
    for (const problem of problems) {
      console.error('  ' + problem)
    }
    process.exit(1)
  }

  return { version: source.version, source: source.source, words }
}

function buildFromJlpt(source) {
  const problems = []
  const words = source.words.map((word) => {
    const meanings = extractMeanings(word)
    if (!meanings.length) {
      problems.push(`${word.id}: нет чистого русского перевода`)
    }
    const romaji = kanaToRomaji(word.kana)
    return {
      id: word.id,
      kanji: word.kanji,
      kana: word.kana,
      romaji,
      meanings,
      en: word.translation_en,
      pos: extractPosLabels(word.pos),
      audio: word.audio,
    }
  })

  if (problems.length) {
    console.error('Проблемные записи:')
    for (const problem of problems) {
      console.error('  ' + problem)
    }
    process.exit(1)
  }

  return { version: source.version, source: 'jlpt-n5-words-300.json', words }
}

const useJwords = existsSync(JWORDS_SOURCE)
const source = JSON.parse(readFileSync(useJwords ? JWORDS_SOURCE : JLPT_SOURCE, 'utf8'))
const payload = useJwords ? buildFromJwords(source) : buildFromJlpt(source)

const banner = '// Сгенерировано scripts/build-words.mjs — не редактировать вручную.\n'
writeFileSync(TARGET, `${banner}export default ${JSON.stringify(payload, null, 1)}\n`)
console.log(`OK: ${payload.words.length} слов (${payload.source}) -> ${TARGET}`)
