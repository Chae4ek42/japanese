/**
 * Добавляет в банк распространённые слова, которые в текстах пишут каной
 * (これ, です, ありがとう…), и собирает самостоятельные тематические группы «Чтение».
 *
 * Источник: кэш jmdict-rus + OpenJLPT vocab из build:kanji-bank.
 * Запуск: node scripts/add-reading-foundation.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'kanji-bank')
const JMDICT = path.join(CACHE, 'jmdict-rus.json')
const WORDS_PATH = path.join(ROOT, 'src', 'data', 'words', 'words.json')
const META_PATH = path.join(ROOT, 'src', 'data', 'words', 'meta.json')
const GROUPS_PATH = path.join(ROOT, 'src', 'features', 'vocab', 'groups.json')
const IDS_PATH = path.join(ROOT, 'src', 'data', 'words', 'reading-foundation-ids.json')

const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/u
const LATIN_RE = /[A-Za-zＡ-Ｚａ-ｚ0-9０-９]/
const HIRAGANA_RE = /^[\u3040-\u309Fーゝゞ]+$/
const KATAKANA_RE = /^[\u30A0-\u30FFーヽヾ]+$/
const RARE_KANJI_TAGS = new Set(['rK', 'oK', 'iK', 'sK'])

/**
 * Thematic reading groups (standalone catalog entities).
 * Keys match writing or kana. Order = assignment priority (first match wins).
 */
