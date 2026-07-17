const baseGroups = [
  {
    id: 'vowels',
    shortLabel: 'A',
    entries: [
      createEntry('a', 'a', 'あ', 'ア'),
      createEntry('i', 'i', 'い', 'イ'),
      createEntry('u', 'u', 'う', 'ウ'),
      createEntry('e', 'e', 'え', 'エ'),
      createEntry('o', 'o', 'お', 'オ'),
    ],
  },
  {
    id: 'k',
    shortLabel: 'KA',
    entries: [
      createEntry('ka', 'a', 'か', 'カ'),
      createEntry('ki', 'i', 'き', 'キ'),
      createEntry('ku', 'u', 'く', 'ク'),
      createEntry('ke', 'e', 'け', 'ケ'),
      createEntry('ko', 'o', 'こ', 'コ'),
    ],
  },
  {
    id: 's',
    shortLabel: 'SA',
    entries: [
      createEntry('sa', 'a', 'さ', 'サ'),
      createEntry('shi', 'i', 'し', 'シ', ['si']),
      createEntry('su', 'u', 'す', 'ス'),
      createEntry('se', 'e', 'せ', 'セ'),
      createEntry('so', 'o', 'そ', 'ソ'),
    ],
  },
  {
    id: 't',
    shortLabel: 'TA',
    entries: [
      createEntry('ta', 'a', 'た', 'タ'),
      createEntry('chi', 'i', 'ち', 'チ', ['ti']),
      createEntry('tsu', 'u', 'つ', 'ツ', ['tu']),
      createEntry('te', 'e', 'て', 'テ'),
      createEntry('to', 'o', 'と', 'ト'),
    ],
  },
  {
    id: 'n',
    shortLabel: 'NA',
    entries: [
      createEntry('na', 'a', 'な', 'ナ'),
      createEntry('ni', 'i', 'に', 'ニ'),
      createEntry('nu', 'u', 'ぬ', 'ヌ'),
      createEntry('ne', 'e', 'ね', 'ネ'),
      createEntry('no', 'o', 'の', 'ノ'),
    ],
  },
  {
    id: 'h',
    shortLabel: 'HA',
    entries: [
      createEntry('ha', 'a', 'は', 'ハ'),
      createEntry('hi', 'i', 'ひ', 'ヒ'),
      createEntry('fu', 'u', 'ふ', 'フ', ['hu']),
      createEntry('he', 'e', 'へ', 'ヘ'),
      createEntry('ho', 'o', 'ほ', 'ホ'),
    ],
  },
  {
    id: 'm',
    shortLabel: 'MA',
    entries: [
      createEntry('ma', 'a', 'ま', 'マ'),
      createEntry('mi', 'i', 'み', 'ミ'),
      createEntry('mu', 'u', 'む', 'ム'),
      createEntry('me', 'e', 'め', 'メ'),
      createEntry('mo', 'o', 'も', 'モ'),
    ],
  },
  {
    id: 'y',
    shortLabel: 'YA',
    entries: [
      createEntry('ya', 'a', 'や', 'ヤ'),
      createEntry('yu', 'u', 'ゆ', 'ユ'),
      createEntry('yo', 'o', 'よ', 'ヨ'),
    ],
  },
  {
    id: 'r',
    shortLabel: 'RA',
    entries: [
      createEntry('ra', 'a', 'ら', 'ラ'),
      createEntry('ri', 'i', 'り', 'リ'),
      createEntry('ru', 'u', 'る', 'ル'),
      createEntry('re', 'e', 'れ', 'レ'),
      createEntry('ro', 'o', 'ろ', 'ロ'),
    ],
  },
  {
    id: 'w',
    shortLabel: 'WA',
    entries: [
      createEntry('wa', 'a', 'わ', 'ワ'),
      createEntry('wo', 'o', 'を', 'ヲ'),
    ],
  },
  {
    id: 'nn',
    shortLabel: 'N',
    entries: [createEntry('n', 'n', 'ん', 'ン', ['nn'])],
  },
  {
    id: 'g',
    shortLabel: 'GA',
    entries: [
      createEntry('ga', 'a', 'が', 'ガ'),
      createEntry('gi', 'i', 'ぎ', 'ギ'),
      createEntry('gu', 'u', 'ぐ', 'グ'),
      createEntry('ge', 'e', 'げ', 'ゲ'),
      createEntry('go', 'o', 'ご', 'ゴ'),
    ],
  },
  {
    id: 'z',
    shortLabel: 'ZA',
    entries: [
      createEntry('za', 'a', 'ざ', 'ザ'),
      createEntry('ji', 'i', 'じ', 'ジ', ['zi']),
      createEntry('zu', 'u', 'ず', 'ズ'),
      createEntry('ze', 'e', 'ぜ', 'ゼ'),
      createEntry('zo', 'o', 'ぞ', 'ゾ'),
    ],
  },
  {
    id: 'd',
    shortLabel: 'DA',
    entries: [
      createEntry('da', 'a', 'だ', 'ダ'),
      createEntry('di', 'i', 'ぢ', 'ヂ', ['ji']),
      createEntry('du', 'u', 'づ', 'ヅ', ['zu']),
      createEntry('de', 'e', 'で', 'デ'),
      createEntry('do', 'o', 'ど', 'ド'),
    ],
  },
  {
    id: 'b',
    shortLabel: 'BA',
    entries: [
      createEntry('ba', 'a', 'ば', 'バ'),
      createEntry('bi', 'i', 'び', 'ビ'),
      createEntry('bu', 'u', 'ぶ', 'ブ'),
      createEntry('be', 'e', 'べ', 'ベ'),
      createEntry('bo', 'o', 'ぼ', 'ボ'),
    ],
  },
  {
    id: 'p',
    shortLabel: 'PA',
    entries: [
      createEntry('pa', 'a', 'ぱ', 'パ'),
      createEntry('pi', 'i', 'ぴ', 'ピ'),
      createEntry('pu', 'u', 'ぷ', 'プ'),
      createEntry('pe', 'e', 'ぺ', 'ペ'),
      createEntry('po', 'o', 'ぽ', 'ポ'),
    ],
  },
]

