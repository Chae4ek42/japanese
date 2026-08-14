/**
 * Rebuilds «Чтение» groups from curated keys only (no leftover dumps).
 * Run: node scripts/trim-reading-groups.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORDS_PATH = path.join(ROOT, 'src', 'data', 'words', 'words.json')
const GROUPS_PATH = path.join(ROOT, 'src', 'features', 'vocab', 'groups.json')
const META_PATH = path.join(ROOT, 'src', 'data', 'words', 'meta.json')
const KANA_CATALOG_PATH = path.join(ROOT, 'src', 'data', 'words', 'kana-catalog.json')

const THEMES = [
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

function indexWords(words) {
  const byWriting = new Map()
  const byKana = new Map()
  for (const word of words) {
    if (!word?.id) continue
    const writing = word.writing
    if (writing) {
      const list = byWriting.get(writing) ?? []
      list.push(word)
      byWriting.set(writing, list)
    }
    const kana = word.kana
    if (kana) {
      const list = byKana.get(kana) ?? []
      list.push(word)
      byKana.set(kana, list)
    }
  }
  return { byWriting, byKana }
}

function pickBest(candidates) {
  if (!candidates?.length) return null
  return (
    candidates.find((word) => !/[\u3400-\u9fff]/u.test(word.writing || '')) ||
    candidates.find((word) => word.common) ||
    candidates[0]
  )
}

const words = JSON.parse(readFileSync(WORDS_PATH, 'utf8'))
const kanaCatalog = JSON.parse(readFileSync(KANA_CATALOG_PATH, 'utf8'))
const extra = Array.isArray(kanaCatalog.extra) ? kanaCatalog.extra : []
const { byWriting, byKana } = indexWords([...words, ...extra])
const groups = JSON.parse(readFileSync(GROUPS_PATH, 'utf8'))
const assigned = new Set()
const readingGroups = []

for (const theme of THEMES) {
  const wordIds = []
  for (const key of theme.keys) {
    const hit = pickBest(byWriting.get(key)) || pickBest(byKana.get(key))
    if (!hit || assigned.has(hit.id)) continue
    assigned.add(hit.id)
    wordIds.push(hit.id)
  }
  if (!wordIds.length) continue
  readingGroups.push({
    id: theme.id,
    label: theme.label,
    description: theme.description,
    kind: 'reading',
    wordIds,
  })
}

const next = [...readingGroups, ...groups.filter((group) => group.kind !== 'reading' && !String(group.id).startsWith('reading-'))]
writeFileSync(GROUPS_PATH, `${JSON.stringify(next, null, 2)}\n`)

const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
meta.counts.readingGroups = Object.fromEntries(readingGroups.map((group) => [group.id, group.wordIds.length]))
writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`)

for (const group of readingGroups) {
  console.log(`${group.id}\t${group.wordIds.length}`)
}
console.log(`reading groups: ${readingGroups.length}`)