const READING_THEMES = [
  {
    id: 'reading-demo',
    label: 'Чтение · указательные',
    description: 'これ／ここ／こう и родственники',
    keys: [
      'これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'どの',
      'ここ', 'そこ', 'あそこ', 'どこ', 'こちら', 'そちら', 'あちら', 'どちら',
      'こっち', 'そっち', 'あっち', 'どっち',
      'こう', 'そう', 'ああ', 'どう', 'こんな', 'そんな', 'あんな', 'どんな',
      'これから', 'これまで', 'それで', 'それなら', 'それとも',
    ],
  },
  {
    id: 'reading-questions',
    label: 'Чтение · вопросы',
    description: '誰／何／いつ／なぜ…',
    keys: [
      '誰', 'だれ', '何', 'なに', 'なん', 'いつ', 'なぜ', 'どうして', 'どうやって',
      'いくら', 'いくつ', 'どちら', 'どっち', 'どのくらい', 'どれくらい',
    ],
  },
  {
    id: 'reading-pronouns',
    label: 'Чтение · местоимения',
    description: 'я／ты／люди',
    keys: [
      '私', 'わたし', 'あたし', 'わたくし', '僕', 'ぼく', '俺', 'おれ',
      'あなた', '君', 'きみ', 'お前', 'おまえ', '彼', 'かれ', '彼女', 'かのじょ',
      '私たち', 'わたしたち', 'みんな', 'みな', 'みなさん', '皆さん',
    ],
  },
  {
    id: 'reading-copula',
    label: 'Чтение · связка',
    description: 'です／だ／である…',
    keys: [
      'です', 'である', 'だ', 'でした', 'だった', 'じゃない', 'ではない',
      'でしょう', 'だろう', 'ですよ', 'ですね',
    ],
  },
  {
    id: 'reading-particles',
    label: 'Чтение · частицы',
    description: 'から／まで／だけ／について…',
    keys: [
      'から', 'まで', 'など', 'のに', 'ので', 'けど', 'けれど', 'けれども',
      'と', 'や', 'へ', 'か', 'よ', 'ね', 'さ', 'ぞ', 'な', 'かな', 'こそ',
      'だけ', 'しか', 'ばかり', 'ほど', 'くらい', 'ぐらい', 'ずつ',
      'について', 'として', 'によって', 'にとって', 'に対して', 'において',
      'ながら', 'たり', 'とか', 'でも', 'すら', 'さえ', 'ばかりか',
    ],
  },
  {
    id: 'reading-connectors',
    label: 'Чтение · союзы',
    description: 'そして／しかし／でも…',
    keys: [
      'そして', 'それから', 'それで', 'しかし', 'でも', 'また', 'または',
      'あるいは', 'つまり', 'たとえば', '例えば', 'したがって', 'ただし',
      'ところで', 'ちなみに', '一方', 'そのうえ', 'おまけに', 'それに',
      'それでも', 'それなのに', 'だから', 'なので', 'ゆえに',
    ],
  },
  {
    id: 'reading-adverbs',
    label: 'Чтение · наречия',
    description: 'еще／уже／очень／сразу…',
    keys: [
      'まだ', 'もう', 'いつも', 'とても', 'すごく', 'ちょっと', 'すこし', '少し',
      'たくさん', 'あまり', 'ぜんぜん', '全く', 'まったく', 'きっと', 'たぶん',
      'おそらく', 'やはり', 'やっぱり', 'ほんとう', '本当', 'ほんと',
      'もちろん', 'ぜひ', 'ちょうど', 'すぐ', 'すぐに', 'ゆっくり', 'いろいろ',
      'はっきり', 'しっかり', 'すっかり', 'ちょうど', 'かなり', 'ずいぶん',
      'もっと', 'いちばん', '一番', 'まず', 'やっと', 'ついに', 'すでに',
      'ほとんど', 'だいたい', 'たいてい', 'たまに', 'ときどき', '時々',
      'いつも', 'ずっと', 'ぜひ', 'どうぞ', 'どうも', 'ぜひとも',
      'きっと', 'まさか', 'ぜひ', 'ちゃんと', 'きちんと', 'ぴったり',
      'いきなり', 'ふと', 'じっと', 'じっと', 'そっと', 'わざと', 'わざわざ',
      'なるべく', 'できるだけ', 'できるだけ', 'ぜひ', 'きっと',
    ],
  },
  {
    id: 'reading-aux',
    label: 'Чтение · глаголы-опоры',
    description: 'する／いる／ください…',
    keys: [
      'ください', '下さい', 'しまう', 'いる', 'ある', 'なる', 'する', 'できる',
      'みる', '見る', 'いく', '行く', 'くる', '来る', 'いう', '言う',
      'くれる', 'あげる', 'もらう', 'おく', 'おく', 'みせる', '見せる',
      'はじめる', '始める', 'おわる', '終わる', 'つづける', '続ける',
    ],
  },
  {
    id: 'reading-frames',
    label: 'Чтение · рамки',
    description: 'こと／もの／とき／ため…',
    keys: [
      'こと', 'もの', 'とき', '時', 'ところ', 'ため', 'よう', 'つもり', 'はず', 'わけ',
      'まえ', '前', 'あと', '後', 'なか', '中', 'うえ', '上', 'した', '下',
      'ばあい', '場合', 'ほう', '方', 'あいだ', '間', 'うち', 'そば', '近く',
      'ほか', '他', 'など', 'なんか', 'なんて',
    ],
  },
  {
    id: 'reading-greetings',
    label: 'Чтение · приветствия',
    description: 'ありがとう／すみません…',
    keys: [
      'ありがとう', 'ありがとうございます', 'すみません', 'ごめんなさい',
      'こんにちは', 'こんばんは', 'おはよう', 'おはようございます',
      'さようなら', 'さよなら', 'じゃあ', 'じゃ', 'はい', 'いいえ', 'ええ', 'うん',
      'ようこそ', 'いらっしゃいませ', 'いってきます', 'いってらしゃい',
      'ただいま', 'おかえり', 'お疲れ', 'おつかれ', 'よろしく', 'お願いします',
      'もう一度', '大丈夫', 'だいじょうぶ', 'だめ', 'いい', 'よい', 'ない',
      'どういたしまして', 'お願い', 'お願いします',
    ],
  },
  {
    id: 'reading-adjectives',
    label: 'Чтение · прилагательные',
    description: 'おいしい／すごい／かわいい…',
    keys: [
      'おいしい', 'すごい', 'かわいい', 'おもしろい', '面白い', 'たのしい', '楽しい',
      'うれしい', '嬉しい', 'かなしい', '悲しい', 'つらい', 'きつい', 'やばい',
      'だめ', 'いい', 'よい', 'ない', 'すごい', 'すごい', 'かっこいい',
      'きれい', '静か', 'しずか', '元気', 'げんき', '大丈夫', 'だいじょうぶ',
      '大変', 'たいへん', '簡単', 'かんたん', '同じ', 'おなじ', '違う', 'ちがう',
    ],
  },
]