import type { KanaCard, KanaEntry, KanaGroup, ScriptMode } from '../shared/lib/types'

function createEntry(
  primaryAnswer: string,
  slot: string,
  hiragana: string,
  katakana: string,
  aliases: string[] = [],
): KanaEntry {
  return {
    baseId: primaryAnswer,
    slot,
    hiragana,
    katakana,
    primaryAnswer,
    answers: [primaryAnswer, ...aliases],
  }
}

export const KANA_GROUPS: KanaGroup[] = baseGroups
export const GROUP_IDS = KANA_GROUPS.map((group) => group.id)

export const GROUP_PRESETS = [
  { id: 'base', label: 'Основные', groups: ['vowels', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w', 'nn'] },
  { id: 'dakuten', label: 'Звонкие', groups: ['g', 'z', 'd', 'b', 'p'] },
]

// Группы знаков, которые часто путают визуально (внутри одной азбуки).
const CONFUSION_SETS = {
  hiragana: [
    ['a', 'o'],
    ['i', 'ri'],
    ['ki', 'sa'],
    ['chi', 'ra'],
    ['nu', 'me'],
    ['wa', 'ne', 're'],
    ['ru', 'ro'],
    ['ha', 'ho', 'ma'],
  ],
  katakana: [
    ['shi', 'tsu'],
    ['so', 'n'],
    ['ku', 'ta', 'ke'],
    ['chi', 'te'],
    ['no', 'fu'],
    ['wa', 'u', 'wo'],
    ['na', 'me'],
    ['ru', 're'],
    ['ko', 'yu'],
  ],
}

const confusablesById: Record<string, string[]> = {}
for (const [script, sets] of Object.entries(CONFUSION_SETS)) {
  for (const set of sets) {
    for (const baseId of set) {
      const cardId = `${script}:${baseId}`
      const others = set.filter((other) => other !== baseId).map((other) => `${script}:${other}`)
      confusablesById[cardId] = [...(confusablesById[cardId] ?? []), ...others]
    }
  }
}

export function getConfusableIds(cardId: string): string[] {
  return confusablesById[cardId] ?? []
}

export const KANA_STATS_CARDS = KANA_GROUPS.flatMap((group) =>
  group.entries.flatMap((entry) => [
    createCard(entry, group.id, 'hiragana'),
    createCard(entry, group.id, 'katakana'),
  ]),
)

export const KANA_STATS_CARD_IDS = KANA_STATS_CARDS.map((card) => card.id)
export const ALL_CARD_IDS = [...KANA_STATS_CARD_IDS]

const cardById: Record<string, KanaCard> = Object.fromEntries(KANA_STATS_CARDS.map((card) => [card.id, card]))

function createCard(entry: KanaEntry, groupId: string, script: 'hiragana' | 'katakana'): KanaCard {
  return {
    id: `${script}:${entry.baseId}`,
    baseId: entry.baseId,
    groupId,
    symbol: script === 'hiragana' ? entry.hiragana : entry.katakana,
    script,
    scriptLabel: script === 'hiragana' ? 'Хирагана' : 'Катакана',
    primaryAnswer: entry.primaryAnswer,
    answers: entry.answers,
  }
}

export function getCardById(cardId: string): KanaCard | null {
  return cardById[cardId] ?? null
}

export function buildPool(scriptMode: ScriptMode, selectedGroups: string[]): KanaCard[] {
  if (!selectedGroups.length) {
    return []
  }

  const selectedSet = new Set(selectedGroups)
  return KANA_STATS_CARDS.filter((card) => {
    if (!selectedSet.has(card.groupId)) {
      return false
    }

    if (scriptMode === 'both') {
      return true
    }

    return card.script === scriptMode
  })
}
