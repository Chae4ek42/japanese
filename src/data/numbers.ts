import { DEFAULT_HYPERPARAMS } from '../shared/lib/trainer'
import type { Hyperparams, NumberCard, NumberMode, NumberReading, StatsRecord } from '../shared/lib/types'

export const NUMBER_HYPERPARAMS: Hyperparams = { ...DEFAULT_HYPERPARAMS }

export const NUMBER_MODES = [
  {
    id: 'plain' as const,
    label: 'Числа',
    hint: 'Арабская цифра → японское чтение (кандзи и кана).',
  },
  {
    id: 'age' as const,
    label: 'Возраст',
    hint: 'Возраст в годах → выражение с 歳.',
  },
  {
    id: 'counter' as const,
    label: 'Счётчики',
    hint: '1–10 с 本・枚・人・匹・つ. Особые чтения: いっぽん, ひとり, みっつ.',
  },
  {
    id: 'clock' as const,
    label: 'Время',
    hint: 'Часы 1–12 и половина: よじ, しちじ, くじ, よじはん.',
  },
]

export function numberModeUsesRange(mode: NumberMode): boolean {
  return mode === 'plain' || mode === 'age'
}

export const NUMBER_RANGES = [
  { id: '10' as const, label: '1–10', min: 1, max: 10 },
  { id: '99' as const, label: '1–99', min: 1, max: 99 },
  { id: '999' as const, label: '1–999', min: 1, max: 999 },
]

const KANJI_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

const ONES_KANA = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']
const ONES_ROMAJI = ['', 'ichi', 'ni', 'san', 'yon', 'go', 'roku', 'nana', 'hachi', 'kyuu']

function joinReadings(parts: string[]) {
  return parts.filter(Boolean).join('')
}

function joinRomaji(parts: string[]) {
  return parts.filter(Boolean).join('')
}