/** Meaning / form heuristics for leftover foundation words (after curated keys). */
const THEME_HEURISTICS = [
  {
    id: 'reading-onomatopoeia',
    label: 'Чтение · ономатопея',
    description: 'звукоподражания и mimetics',
    test: (word, gloss) => {
      if (/ономат|подражан|звук/i.test(gloss)) return true
      const w = word.writing
      // Reduplication: がぶがぶ / ウロウロ / いそいそ
      if (/^([\u3040-\u309Fぁ-ゖ]{2,3})\1$/u.test(w)) return true
      if (/^([\u30A0-\u30FFァ-ヶ]{2,3})\1$/u.test(w)) return true
      if (/^([\u3040-\u309Fぁ-ゖ]{2,3})っ?\1$/u.test(w)) return true
      return false
    },
  },
  {
    id: 'reading-interjections',
    label: 'Чтение · междометия',
    description: 'ах!／эй!／ну…',
    test: (word, gloss) =>
      /межд|возглас|обращение|запинк/i.test(gloss) ||
      ['あら', 'おや', 'おい', 'あっ', 'えっ', 'うわ', 'ええっ', 'えっと', 'ねえ', 'ほら', 'さあ', 'よし'].includes(
        word.writing,
      ),
  },
  {
    id: 'reading-adverbs',
    label: 'Чтение · наречия',
    description: 'еще／уже／очень／сразу…',
    test: (word, gloss) => {
      if (/нареч|часто|степени|образа действия|совсем|очень|сразу|медленно|быстро|тихо|аккуратн|украдк|точно/i.test(gloss)) {
        return true
      }
      // Common adverb shapes: 〜り / 〜っと (あっさり, うっかり, きっと)
      if (HIRAGANA_RE.test(word.writing) && /(り|っと)$/u.test(word.writing) && word.writing.length >= 3) {
        return true
      }
      return false
    },
  },
  {
    id: 'reading-connectors',
    label: 'Чтение · союзы',
    description: 'そして／しかし／でも…',
    test: (_word, gloss) => /союз|связк|вдобавок|поэтому|однако|хотя|затем|далее/i.test(gloss),
  },
  {
    id: 'reading-greetings',
    label: 'Чтение · приветствия',
    description: 'ありがとう／すみません…',
    test: (_word, gloss) => /приветств|благодар|извини|пожалуйста|добро пожаловать/i.test(gloss),
  },
  {
    id: 'reading-adjectives',
    label: 'Чтение · прилагательные',
    description: 'おいしい／すごい／かわいい…',
    test: (_word, gloss) => /прилаг|настроен|качество|характер/i.test(gloss),
  },
  {
    id: 'reading-aux',
    label: 'Чтение · глаголы-опоры',
    description: 'する／いる／ください…',
    test: (word, gloss) =>
      /гл\.|глагол/i.test(gloss) && HIRAGANA_RE.test(word.writing) && /(る|う|く|す|つ|ぬ|む|ぐ|ぶ)$/u.test(word.writing),
  },
]

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
  if (code >= 0x30a1 && code <= 0x30f6) return String.fromCodePoint(code - 0x60)
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

function hasPriority(entry) {
  const forms = [...(entry.kanji ?? []), ...(entry.kana ?? [])]
  if (forms.some((form) => form?.common === true)) return true
  const tags = forms.flatMap((form) => form.tags ?? [])
  return tags.some((tag) => /^(ichi|news|spec|gai)\d/.test(String(tag)))
}

function isRareKanjiForm(form) {
  return (form.tags ?? []).some((tag) => RARE_KANJI_TAGS.has(String(tag)))
}

function preferredWriting(entry) {
  const kanaForms = (entry.kana ?? []).filter((k) => !k.tags?.includes('sk'))
  const commonKana = kanaForms.find((k) => k.common) ?? kanaForms[0]
  const kanjiForms = (entry.kanji ?? []).filter((k) => !k.tags?.includes('sK'))
  const commonModern = kanjiForms.find((k) => k.common && !isRareKanjiForm(k))
  if (commonModern) return commonModern.text
  if (commonKana) return commonKana.text
  return kanjiForms[0]?.text ?? commonKana?.text ?? null
}

