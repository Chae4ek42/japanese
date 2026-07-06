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

function createEntry(primaryAnswer, slot, hiragana, katakana, aliases = []) {
  return {
    baseId: primaryAnswer,
    slot,
    hiragana,
    katakana,
    primaryAnswer,
    answers: [primaryAnswer, ...aliases],
  }
}

export const KANA_GROUPS = baseGroups
export const GROUP_IDS = KANA_GROUPS.map((group) => group.id)

export const KANA_STATS_CARDS = KANA_GROUPS.flatMap((group) =>
  group.entries.flatMap((entry) => [
    createCard(entry, group.id, 'hiragana'),
    createCard(entry, group.id, 'katakana'),
  ]),
)

export const KANA_STATS_CARD_IDS = KANA_STATS_CARDS.map((card) => card.id)
export const ALL_CARD_IDS = [...KANA_STATS_CARD_IDS]

export const WORD_BANK = [
  createWord('hiragana', 'あい', 'ai', 'любовь'),
  createWord('hiragana', 'いえ', 'ie', 'дом'),
  createWord('hiragana', 'うえ', 'ue', 'верх'),
  createWord('hiragana', 'うみ', 'umi', 'море'),
  createWord('hiragana', 'えき', 'eki', 'станция'),
  createWord('hiragana', 'おに', 'oni', 'они, демон'),
  createWord('hiragana', 'さけ', 'sake', 'сакэ'),
  createWord('hiragana', 'すし', 'sushi', 'суши'),
  createWord('hiragana', 'たこ', 'tako', 'осьминог'),
  createWord('hiragana', 'ねこ', 'neko', 'кот'),
  createWord('hiragana', 'いぬ', 'inu', 'собака'),
  createWord('hiragana', 'はな', 'hana', 'цветок'),
  createWord('hiragana', 'ふね', 'fune', 'лодка'),
  createWord('hiragana', 'へや', 'heya', 'комната'),
  createWord('hiragana', 'ほし', 'hoshi', 'звезда'),
  createWord('hiragana', 'まど', 'mado', 'окно'),
  createWord('hiragana', 'みせ', 'mise', 'магазин'),
  createWord('hiragana', 'やま', 'yama', 'гора'),
  createWord('hiragana', 'ゆめ', 'yume', 'сон'),
  createWord('hiragana', 'よる', 'yoru', 'ночь'),
  createWord('hiragana', 'らく', 'raku', 'легкость'),
  createWord('hiragana', 'りんご', 'ringo', 'яблоко'),
  createWord('hiragana', 'わに', 'wani', 'крокодил'),
  createWord('hiragana', 'ざる', 'zaru', 'бамбуковое сито'),
  createWord('hiragana', 'だれ', 'dare', 'кто'),
  createWord('hiragana', 'ばら', 'bara', 'роза'),
  createWord('hiragana', 'ぱん', 'pan', 'хлеб'),
  createWord('katakana', 'アイス', 'aisu', 'мороженое'),
  createWord('katakana', 'イヌ', 'inu', 'собака'),
  createWord('katakana', 'ウニ', 'uni', 'морской еж'),
  createWord('katakana', 'エア', 'ea', 'air'),
  createWord('katakana', 'オイル', 'oiru', 'масло'),
  createWord('katakana', 'カメラ', 'kamera', 'камера'),
  createWord('katakana', 'ケーキ', 'keeki', 'торт'),
  createWord('katakana', 'コーヒー', 'koohii', 'кофе'),
  createWord('katakana', 'サウナ', 'sauna', 'сауна'),
  createWord('katakana', 'スープ', 'suupu', 'суп'),
  createWord('katakana', 'タクシー', 'takushii', 'такси'),
  createWord('katakana', 'テレビ', 'terebi', 'телевизор'),
  createWord('katakana', 'トマト', 'tomato', 'томат'),
  createWord('katakana', 'ナイフ', 'naifu', 'нож'),
  createWord('katakana', 'ハーブ', 'haabu', 'травы'),
  createWord('katakana', 'パン', 'pan', 'хлеб'),
  createWord('katakana', 'ホテル', 'hoteru', 'отель'),
  createWord('katakana', 'マスク', 'masuku', 'маска'),
  createWord('katakana', 'メモ', 'memo', 'заметка'),
  createWord('katakana', 'ラジオ', 'rajio', 'радио'),
]

const cardById = Object.fromEntries(KANA_STATS_CARDS.map((card) => [card.id, card]))

function createCard(entry, groupId, script) {
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

export function getCardById(cardId) {
  return cardById[cardId] ?? null
}

export function buildPool(scriptMode, selectedGroups) {
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

function createWord(script, kana, romaji, meaning) {
  return { script, kana, romaji, meaning }
}