function readUnder100(n: number): Pick<NumberReading, 'kana' | 'romaji'> {
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

function readHundreds(n: number): Pick<NumberReading, 'kana' | 'romaji'> {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  let headKana: string
  let headRomaji: string

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

function readUnder1000(n: number): Pick<NumberReading, 'kana' | 'romaji'> {
  if (n < 100) {
    return readUnder100(n)
  }
  return readHundreds(n)
}

function numberToKanji(n: number): string {
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

export function formatNumberReading(n: number): NumberReading {
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

const SPECIAL_AGE: Record<number, Pick<NumberReading, 'kana' | 'romaji'>> = {
  1: { kana: 'いっさい', romaji: 'issai' },
  8: { kana: 'はっさい', romaji: 'hassai' },
  10: { kana: 'じっさい', romaji: 'jissai' },
}

export function formatAgeReading(n: number): NumberReading {
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

  const special = SPECIAL_AGE[value]
  if (special) {
    return {
      kanji: `${numberToKanji(value)}歳`,
      ...special,
    }
  }

  const base = formatNumberReading(value)
  return {
    kanji: `${base.kanji}歳`,
    kana: `${base.kana}さい`,
    romaji: `${base.romaji}sai`,
  }
}

export function formatAgePrompt(n: number): string {
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

export function createNumberCard(n: number, mode: 'plain' | 'age'): NumberCard {
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

export type CounterId = 'hon' | 'mai' | 'nin' | 'hiki' | 'tsu'

export const COUNTER_META: Array<{ id: CounterId; kanji: string; label: string }> = [
  { id: 'hon', kanji: '本', label: 'длинные предметы' },
  { id: 'mai', kanji: '枚', label: 'плоские' },
  { id: 'nin', kanji: '人', label: 'люди' },
  { id: 'hiki', kanji: '匹', label: 'мелкие животные' },
  { id: 'tsu', kanji: 'つ', label: 'универсальный 1–10' },
]

const COUNTER_READINGS: Record<CounterId, Array<{ kana: string; romaji: string }>> = {
  hon: [
    { kana: 'いっぽん', romaji: 'ippon' },
    { kana: 'にほん', romaji: 'nihon' },
    { kana: 'さんぼん', romaji: 'sanbon' },
    { kana: 'よんほん', romaji: 'yonhon' },
    { kana: 'ごほん', romaji: 'gohon' },
    { kana: 'ろっぽん', romaji: 'roppon' },
    { kana: 'ななほん', romaji: 'nanahon' },
    { kana: 'はっぽん', romaji: 'happon' },
    { kana: 'きゅうほん', romaji: 'kyuuhon' },
    { kana: 'じゅっぽん', romaji: 'juppon' },
  ],
  mai: [
    { kana: 'いちまい', romaji: 'ichimai' },
    { kana: 'にまい', romaji: 'nimai' },
    { kana: 'さんまい', romaji: 'sanmai' },
    { kana: 'よんまい', romaji: 'yonmai' },
    { kana: 'ごまい', romaji: 'gomai' },
    { kana: 'ろくまい', romaji: 'rokumai' },
    { kana: 'ななまい', romaji: 'nanamai' },
    { kana: 'はちまい', romaji: 'hachimai' },
    { kana: 'きゅうまい', romaji: 'kyuumai' },
    { kana: 'じゅうまい', romaji: 'juumai' },
  ],
  nin: [
    { kana: 'ひとり', romaji: 'hitori' },
    { kana: 'ふたり', romaji: 'futari' },
    { kana: 'さんにん', romaji: 'sannin' },
    { kana: 'よにん', romaji: 'yonin' },
    { kana: 'ごにん', romaji: 'gonin' },
    { kana: 'ろくにん', romaji: 'rokunin' },
    { kana: 'しちにん', romaji: 'shichinin' },
    { kana: 'はちにん', romaji: 'hachinin' },
    { kana: 'きゅうにん', romaji: 'kyuunin' },
    { kana: 'じゅうにん', romaji: 'juunin' },
  ],
  hiki: [
    { kana: 'いっぴき', romaji: 'ippiki' },
    { kana: 'にひき', romaji: 'nihiki' },
    { kana: 'さんびき', romaji: 'sanbiki' },
    { kana: 'よんひき', romaji: 'yonhiki' },
    { kana: 'ごひき', romaji: 'gohiki' },
    { kana: 'ろっぴき', romaji: 'roppiki' },
    { kana: 'ななひき', romaji: 'nanahiki' },
    { kana: 'はっぴき', romaji: 'happiki' },
    { kana: 'きゅうひき', romaji: 'kyuuhiki' },
    { kana: 'じゅっぴき', romaji: 'juppiki' },
  ],
  tsu: [
    { kana: 'ひとつ', romaji: 'hitotsu' },
    { kana: 'ふたつ', romaji: 'futatsu' },
    { kana: 'みっつ', romaji: 'mittsu' },
    { kana: 'よっつ', romaji: 'yottsu' },
    { kana: 'いつつ', romaji: 'itsutsu' },
    { kana: 'むっつ', romaji: 'muttsu' },
    { kana: 'ななつ', romaji: 'nanatsu' },
    { kana: 'やっつ', romaji: 'yattsu' },
    { kana: 'ここのつ', romaji: 'kokonotsu' },
    { kana: 'とお', romaji: 'too' },
  ],
}

export function createCounterCard(n: number, counterId: CounterId): NumberCard {
  const value = Number(n)
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new RangeError(`Счётчик вне диапазона 1–10: ${n}`)
  }
  const meta = COUNTER_META.find((item) => item.id === counterId)
  if (!meta) {
    throw new RangeError(`Неизвестный счётчик: ${counterId}`)
  }
  const reading = COUNTER_READINGS[counterId][value - 1]
  const kanji = counterId === 'tsu' && value === 10 ? '十' : `${numberToKanji(value)}${meta.kanji}`
  return {
    id: `counter:${counterId}:${value}`,
    value,
    mode: 'counter',
    symbol: `${value}${meta.kanji === 'つ' && value === 10 ? '' : meta.kanji === 'つ' ? 'つ' : meta.kanji}`,
    kanji,
    kana: reading.kana,
    romaji: reading.romaji,
  }
}

function clockHourReading(hour: number): Pick<NumberReading, 'kana' | 'romaji'> {
  if (hour === 4) return { kana: 'よじ', romaji: 'yoji' }
  if (hour === 7) return { kana: 'しちじ', romaji: 'shichiji' }
  if (hour === 9) return { kana: 'くじ', romaji: 'kuji' }
  const base = formatNumberReading(hour)
  return { kana: `${base.kana}じ`, romaji: `${base.romaji}ji` }
}

export function createClockCard(hour: number, half = false): NumberCard {
  const value = Number(hour)
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new RangeError(`Час вне диапазона 1–12: ${hour}`)
  }
  const head = clockHourReading(value)
  const kanjiHead = `${numberToKanji(value)}時`
  return {
    id: `clock:${value}:${half ? '30' : '00'}`,
    value,
    mode: 'clock',
    symbol: `${value}:${half ? '30' : '00'}`,
    kanji: half ? `${kanjiHead}半` : kanjiHead,
    kana: half ? `${head.kana}はん` : head.kana,
    romaji: half ? `${head.romaji}han` : head.romaji,
  }
}

function buildCounterPool(): NumberCard[] {
  const pool: NumberCard[] = []
  for (const counter of COUNTER_META) {
    for (let value = 1; value <= 10; value += 1) {
      pool.push(createCounterCard(value, counter.id))
    }
  }
  return pool
}

function buildClockPool(): NumberCard[] {
  const pool: NumberCard[] = []
  for (let hour = 1; hour <= 12; hour += 1) {
    pool.push(createClockCard(hour, false))
    pool.push(createClockCard(hour, true))
  }
  return pool
}

export function buildNumberPool({
  mode,
  rangeMin,
  rangeMax,
}: {
  mode: NumberMode
  rangeMin: number
  rangeMax: number
}): NumberCard[] {
  if (mode === 'counter') return buildCounterPool()
  if (mode === 'clock') return buildClockPool()

  const pool: NumberCard[] = []
  for (let value = rangeMin; value <= rangeMax; value += 1) {
    pool.push(createNumberCard(value, mode))
  }
  return pool
}

export const CHEAT_SHEET_COUNTERS = [1, 3, 6, 8, 10].flatMap((value) =>
  (['hon', 'nin', 'tsu'] as CounterId[]).map((counterId) => createCounterCard(value, counterId)),
)

export const CHEAT_SHEET_CLOCK = [4, 7, 9, 10].flatMap((hour) => [
  createClockCard(hour, false),
  createClockCard(hour, true),
])

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

export function ensureNumberStats(stats: Record<string, StatsRecord>, cardId: string): StatsRecord {
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
