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
const RARE_KANJI_TAGS = new Set(['rK', 'oK', 'iK', 'sK'])
const KANA_PREFERRED_IDS = new Set(
  JSON.parse(readFileSync(path.join(ROOT, 'src/data/words/kana-preferred-ids.json'), 'utf8')),
)

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
    ],
  },
  {
    id: 'reading-questions',
    label: 'Чтение · вопросы',
    description: '誰／何／いつ／なぜ…',
    keys: ['誰', 'だれ', '何', 'なに', 'いつ', 'なぜ', 'どうして', 'いくら', 'いくつ'],
  },
  {
    id: 'reading-pronouns',
    label: 'Чтение · местоимения',
    description: 'я／ты／люди',
    keys: [
      '私', 'わたし', '僕', 'ぼく', '俺', 'おれ', 'あなた', '君', 'きみ',
      '彼', 'かれ', '彼女', 'かのじょ', 'みんな', 'みなさん', '皆さん',
    ],
  },
  {
    id: 'reading-copula',
    label: 'Чтение · связка',
    description: 'です／だ／である…',
    keys: ['です', 'だ', 'である', 'でした', 'だった', 'じゃない', 'ではない', 'でしょう', 'だろう'],
  },
  {
    id: 'reading-particles',
    label: 'Чтение · частицы',
    description: 'から／まで／だけ／について…',
    keys: [
      'から', 'まで', 'など', 'のに', 'ので', 'けど', 'けれど', 'けれども',
      'だけ', 'しか', 'ばかり', 'ほど', 'くらい', 'ぐらい',
      'について', 'として', 'によって', 'にとって',
    ],
  },
  {
    id: 'reading-connectors',
    label: 'Чтение · союзы',
    description: 'そして／しかし／でも…',
    keys: [
      'そして', 'それから', 'それで', 'しかし', 'でも', 'また', 'または',
      'つまり', 'たとえば', '例えば', 'ところで', 'だから', 'なので',
      'それでも', 'それに',
    ],
  },
  {
    id: 'reading-adverbs',
    label: 'Чтение · наречия',
    description: 'еще／уже／очень／сразу…',
    keys: [
      'まだ', 'もう', 'いつも', 'とても', 'すごく', 'ちょっと', 'すこし', '少し',
      'たくさん', 'あまり', 'ぜんぜん', '全く', 'まったく', 'きっと', 'たぶん',
      'やはり', 'やっぱり', 'もちろん', 'すぐ', 'すぐに', 'ゆっくり',
      'もっと', 'まず', 'やっと', 'ほとんど', 'だいたい', 'たまに',
      'ときどき', '時々', 'ずっと', 'どうも', 'ちゃんと',
    ],
  },
  {
    id: 'reading-aux',
    label: 'Чтение · глаголы-опоры',
    description: 'する／いる／ください…',
    keys: [
      'ください', '下さい', 'しまう', 'いる', 'ある', 'なる', 'する', 'できる',
      'くれる', 'あげる', 'もらう', 'いく', '行く', 'くる', '来る',
    ],
  },
  {
    id: 'reading-frames',
    label: 'Чтение · рамки',
    description: 'こと／もの／とき／ため…',
    keys: [
      'こと', 'もの', 'とき', '時', 'ところ', 'ため', 'よう', 'つもり', 'はず', 'わけ',
      'まえ', '前', 'あと', '後', 'ばあい', '場合',
    ],
  },
  {
    id: 'reading-greetings',
    label: 'Чтение · приветствия',
    description: 'ありがとう／すみません…',
    keys: [
      'ありがとう', 'ありがとうございます', 'すみません', 'ごめんなさい',
      'こんにちは', 'こんばんは', 'おはよう', 'おはようございます',
      'さようなら', 'はい', 'いいえ', 'よろしく', 'お願いします',
      '大丈夫', 'だいじょうぶ',
    ],
  },
  {
    id: 'reading-adjectives',
    label: 'Чтение · прилагательные',
    description: 'おいしい／すごい／かわいい…',
    keys: [
      'おいしい', 'すごい', 'かわいい', 'おもしろい', '面白い', 'たのしい', '楽しい',
      'うれしい', '嬉しい', 'きれい', '静か', 'しずか', '元気', 'げんき',
      '簡単', 'かんたん', '同じ', 'おなじ', '違う', 'ちがう',
    ],
  },
  {
    id: 'reading-onomatopoeia',
    label: 'Чтение · ономатопея',
    description: 'частые mimetics',
    keys: ['どきどき', 'わくわく', 'いらいら', 'がっかり', 'びっくり', 'にこにこ', 'ぺらぺら', 'ぼんやり'],
  },
  {
    id: 'reading-interjections',
    label: 'Чтение · междометия',
    description: 'ах!／эй!／ну…',
    keys: ['あら', 'おや', 'おい', 'さあ', 'ほら', 'ねえ', 'よし', 'えっと'],
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
  if (KANA_PREFERRED_IDS.has(String(entry.id)) && commonKana) {
    return commonKana.text
  }
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

/**
 * Partition the kana-preferred foundation pool into standalone thematic groups.
 * Curated keys only — leftover dumps stay out of the catalog.
 */
function buildThematicReadingGroups(words, foundationIds) {
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

  const sortIds = (ids) => [...new Set(ids)].sort((a, b) => Number(a) - Number(b))
  const order = READING_THEMES.map((t) => t.id)

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
