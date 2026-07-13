import { DEFAULT_HYPERPARAMS } from '../lib/trainer.js'

export const NUMBER_HYPERPARAMS = { ...DEFAULT_HYPERPARAMS }

export const NUMBER_MODES = [
  {
    id: 'plain',
    label: 'Числа',
    hint: 'Арабская цифра → чтение по-японски (кандзи и кана).',
  },
  {
    id: 'age',
    label: 'Возраст',
    hint: 'Сколько лет → японское выражение с 歳.',
  },
]

export const NUMBER_RANGES = [
  { id: '10', label: '1–10', min: 1, max: 10 },
  { id: '99', label: '1–99', min: 1, max: 99 },
  { id: '999', label: '1–999', min: 1, max: 999 },
]

const KANJI_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

const ONES_KANA = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']
const ONES_ROMAJI = ['', 'ichi', 'ni', 'san', 'yon', 'go', 'roku', 'nana', 'hachi', 'kyuu']

function joinReadings(parts) {
  return parts.filter(Boolean).join('')
}

function joinRomaji(parts) {
  return parts.filter(Boolean).join('')
}

function readUnder100(n) {
  if (n === 0) {
    return { kana: 'れい', romaji: 'rei' }
  }
  if (n < 10) {
    return { kana: ONES_KANA[n], romaji: ONES_ROMAJI[n] }
  }
  if (n === 10) {
    return { kana: 'じゅう', romaji: 'juu' }
  }

  const tens = Math.floor(n / 10)
  const ones = n % 10
  const tensKana = tens === 1 ? 'じゅう' : `${ONES_KANA[tens]}じゅう`
  const tensRomaji = tens === 1 ? 'juu' : `${ONES_ROMAJI[tens]}juu`
  if (ones === 0) {
    return { kana: tensKana, romaji: tensRomaji }
  }
  return {
    kana: joinReadings([tensKana, ONES_KANA[ones]]),
    romaji: joinRomaji([tensRomaji, ONES_ROMAJI[ones]]),
  }
}

function readHundreds(n) {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  let headKana
  let headRomaji

  if (hundreds === 1) {
    headKana = 'ひゃく'
    headRomaji = 'hyaku'
  } else if (hundreds === 3) {
    headKana = 'さんびゃく'
    headRomaji = 'sanbyaku'
  } else if (hundreds === 6) {
    headKana = 'ろっぴゃく'
    headRomaji = 'roppyaku'
  } else if (hundreds === 8) {
    headKana = 'はっぴゃく'
    headRomaji = 'happyaku'
  } else {
    headKana = `${ONES_KANA[hundreds]}ひゃく`
    headRomaji = `${ONES_ROMAJI[hundreds]}hyaku`
  }

  if (rest === 0) {
    return { kana: headKana, romaji: headRomaji }
  }

  const tail = readUnder100(rest)
  return {
    kana: joinReadings([headKana, tail.kana]),
    romaji: joinRomaji([headRomaji, tail.romaji]),
  }
}

function readUnder1000(n) {
  if (n < 100) {
    return readUnder100(n)
  }
  return readHundreds(n)
}

function numberToKanji(n) {
  if (n === 0) {
    return KANJI_DIGITS[0]
  }
  if (n < 10) {
    return KANJI_DIGITS[n]
  }
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    if (tens === 1) {
      return ones === 0 ? '十' : `十${KANJI_DIGITS[ones]}`
    }
    return ones === 0 ? `${KANJI_DIGITS[tens]}十` : `${KANJI_DIGITS[tens]}十${KANJI_DIGITS[ones]}`
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    const head = hundreds === 1 ? '百' : `${KANJI_DIGITS[hundreds]}百`
    return rest === 0 ? head : `${head}${numberToKanji(rest)}`
  }
  return String(n)
}

export function formatNumberReading(n) {
  const value = Number(n)
  if (!Number.isInteger(value) || value < 0 || value > 999) {
    throw new RangeError(`Число вне диапазона: ${n}`)
  }

  const reading = readUnder1000(value)
  return {
    kanji: numberToKanji(value),
    kana: reading.kana,
    romaji: reading.romaji,
  }
}

export function formatAgeReading(n) {
  const value = Number(n)
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new RangeError(`Возраст вне диапазона: ${n}`)
  }

  if (value === 20) {
    return {
      kanji: '二十歳',
      kana: 'はたち',
      romaji: 'hatachi',
    }
  }

  const specialAge = {
    1: { kana: 'いっさい', romaji: 'issai' },
    8: { kana: 'はっさい', romaji: 'hassai' },
    10: { kana: 'じっさい', romaji: 'jissai' },
  }

  if (specialAge[value]) {
    return {
      kanji: `${numberToKanji(value)}歳`,
      ...specialAge[value],
    }
  }

  const base = formatNumberReading(value)
  return {
    kanji: `${base.kanji}歳`,
    kana: `${base.kana}さい`,
    romaji: `${base.romaji}sai`,
  }
}

export function formatAgePrompt(n) {
  const value = Number(n)
  const mod10 = value % 10
  const mod100 = value % 100
  let suffix = 'лет'
  if (mod100 >= 11 && mod100 <= 14) {
    suffix = 'лет'
  } else if (mod10 === 1) {
    suffix = 'год'
  } else if (mod10 >= 2 && mod10 <= 4) {
    suffix = 'года'
  }
  return `${value} ${suffix}`
}

export function createNumberCard(n, mode) {
  const value = Number(n)
  const reading = mode === 'age' ? formatAgeReading(value) : formatNumberReading(value)
  const id = `${mode}:${value}`

  return {
    id,
    value,
    mode,
    symbol: mode === 'age' ? formatAgePrompt(value) : String(value),
    kanji: reading.kanji,
    kana: reading.kana,
    romaji: reading.romaji,
  }
}

export function buildNumberPool({ mode, rangeMin, rangeMax }) {
  const pool = []

  for (let value = rangeMin; value <= rangeMax; value += 1) {
    pool.push(createNumberCard(value, mode))
  }

  return pool
}

export const CHEAT_SHEET_DIGITS = Array.from({ length: 10 }, (_, index) => {
  const value = index + 1
  return { value, ...formatNumberReading(value) }
})

export const CHEAT_SHEET_HUNDREDS = [100, 200, 300, 600, 800].map((value) => ({
  value,
  ...formatNumberReading(value),
}))

export const CHEAT_SHEET_EXAMPLES = [11, 25, 42, 100, 305, 800].map((value) => ({
  value,
  plain: formatNumberReading(value),
  age: formatAgeReading(value),
  agePrompt: formatAgePrompt(value),
}))

export const AGE_SPECIAL_CASES = [1, 8, 10, 20].map((value) => ({
  value,
  prompt: formatAgePrompt(value),
  ...formatAgeReading(value),
}))

export function ensureNumberStats(stats, cardId) {
  return stats[cardId] ?? {
    exposures: 0,
    clears: 0,
    errors: 0,
    hints: 0,
    streak: 0,
    bestStreak: 0,
    mastery: 0.12,
    avgLatencyMs: 0,
    fastestLatencyMs: 0,
    lastSeenAt: 0,
    lastClearAt: 0,
    lastErrorAt: 0,
    lastHintAt: 0,
    eventAccuracy: 0,
  }
}
