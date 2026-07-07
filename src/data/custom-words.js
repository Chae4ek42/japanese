import { hiraganaToKatakana, kanaToRomaji } from '../lib/romaji.js'

export const CUSTOM_WORD_ID_PREFIX = 'custom-'

export function isCustomWordId(wordId) {
  return typeof wordId === 'string' && wordId.startsWith(CUSTOM_WORD_ID_PREFIX)
}

function hasKana(text) {
  return /[\u3040-\u309f\u30a0-\u30ff]/.test(text)
}

function parseMeanings(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof raw !== 'string') {
    return []
  }
  return raw
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function enrichCustomWord(raw) {
  if (!raw?.id) {
    return null
  }

  const kanji = String(raw.kanji ?? '').trim()
  const kana = String(raw.kana ?? '').trim()
  const romajiInput = String(raw.romaji ?? '').trim()
  const meanings = parseMeanings(raw.meanings ?? raw.meaning)
  const audio = String(raw.audio ?? '').trim()
  const en = String(raw.en ?? '').trim()
  const pos = Array.isArray(raw.pos) ? raw.pos.filter(Boolean) : []

  const displayKana = kana || (hasKana(kanji) ? kanji : '')
  const romaji =
    romajiInput ||
    (displayKana && hasKana(displayKana) ? kanaToRomaji(displayKana) : '') ||
    ''
  const displayKanji = kanji || displayKana || romaji || '—'
  const katakana = displayKana && hasKana(displayKana) ? hiraganaToKatakana(displayKana) : displayKana

  return {
    id: raw.id,
    kanji: displayKanji,
    kana: displayKana || displayKanji,
    katakana: katakana || displayKana || displayKanji,
    romaji,
    meanings,
    en,
    pos,
    audio,
    lessonId: null,
    custom: true,
  }
}

export function createCustomWordFromInput(input = {}) {
  const kanji = String(input.kanji ?? '').trim()
  const kana = String(input.kana ?? '').trim()
  const romaji = String(input.romaji ?? '').trim()
  const meanings = parseMeanings(input.meanings ?? input.meaning)
  const audio = String(input.audio ?? '').trim()
  const en = String(input.en ?? '').trim()

  if (!kanji && !kana && !romaji && !meanings.length) {
    return { error: 'Заполните хотя бы одно поле.' }
  }

  const id = `${CUSTOM_WORD_ID_PREFIX}${crypto.randomUUID()}`
  const word = enrichCustomWord({ id, kanji, kana, romaji, meanings, audio, en })
  return { word }
}

export function sanitizeCustomWords(customWords, dictionary = []) {
  const dictionarySet = new Set(dictionary)
  const seen = new Set()
  const sanitized = []

  for (const entry of customWords ?? []) {
    if (!entry?.id || !isCustomWordId(entry.id) || seen.has(entry.id) || !dictionarySet.has(entry.id)) {
      continue
    }
    const word = enrichCustomWord(entry)
    if (!word) {
      continue
    }
    seen.add(word.id)
    sanitized.push({
      id: word.id,
      kanji: String(entry.kanji ?? '').trim(),
      kana: String(entry.kana ?? '').trim(),
      romaji: String(entry.romaji ?? '').trim(),
      meanings: word.meanings,
      audio: String(entry.audio ?? '').trim(),
      en: String(entry.en ?? '').trim(),
      pos: word.pos,
    })
  }

  return sanitized
}

export function sanitizeDictionary(dictionary, customWords = [], validBuiltinIds = new Set()) {
  const customIds = new Set(customWords.map((word) => word.id))
  const seen = new Set()
  const sanitized = []

  for (const wordId of dictionary ?? []) {
    if (typeof wordId !== 'string' || seen.has(wordId)) {
      continue
    }
    if (validBuiltinIds.has(wordId) || customIds.has(wordId)) {
      seen.add(wordId)
      sanitized.push(wordId)
    }
  }

  return sanitized
}