function pickReading(entry, writing) {
  const kanaForms = (entry.kana ?? []).filter((k) => !k.tags?.includes('sk'))
  if (!kanaForms.length) return null
  if (!KANJI_RE.test(writing)) {
    const exact = kanaForms.find((k) => k.text === writing)
    if (exact) return exact.text
  }
  const applies = kanaForms.find((k) => {
    if (!k.appliesToKanji?.length || k.appliesToKanji.includes('*')) return true
    return k.appliesToKanji.includes(writing)
  })
  return (applies ?? kanaForms[0]).text
}

function pickMeanings(entry) {
  const glosses = []
  for (const sense of entry.sense ?? []) {
    for (const gloss of sense.gloss ?? []) {
      const text = typeof gloss === 'string' ? gloss : gloss.text
      if (text && !glosses.includes(text)) glosses.push(text)
      if (glosses.length >= 3) return glosses
    }
  }
  return glosses
}

function buildWord(entry, writing) {
  const reading = pickReading(entry, writing)
  if (!reading) return null
  const meanings = pickMeanings(entry)
  if (!meanings.length) return null
  return {
    id: String(entry.id),
    writing,
    kana: reading,
    romaji: kanaToRomaji(reading),
    meanings,
    jlpt: null,
    common: true,
    kanji: extractKanji(writing),
  }
}

function upsertReadingGroups(groups, readingGroups) {
  const kept = groups
    .filter((g) => typeof g?.id === 'string' && !g.id.startsWith('reading-'))
    .map((g) => ({
      id: g.id,
      label: g.label,
      wordIds: Array.isArray(g.wordIds) ? g.wordIds : [],
      kind: 'theme',
      ...(typeof g.description === 'string' && g.description ? { description: g.description } : {}),
    }))
  return [...readingGroups, ...kept]
}

function indexWordsByKey(words) {
  const byWriting = new Map()
  const byKana = new Map()
  for (const word of words) {
    if (!word?.id) continue
    if (!byWriting.has(word.writing)) byWriting.set(word.writing, [])
    byWriting.get(word.writing).push(word)
    if (!byKana.has(word.kana)) byKana.set(word.kana, [])
    byKana.get(word.kana).push(word)
  }
  return { byWriting, byKana }
}

function pickBestWord(candidates, foundation) {
  if (!candidates?.length) return null
  return (
    candidates.find((w) => foundation.has(w.id) && !KANJI_RE.test(w.writing)) ||
    candidates.find((w) => foundation.has(w.id)) ||
    candidates.find((w) => !KANJI_RE.test(w.writing)) ||
    candidates.find((w) => w.common) ||
    candidates[0]
  )
}

function resolveKeysToIds(keys, words, foundationIds, assigned) {
  const foundation = new Set(foundationIds)
  const { byWriting, byKana } = indexWordsByKey(words)
  const ids = []
  for (const key of keys) {
    const hit = pickBestWord(byWriting.get(key), foundation) || pickBestWord(byKana.get(key), foundation)
    if (!hit || assigned.has(hit.id)) continue
    assigned.add(hit.id)
    ids.push(hit.id)
  }
  return ids
}

function wordGloss(word) {
  return (word.meanings ?? []).join(' ')
}

/**
 * Partition the kana-preferred foundation pool into standalone thematic groups.
 * Curated keys first, then meaning heuristics, then script leftovers.
 */
