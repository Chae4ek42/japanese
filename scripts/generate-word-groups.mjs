// Тематические пачки по 10 слов. Запуск: node scripts/generate-word-groups.mjs
import { writeFileSync } from 'node:fs'
import rawData from '../src/data/words.data.js'

const TARGET = 'src/data/word-groups.data.js'
const PACK_SIZE = 10

const THEME_ORDER = [
  'people',
  'pronouns',
  'home',
  'food',
  'shops',
  'school',
  'city',
  'media',
  'weather',
  'nature',
  'time',
  'numbers',
  'colors',
  'size',
  'quality',
  'feel',
  'health',
  'body',
  'animals',
  'verbs-move',
  'verbs-daily',
  'verbs-talk',
  'grammar',
  'misc',
  'mixed',
]

const THEME_LABELS = {
  people: 'Люди и семья',
  pronouns: 'Указатели и место',
  home: 'Дом и быт',
  food: 'Еда и напитки',
  shops: 'Магазины и деньги',
  school: 'Школа и учёба',
  city: 'Город и транспорт',
  media: 'Медиа',
  weather: 'Погода и сезоны',
  nature: 'Природа',
  time: 'Время',
  numbers: 'Числа',
  colors: 'Цвета',
  size: 'Размер',
  quality: 'Качества',
  feel: 'Ощущения',
  health: 'Здоровье',
  body: 'Тело',
  animals: 'Животные',
  'verbs-move': 'Движение',
  'verbs-daily': 'Быт',
  'verbs-talk': 'Действия',
  grammar: 'Служебные слова',
  misc: 'Разное',
  mixed: 'Смешанное',
}

const KANJI_THEME = {
  はい: 'grammar',
  いいえ: 'grammar',
  これ: 'pronouns',
  それ: 'pronouns',
  あれ: 'pronouns',
  この: 'pronouns',
  その: 'pronouns',
  あの: 'pronouns',
  どの: 'pronouns',
  ここ: 'pronouns',
  そこ: 'pronouns',
  あそこ: 'pronouns',
  どこ: 'pronouns',
  こちら: 'pronouns',
  そちら: 'pronouns',
  あちら: 'pronouns',
  どちら: 'pronouns',
  私: 'people',
  あなた: 'people',
  彼: 'people',
  彼女: 'people',
  誰: 'people',
  皆: 'people',
}

const KANA_THEME_RULES = [
  { id: 'people', match: /先生|学生|医者|社員|会社|家族|父|母|兄|姉|弟|妹|友|人|さん|方|どなた|だれ|お父|お母|お兄|お姉|子供|男|女|赤ちゃん|赤ん坊/i },
  { id: 'food', match: /ご飯|食|飲|茶|コーヒー|牛乳|肉|魚|野菜|果物|水|酒|弁当|レストラン|食堂|台所|お茶|パン|卵|砂糖|塩|料理|味|お菓子|チョコ/i },
  { id: 'shops', match: /店|買|売|金|お金|円|値段|安|高い|財布|デパート|スーパー|銀行|会社/i },
  { id: 'school', match: /学校|大学|勉強|宿題|教室|先生|学生|本|辞書|ノート|鉛筆|ペン|紙|試験|質問|答|英語|日本語|中国語|授業|図書|作文|漢字|テスト/i },
  { id: 'city', match: /駅|電車|バス|飛行|道|地図|郵便|病院|公園|映画|トイレ|電話|手紙|はがき|名前|国|外国|市|町|村|橋|信号|交番|空港|切符|タクシー|自転|地下鉄|ホテル|ビル/i },
  { id: 'media', match: /映画|音楽|歌|写真|カメラ|ラジオ|テレビ|新聞|雑誌|コンピュ|パソコン|メール|インタ/i },
  { id: 'home', match: /家|部屋|窓|庭|机|椅子|時計|階段|電気|冷蔵|花瓶|灰皿|紙|眼鏡|鞄|靴|服|帽子|鍵|傘|布団|寝|起|洗|掃除|台所|風呂|トイレ|ベッド|壁|床|天井|入口|出口/i },
  { id: 'weather', match: /雨|雪|天気|曇|春|夏|秋|冬|暑|寒|暖|涼|風|台風/i },
  { id: 'nature', match: /海|山|川|湖|空|星|月|太陽|花|木|森|石|島/i },
  { id: 'time', match: /月曜|火曜|水曜|木曜|金曜|土曜|日曜|今日|明日|昨日|毎日|毎朝|毎晩|今週|来週|先週|今月|来月|先月|今年|来年|去年|時間|午前|午後|朝|昼|夜|夕|今|後|前|時|分|秒|半|頃|春休|夏休|冬休/i },
  { id: 'numbers', match: /一|二|三|四|五|六|七|八|九|十|百|千|万|第|番|何|いくつ|いくら|ひとつ|ふたつ|みっつ|よっつ|いつつ|むっつ|ななつ|やっつ|ここのつ|とお|一人|二人|全部|同じ/i },
  { id: 'colors', match: /色|赤|青|白|黒|黄|緑|茶|ピンク/i },
  { id: 'health', match: /病|薬|痛|熱|風邪|怪我|血|亡|死|危|医者|歯医者|看護/i },
  { id: 'body', match: /体|顔|口|目|耳|鼻|手|足|頭|髪|歯|背|腹|心|声/i },
  { id: 'animals', match: /犬|猫|鳥|馬|牛|豚|虫|魚/i },
  { id: 'verbs-move', match: /行|来|帰|歩|走|泳|飛|登|降|出|入|止|立|座|乗|降り|渡|通|曲|進|退|逃|追|届|送|持|運/i },
  { id: 'verbs-daily', match: /洗|掃|片|料理|作|食|飲|寝|起|着|脱|開|閉|掛|消|点|使|借|貸|返|置|取|忘|落|拾|建|直|壊|治|直す/i },
  { id: 'verbs-talk', match: /言|話|聞|読|書|教|習|学|思|知|分|覚|忘|会|待|合|教|答|質|相談|説|呼|頼|謝|挨拶/i },
]

