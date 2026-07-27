/**
 * Русификация английских значений/мнемоник компонентов.
 *
 * Вход:  .cache/kanshudo/components-raw.json
 * Кэш:   .cache/ru/glossary.json, .cache/ru/phrases.json
 * Выход: .cache/ru/components-ru.json
 *
 * Без внешнего LLM: словарь + простые правила. Можно дозаполнить phrases вручную.
 *
 * Запуск: node scripts/russify-kanji-texts.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RAW = path.join(ROOT, '.cache', 'kanshudo', 'components-raw.json')
const RU_DIR = path.join(ROOT, '.cache', 'ru')
const GLOSSARY_PATH = path.join(RU_DIR, 'glossary.json')
const PHRASES_PATH = path.join(RU_DIR, 'phrases.json')
const OUT = path.join(RU_DIR, 'components-ru.json')

const BUILTIN_GLOSSARY = {
  sun: 'солнце',
  day: 'день',
  moon: 'луна',
  month: 'месяц',
  water: 'вода',
  fire: 'огонь',
  earth: 'земля',
  ground: 'земля',
  tree: 'дерево',
  wood: 'дерево',
  person: 'человек',
  people: 'люди',
  mouth: 'рот',
  say: 'говорить',
  word: 'слово',
  speech: 'речь',
  language: 'язык',
  talk: 'говорить',
  five: 'пять',
  one: 'один',
  two: 'два',
  three: 'три',
  four: 'четыре',
  six: 'шесть',
  seven: 'семь',
  eight: 'восемь',
  nine: 'девять',
  ten: 'десять',
  hundred: 'сто',
  thousand: 'тысяча',
  big: 'большой',
  small: 'маленький',
  little: 'маленький',
  woman: 'женщина',
  man: 'мужчина',
  child: 'ребёнок',
  hand: 'рука',
  eye: 'глаз',
  ear: 'ухо',
  heart: 'сердце',
  mind: 'разум',
  spirit: 'дух',
  power: 'сила',
  strength: 'сила',
  mountain: 'гора',
  river: 'река',
  rice: 'рис',
  field: 'поле',
  gold: 'золото',
  metal: 'металл',
  money: 'деньги',
  thread: 'нить',
  silk: 'шёлк',
  green: 'зелёный',
  blue: 'синий',
  red: 'красный',
  white: 'белый',
  black: 'чёрный',
  rain: 'дождь',
  wind: 'ветер',
  stone: 'камень',
  king: 'король',
  door: 'дверь',
  gate: 'ворота',
  car: 'машина',
  vehicle: 'транспорт',
  go: 'идти',
  come: 'приходить',
  see: 'видеть',
  look: 'смотреть',
  listen: 'слушать',
  hear: 'слышать',
  eat: 'есть',
  drink: 'пить',
  read: 'читать',
  write: 'писать',
  learn: 'учить',
  study: 'учиться',
  school: 'школа',
  time: 'время',
  hour: 'час',
  year: 'год',
  now: 'сейчас',
  before: 'раньше',
  after: 'после',
  up: 'вверх',
  down: 'вниз',
  left: 'лево',
  right: 'право',
  inside: 'внутри',
  outside: 'снаружи',
  above: 'над',
  below: 'под',
  middle: 'середина',
  self: 'сам',
  myself: 'я сам',
  i: 'я',
  you: 'ты',
  he: 'он',
  she: 'она',
  this: 'этот',
  that: 'тот',
  what: 'что',
  where: 'где',
  when: 'когда',
  how: 'как',
  why: 'почему',
  good: 'хороший',
  bad: 'плохой',
  new: 'новый',
  old: 'старый',
  high: 'высокий',
  low: 'низкий',
  long: 'длинный',
  short: 'короткий',
  early: 'ранний',
  late: 'поздний',
  empty: 'пустой',
  full: 'полный',
  life: 'жизнь',
  death: 'смерть',
  body: 'тело',
  head: 'голова',
  foot: 'нога',
  leg: 'нога',
  hair: 'волосы',
  blood: 'кровь',
  fish: 'рыба',
  bird: 'птица',
  dog: 'собака',
  cow: 'корова',
  horse: 'лошадь',
  insect: 'насекомое',
  grass: 'трава',
  flower: 'цветок',
  leaf: 'лист',
  bamboo: 'бамбук',
  book: 'книга',
  paper: 'бумага',
  brush: 'кисть',
  knife: 'нож',
  sword: 'меч',
  bow: 'лук',
  arrow: 'стрела',
  net: 'сеть',
  boat: 'лодка',
  ship: 'корабль',
  road: 'дорога',
  way: 'путь',
  place: 'место',
  country: 'страна',
  village: 'деревня',
  town: 'город',
  city: 'город',
  house: 'дом',
  home: 'дом',
  room: 'комната',
  temple: 'храм',
  shrine: 'святилище',
  god: 'бог',
  sound: 'звук',
  color: 'цвет',
  colour: 'цвет',
  light: 'свет',
  dark: 'тёмный',
  cold: 'холодный',
  hot: 'горячий',
  warm: 'тёплый',
  cool: 'прохладный',
  snow: 'снег',
  cloud: 'облако',
  sky: 'небо',
  heaven: 'небо',
  star: 'звезда',
  night: 'ночь',
  morning: 'утро',
  evening: 'вечер',
  spring: 'весна',
  summer: 'лето',
  autumn: 'осень',
  fall: 'осень',
  winter: 'зима',
  east: 'восток',
  west: 'запад',
  south: 'юг',
  north: 'север',
  stop: 'остановка',
  stand: 'стоять',
  sit: 'сидеть',
  walk: 'ходить',
  run: 'бежать',
  enter: 'входить',
  exit: 'выход',
  open: 'открывать',
  close: 'закрывать',
  cut: 'резать',
  break: 'ломать',
  make: 'делать',
  use: 'использовать',
  give: 'давать',
  take: 'брать',
  hold: 'держать',
  put: 'класть',
  know: 'знать',
  think: 'думать',
  feel: 'чувствовать',
  love: 'любовь',
  like: 'нравиться',
  hate: 'ненавидеть',
  fear: 'страх',
  hope: 'надежда',
  work: 'работа',
  rest: 'отдых',
  play: 'игра',
  music: 'музыка',
  song: 'песня',
  dance: 'танец',
  picture: 'картина',
  drawing: 'рисунок',
  number: 'число',
  count: 'считать',
  half: 'половина',
  part: 'часть',
  whole: 'целый',
  same: 'тот же',
  different: 'другой',
  true: 'истинный',
  false: 'ложный',
  correct: 'правильный',
  wrong: 'неверный',
  strong: 'сильный',
  weak: 'слабый',
  hard: 'твёрдый',
  soft: 'мягкий',
  heavy: 'тяжёлый',
  wide: 'широкий',
  narrow: 'узкий',
  deep: 'глубокий',
  shallow: 'мелкий',
  near: 'близко',
  far: 'далеко',
  begin: 'начинать',
  end: 'конец',
  finish: 'заканчивать',
  continue: 'продолжать',
  change: 'менять',
  move: 'двигаться',
  stay: 'оставаться',
  return: 'возвращаться',
  arrive: 'прибывать',
  leave: 'уходить',
  meet: 'встречать',
  wait: 'ждать',
  ask: 'спрашивать',
  answer: 'ответ',
  teach: 'учить',
  remember: 'помнить',
  forget: 'забывать',
  understand: 'понимать',
  explain: 'объяснять',
  show: 'показывать',
  hide: 'прятать',
  find: 'находить',
  lose: 'терять',
  win: 'побеждать',
  fight: 'драться',
  protect: 'защищать',
  attack: 'атаковать',
  help: 'помощь',
  need: 'нуждаться',
  want: 'хотеть',
  can: 'мочь',
  must: 'должен',
  should: 'следует',
  maybe: 'возможно',
  perhaps: 'возможно',
  always: 'всегда',
  never: 'никогда',
  sometimes: 'иногда',
  often: 'часто',
  again: 'снова',
  still: 'всё ещё',
  already: 'уже',
  yet: 'ещё',
  also: 'также',
  only: 'только',
  even: 'даже',
  very: 'очень',
  more: 'больше',
  less: 'меньше',
  most: 'самый',
  least: 'наименее',
  each: 'каждый',
  every: 'каждый',
  all: 'все',
  none: 'ничего',
  some: 'некоторые',
  many: 'много',
  few: 'мало',
  both: 'оба',
  either: 'либо',
  neither: 'ни',
  between: 'между',
  among: 'среди',
  through: 'через',
  across: 'через',
  around: 'вокруг',
  about: 'около',
  against: 'против',
  without: 'без',
  with: 'с',
  from: 'от',
  into: 'в',
  onto: 'на',
  upon: 'на',
  over: 'над',
  under: 'под',
  during: 'во время',
  until: 'до',
  since: 'с',
  because: 'потому что',
  although: 'хотя',
  however: 'однако',
  therefore: 'поэтому',
  thus: 'таким образом',
  etc: 'и т.д.',
  radical: 'радикал',
  component: 'компонент',
  phonetic: 'фонетик',
  semantic: 'семантик',
  form: 'форма',
  shape: 'форма',
  side: 'сторона',
  top: 'верх',
  bottom: 'низ',
  base: 'основа',
  crown: 'корона',
  enclosure: 'ограждение',
  cover: 'крышка',
  legs: 'ноги',
  horn: 'рог',
  claw: 'коготь',
  fang: 'клык',
  shell: 'раковина',
  skin: 'кожа',
  bone: 'кость',
  tooth: 'зуб',
  tongue: 'язык',
  nose: 'нос',
  face: 'лицо',
  neck: 'шея',
  shoulder: 'плечо',
  back: 'спина',
  belly: 'живот',
  chest: 'грудь',
  finger: 'палец',
  nail: 'ноготь',
  wing: 'крыло',
  tail: 'хвост',
  egg: 'яйцо',
  milk: 'молоко',
  meat: 'мясо',
  vegetable: 'овощ',
  fruit: 'фрукт',
  grain: 'зерно',
  wheat: 'пшеница',
  tea: 'чай',
  wine: 'вино',
  sake: 'саке',
  salt: 'соль',
  sugar: 'сахар',
  oil: 'масло',
  fat: 'жир',
  medicine: 'лекарство',
  illness: 'болезнь',
  pain: 'боль',
  wound: 'рана',
  doctor: 'врач',
  nurse: 'медсестра',
  hospital: 'больница',
  queen: 'королева',
  emperor: 'император',
  official: 'чиновник',
  soldier: 'солдат',
  war: 'война',
  peace: 'мир',
  law: 'закон',
  crime: 'преступление',
  prison: 'тюрьма',
  court: 'суд',
  judge: 'судья',
  politics: 'политика',
  government: 'правительство',
  company: 'компания',
  shop: 'магазин',
  market: 'рынок',
  buy: 'покупать',
  sell: 'продавать',
  price: 'цена',
  cheap: 'дешёвый',
  expensive: 'дорогой',
  rich: 'богатый',
  poor: 'бедный',
  fortune: 'удача',
  luck: 'удача',
  destiny: 'судьба',
  fate: 'судьба',
  dream: 'сон',
  sleep: 'спать',
  wake: 'просыпаться',
  wish: 'желание',
  desire: 'желание',
  intention: 'намерение',
  purpose: 'цель',
  goal: 'цель',
  result: 'результат',
  reason: 'причина',
  cause: 'причина',
  effect: 'эффект',
  method: 'метод',
  manner: 'способ',
  style: 'стиль',
  art: 'искусство',
  skill: 'навык',
  ability: 'способность',
  talent: 'талант',
  knowledge: 'знание',
  wisdom: 'мудрость',
  intelligence: 'интеллект',
  memory: 'память',
  experience: 'опыт',
  practice: 'практика',
  training: 'тренировка',
  exercise: 'упражнение',
  sport: 'спорт',
  game: 'игра',
  match: 'матч',
  victory: 'победа',
  defeat: 'поражение',
  prize: 'приз',
  gift: 'подарок',
  present: 'подарок',
  guest: 'гость',
  host: 'хозяин',
  friend: 'друг',
  enemy: 'враг',
  stranger: 'незнакомец',
  neighbor: 'сосед',
  family: 'семья',
  parent: 'родитель',
  father: 'отец',
  mother: 'мать',
  brother: 'брат',
  sister: 'сестра',
  son: 'сын',
  daughter: 'дочь',
  husband: 'муж',
  wife: 'жена',
  marriage: 'брак',
  wedding: 'свадьба',
  birth: 'рождение',
  birthday: 'день рождения',
  age: 'возраст',
  young: 'молодой',
  adult: 'взрослый',
  elder: 'старший',
  ancestor: 'предок',
  descendant: 'потомок',
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback
  return JSON.parse(readFileSync(file, 'utf8'))
}

function normalizeKey(text) {
  return String(text)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s;-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function translateToken(token, glossary) {
  const key = normalizeKey(token)
  if (!key) return ''
  if (glossary[key]) return glossary[key]
  // strip trailing s for plurals
  if (key.endsWith('s') && glossary[key.slice(0, -1)]) return glossary[key.slice(0, -1)]
  if (key.endsWith('ing') && glossary[key.slice(0, -3)]) return glossary[key.slice(0, -3)]
  return null
}

function translatePhrase(text, glossary, phrases) {
  if (!text) return undefined
  const normalized = normalizeKey(text)
  if (!normalized) return undefined
  if (phrases[normalized]) return phrases[normalized]
  if (glossary[normalized]) return glossary[normalized]

  const parts = normalized.split(/\s*;\s*|\s*,\s*|\s+or\s+|\s+\/\s+/)
  if (parts.length > 1) {
    const translated = parts
      .map((part) => translatePhrase(part, glossary, phrases))
      .filter(Boolean)
    if (translated.length) {
      const joined = translated.join('; ')
      phrases[normalized] = joined
      return joined
    }
  }

  const words = normalized.split(' ')
  const mapped = words.map((w) => translateToken(w, glossary))
  if (mapped.every(Boolean)) {
    const joined = mapped.join(' ')
    phrases[normalized] = joined
    return joined
  }

  // keep English if unknown — UI still works; mark for later fill
  phrases[normalized] = phrases[normalized] ?? text.trim()
  return phrases[normalized]
}

function isMostlyRussian(text) {
  const letters = String(text).replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '')
  if (!letters) return false
  const cyr = (letters.match(/[а-яА-ЯёЁ]/g) || []).length
  return cyr / letters.length >= 0.55
}

function buildCompositionNoteRu(character, components, mnemonicRu) {
  if (mnemonicRu && isMostlyRussian(mnemonicRu)) return mnemonicRu
  if (!components?.length) return mnemonicRu && isMostlyRussian(mnemonicRu) ? mnemonicRu : undefined
  const formula = `${components.map((c) => c.glyph).join(' + ')} → ${character}`
  const meanings = components
    .map((c) => c.meaningRu)
    .filter(Boolean)
    .join(', ')
  if (!meanings) return formula
  return `${formula}: ${meanings}`
}

function main() {
  ensureDir(RU_DIR)
  if (!existsSync(RAW)) {
    console.warn(`missing ${RAW} — write empty components-ru.json`)
    writeFileSync(OUT, '{}\n')
    return
  }

  const raw = JSON.parse(readFileSync(RAW, 'utf8'))
  const glossary = { ...BUILTIN_GLOSSARY, ...loadJson(GLOSSARY_PATH, {}) }
  const phrases = loadJson(PHRASES_PATH, {})
  const out = {}

  for (const [character, entry] of Object.entries(raw)) {
    const meaningsRu = (entry.meaningsEn ?? [])
      .map((m) => translatePhrase(m, glossary, phrases))
      .filter(Boolean)
    const components = (entry.components ?? []).map((comp) => ({
      id: comp.id,
      glyph: comp.glyph,
      role: comp.role ?? 'grapheme',
      meaningRu: translatePhrase(comp.meaningEn ?? '', glossary, phrases) ?? '',
      nameRu: comp.nameEn ? translatePhrase(comp.nameEn, glossary, phrases) : undefined,
    }))
    const translatedNote = translatePhrase(entry.mnemonicEn ?? entry.compositionNoteEn ?? '', glossary, phrases)
    const mnemonicRu = translatedNote && isMostlyRussian(translatedNote) ? translatedNote : undefined
    out[character] = {
      character,
      meaningsRu,
      mnemonicRu,
      compositionNoteRu: buildCompositionNoteRu(character, components, mnemonicRu),
      components,
      strokes: entry.strokes,
      grade: entry.grade,
      radicalNumber: entry.radicalNumber,
      joyo: entry.joyo,
      jlpt: entry.jlpt,
    }
  }

  writeFileSync(GLOSSARY_PATH, `${JSON.stringify(glossary, null, 2)}\n`)
  writeFileSync(PHRASES_PATH, `${JSON.stringify(phrases, null, 2)}\n`)
  writeFileSync(OUT, `${JSON.stringify(out)}\n`)
  console.log(`russified ${Object.keys(out).length} kanji → ${OUT}`)
  console.log(`phrases cached: ${Object.keys(phrases).length}`)
}

main()