function buildThematicReadingGroups(words, foundationIds) {
  const byId = new Map(words.map((w) => [w.id, w]))
  const assigned = new Set()
  const buckets = new Map()

  const ensure = (theme) => {
    if (!buckets.has(theme.id)) {
      buckets.set(theme.id, {
        id: theme.id,
        label: theme.label,
        description: theme.description,
        kind: 'reading',
        wordIds: [],
      })
    }
    return buckets.get(theme.id)
  }

  for (const theme of READING_THEMES) {
    const group = ensure(theme)
    group.wordIds.push(...resolveKeysToIds(theme.keys, words, foundationIds, assigned))
  }

  // Heuristic pass for remaining foundation ids.
  for (const id of foundationIds) {
    if (assigned.has(id)) continue
    const word = byId.get(id)
    if (!word) continue
    const gloss = wordGloss(word)
    let matched = null
    for (const heuristic of THEME_HEURISTICS) {
      if (heuristic.test(word, gloss)) {
        matched = heuristic
        break
      }
    }
    if (!matched) continue
    const group = ensure(matched)
    group.wordIds.push(id)
    assigned.add(id)
  }

  // Script leftovers for study-sized groups. Long gairaigo stay in the bank
  // for search but are not dumped into a 2000-word «катакана» group.
  const kataGroup = ensure({
    id: 'reading-katakana',
    label: 'Чтение · катакана',
    description: 'короткие заимствования (≤3 знака)',
  })
  const hiraGroup = ensure({
    id: 'reading-hiragana',
    label: 'Чтение · прочая хирагана',
    description: 'остальные слова хираганой',
  })

  for (const id of foundationIds) {
    if (assigned.has(id)) continue
    const word = byId.get(id)
    if (!word) continue
    if (KATAKANA_RE.test(word.writing) && word.writing.length <= 3) {
      kataGroup.wordIds.push(id)
      assigned.add(id)
      continue
    }
    if (HIRAGANA_RE.test(word.writing)) {
      hiraGroup.wordIds.push(id)
      assigned.add(id)
    }
  }

  const sortIds = (ids) => [...new Set(ids)].sort((a, b) => Number(a) - Number(b))
  const order = [
    ...READING_THEMES.map((t) => t.id),
    'reading-onomatopoeia',
    'reading-interjections',
    'reading-katakana',
    'reading-hiragana',
  ]

  return order
    .map((id) => buckets.get(id))
    .filter(Boolean)
    .map((group) => ({
      ...group,
      wordIds: sortIds(group.wordIds),
    }))
    .filter((group) => group.wordIds.length > 0)
}

function buildLeveledGroups(words, foundationIds) {
  // Back-compat alias for callers / older docs.
  return buildThematicReadingGroups(words, foundationIds)
}

function main() {
  if (!existsSync(JMDICT)) {
    throw new Error(`Нет кэша JMDict: ${JMDICT}. Сначала npm run build:kanji-bank`)
  }

  console.log('load jmdict + words…')
  const jmdict = JSON.parse(readFileSync(JMDICT, 'utf8'))
  const words = JSON.parse(readFileSync(WORDS_PATH, 'utf8'))
  const byId = new Map(words.map((w) => [w.id, w]))

  let added = 0
  let fixed = 0
  const foundationIds = []

  for (const entry of jmdict.words ?? []) {
    if (!hasPriority(entry)) continue
    const writing = preferredWriting(entry)
    if (!writing || LATIN_RE.test(writing)) continue
    if (KANJI_RE.test(writing)) continue

    const next = buildWord(entry, writing)
    if (!next) continue

    foundationIds.push(next.id)
    const prev = byId.get(next.id)
    if (!prev) {
      words.push(next)
      byId.set(next.id, next)
      added += 1
      continue
    }
    if (prev.writing !== next.writing || prev.kana !== next.kana) {
      Object.assign(prev, {
        writing: next.writing,
        kana: next.kana,
        romaji: next.romaji,
        kanji: next.kanji,
        common: true,
        meanings: prev.meanings?.length ? prev.meanings : next.meanings,
      })
      fixed += 1
    }
  }

  const uniqueFoundation = [...new Set(foundationIds)].sort((a, b) => Number(a) - Number(b))
  const readingGroups = buildLeveledGroups(words, uniqueFoundation)

  console.log(`add ${added}, fix writing ${fixed}, foundation ${uniqueFoundation.length}`)
  for (const group of readingGroups) {
    console.log(`  ${group.label}: ${group.wordIds.length}`)
  }

  writeFileSync(WORDS_PATH, `${JSON.stringify(words)}\n`)
  writeFileSync(IDS_PATH, `${JSON.stringify(uniqueFoundation, null, 2)}\n`)

  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
  meta.counts.words = words.length
  meta.counts.readingFoundation = uniqueFoundation.length
  meta.counts.readingGroups = Object.fromEntries(
    readingGroups.map((g) => [g.id, g.wordIds.length]),
  )
  meta.builtAt = new Date().toISOString()
  meta.sources.readingFoundation = 'jmdict common kana-preferred, thematic reading groups'
  writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`)

  const groups = JSON.parse(readFileSync(GROUPS_PATH, 'utf8'))
  writeFileSync(GROUPS_PATH, `${JSON.stringify(upsertReadingGroups(groups, readingGroups), null, 2)}\n`)

  console.log('done')
}

main()