const RU_THEME_RULES = [
  { id: 'people', match: /брат|сестр|отец|мать|мама|семь|родител|ребён|девочк|мужчин|женщин|человек|господ|врач|учител|студент|друг|знаком|жена|муж|дед|баб|дяд|тёт|плем|коллег|начальник|сотрудник|препод/i },
  { id: 'pronouns', match: /этот|тот|здесь|там|куда|откуда|какой|котор|местоим/i },
  { id: 'home', match: /дом|комнат|окно|сад|стол|стул|часы|лестниц|электри|холодиль|ваза|очки|кошел|багаж|одежд|обув|ключ|зонт|кровать|стена|пол|потолок/i },
  { id: 'food', match: /вода|чай|кофе|молок|напит|рис|еда|овощ|фрукт|рыб|мяс|завтрак|обед|ужин|столов|кафе|ресторан|кухн|суп|хлеб|яйц|сахар|соль/i },
  { id: 'shops', match: /деньг|покуп|магазин|компани|банк|продав|цена|руб|йен/i },
  { id: 'school', match: /школ|универс|библиотек|урок|домашн|словар|газет|журнал|учиться|учить|запомин|преподав|английск|японск|экзам|тетрад|ручк|карандаш/i },
  { id: 'city', match: /станц|метро|трамв|автобус|самол|дорог|карт|почт|больниц|парк|кино|туалет|телефон|письм|открытк|имя|стран|иностран|город|билет|машин|такси|отель|мост/i },
  { id: 'media', match: /фильм|музык|песн|петь|фото|книг|радио|телевиз|компьютер|интернет|почта/i },
  { id: 'weather', match: /дожд|погод|облач|весн|лет|осен|зим|жарк|холод|прохлад|ветер|снег|туман/i },
  { id: 'nature', match: /море|гора|река|озеро|небо|звезд|луна|солнце|цветок|дерев|лес|камень|остров/i },
  { id: 'time', match: /понедель|вторник|сред|четверг|пятниц|суббот|воскрес|сегодня|завтра|вчера|недел|месяц|год|утр|вечер|ноч|час|минут|секунд|иногда|полдень/i },
  { id: 'numbers', match: /один|два|три|четыре|пять|шесть|семь|восем|девять|десять|перв|следующ|номер|все|сколько|скольк/i },
  { id: 'colors', match: /красн|син|голуб|бел|чёрн|жёлт|зелён|коричн|розов|цвет/i },
  { id: 'size', match: /больш|маленьк|длин|коротк|высок|низк|широк|узк|близк|далёк|толст|тонк/i },
  { id: 'quality', match: /плох|стары|нов|радост|интерес|трудн|лёгк|занят|неумел|важн|правильн|неправильн|同じ/i },
  { id: 'feel', match: /сладк|остр|горяч|холодн|боль|тяжёл|молод|грязн|дешёв|сильн|слаб|устал/i },
  { id: 'health', match: /болезн|простуд|лекар|опасн|ран|кров/i },
  { id: 'body', match: /тело|лиц|зуб|глаз|ухо|нос|рук|ног|голова|волос|спина|живот|сердц|голос/i },
  { id: 'animals', match: /собак|кошк|птиц|лошад|коров|свин|рыб|насеком/i },
  { id: 'verbs-move', match: /идти|иду|ехать|ехал|беж|плав|лет|приход|уход|вход|выход|стоя|сид|встреч|переход/i },
  { id: 'verbs-daily', match: /мыть|чист|спать|встав|отдых|пить|готов|одев|раздев|откры|закры|включ|выключ|использ|класт|брать/i },
  { id: 'verbs-talk', match: /говор|сказ|спрос|ответ|знать|поним|думать|учить|работ|делать|начин|конч|помог|ждать|встрет|звон/i },
  { id: 'grammar', match: /^(да|нет|ну|вот|тоже|ещё|уже|только|очень|немного|много|мало)$/i },
]

const JUNK_MEANINGS = new Set(['да', 'нет', 'кто?', 'тот', 'так', 'ну', 'вот'])

function meaningfulMeanings(word) {
  return word.meanings.filter((meaning) => meaning.length > 3 && !JUNK_MEANINGS.has(meaning.toLowerCase()))
}

function detectTheme(word) {
  if (KANJI_THEME[word.kanji]) {
    return KANJI_THEME[word.kanji]
  }

  const surface = `${word.kanji}${word.kana}${word.romaji}`
  for (const rule of KANA_THEME_RULES) {
    if (rule.match.test(surface)) {
      return rule.id
    }
  }

  const meanings = meaningfulMeanings(word)
  const ruHaystack = meanings.join(' ')
  for (const rule of RU_THEME_RULES) {
    if (rule.match.test(ruHaystack)) {
      return rule.id
    }
  }

  if (word.pos?.some((label) => label.includes('прил'))) {
    return 'quality'
  }
  if (word.pos?.some((label) => label.includes('глагол'))) {
    return 'verbs-talk'
  }
  if (word.pos?.some((label) => label.includes('нареч'))) {
    return 'time'
  }

  return 'misc'
}

function themeRank(themeId) {
  const index = THEME_ORDER.indexOf(themeId)
  return index === -1 ? THEME_ORDER.length : index
}

const words = rawData.words.map((word) => ({
  ...word,
  theme: detectTheme(word),
}))

const buckets = new Map(THEME_ORDER.map((themeId) => [themeId, []]))
for (const word of words) {
  const themeId = buckets.has(word.theme) ? word.theme : 'misc'
  buckets.get(themeId).push(word)
}
for (const bucket of buckets.values()) {
  bucket.sort((left, right) => left.kana.localeCompare(right.kana, 'ja'))
}

const flatGroups = []
const remainder = []

for (const themeId of THEME_ORDER) {
  if (themeId === 'mixed') continue
  const bucket = buckets.get(themeId) ?? []
  const fullCount = Math.floor(bucket.length / PACK_SIZE) * PACK_SIZE
  for (let index = 0; index < fullCount; index += PACK_SIZE) {
    const pack = bucket.slice(index, index + PACK_SIZE)
    const packIndex = flatGroups.filter((group) => group.themeId === themeId).length + 1
    flatGroups.push({
      id: `pack-${String(flatGroups.length + 1).padStart(2, '0')}`,
      themeId,
      label: `${THEME_LABELS[themeId] ?? themeId} · ${packIndex}`,
      wordIds: pack.map((item) => item.id),
      preview: pack.map((item) => item.kanji).join(' · '),
    })
  }
  if (bucket.length > fullCount) {
    remainder.push(...bucket.slice(fullCount))
  }
}

remainder.sort((left, right) => themeRank(left.theme) - themeRank(right.theme) || left.kana.localeCompare(right.kana, 'ja'))
let mixedIndex = 0
for (let index = 0; index < remainder.length; index += PACK_SIZE) {
  const pack = remainder.slice(index, index + PACK_SIZE)
  mixedIndex += 1
  flatGroups.push({
    id: `pack-${String(flatGroups.length + 1).padStart(2, '0')}`,
    themeId: 'mixed',
    label: `${THEME_LABELS.mixed} · ${mixedIndex}`,
    wordIds: pack.map((item) => item.id),
    preview: pack.map((item) => item.kanji).join(' · '),
  })
}

const categories = THEME_ORDER.filter((themeId) => flatGroups.some((group) => group.themeId === themeId)).map(
  (themeId) => ({
    id: themeId,
    label: THEME_LABELS[themeId] ?? themeId,
    groups: flatGroups
      .filter((group) => group.themeId === themeId)
      .map(({ id, label, wordIds, preview }) => ({ id, label, wordIds, preview })),
  }),
)

const assigned = new Set(flatGroups.flatMap((group) => group.wordIds))
if (assigned.size !== words.length) {
  console.error(`Assignment mismatch: ${assigned.size} vs ${words.length}`)
  process.exit(1)
}

const output = `// Сгенерировано scripts/generate-word-groups.mjs — не редактировать вручную.
export const WORD_PACK_SIZE = ${PACK_SIZE}

export const WORD_THEME_CATEGORIES = ${JSON.stringify(categories, null, 1)}
`

writeFileSync(TARGET, output)
console.log(`OK: ${flatGroups.length} packs in ${categories.length} themes -> ${TARGET}`)
