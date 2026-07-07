// Конвертация каны в варианты ромадзи для проверки ввода.
// Основной вариант — вапуро-хэпбёрн (как печатают в IME: おう -> "ou"),
// дополнительные — кунрэй-варианты (si, ti, tu, hu, zi, sya...).

const BASE = {
  あ: ['a'], い: ['i'], う: ['u'], え: ['e'], お: ['o'],
  か: ['ka'], き: ['ki'], く: ['ku'], け: ['ke'], こ: ['ko'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  さ: ['sa'], し: ['shi', 'si'], す: ['su'], せ: ['se'], そ: ['so'],
  ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
  だ: ['da'], ぢ: ['ji', 'di'], づ: ['zu', 'du'], で: ['de'], ど: ['do'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], を: ['wo', 'o'], ん: ['n', 'nn'],
}

const DIGRAPHS = {
  きゃ: ['kya'], きゅ: ['kyu'], きょ: ['kyo'],
  ぎゃ: ['gya'], ぎゅ: ['gyu'], ぎょ: ['gyo'],
  しゃ: ['sha', 'sya'], しゅ: ['shu', 'syu'], しょ: ['sho', 'syo'],
  じゃ: ['ja', 'zya'], じゅ: ['ju', 'zyu'], じょ: ['jo', 'zyo'],
  ちゃ: ['cha', 'tya'], ちゅ: ['chu', 'tyu'], ちょ: ['cho', 'tyo'],
  にゃ: ['nya'], にゅ: ['nyu'], にょ: ['nyo'],
  ひゃ: ['hya'], ひゅ: ['hyu'], ひょ: ['hyo'],
  びゃ: ['bya'], びゅ: ['byu'], びょ: ['byo'],
  ぴゃ: ['pya'], ぴゅ: ['pyu'], ぴょ: ['pyo'],
  みゃ: ['mya'], みゅ: ['myu'], みょ: ['myo'],
  りゃ: ['rya'], りゅ: ['ryu'], りょ: ['ryo'],
}

const KATA_TO_HIRA_OFFSET = 0x60

export function hiraganaToKatakana(text) {
  return [...text]
    .map((char) => {
      const code = char.codePointAt(0)
      // ぁ (3041) — ゖ (3096) → катакана
      if (code >= 0x3041 && code <= 0x3096) {
        return String.fromCodePoint(code + KATA_TO_HIRA_OFFSET)
      }
      return char
    })
    .join('')
}

export function katakanaToHiragana(text) {
  return [...text]
    .map((char) => {
      const code = char.codePointAt(0)
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCodePoint(code - KATA_TO_HIRA_OFFSET)
      }
      return char
    })
    .join('')
}

// Разбивает кану на токены, каждый токен — массив вариантов ромадзи.
function tokenize(kanaInput) {
  const kana = katakanaToHiragana(kanaInput)
  const tokens = []
  let geminate = false

  for (let index = 0; index < kana.length; index += 1) {
    const char = kana[index]

    if (char === 'っ') {
      geminate = true
      continue
    }

    if (char === 'ー') {
      // Долгота: повторяем гласную предыдущего токена.
      const previous = tokens.at(-1)
      if (previous) {
        tokens.push(previous.map((option) => option.at(-1)))
      }
      continue
    }

    const pair = char + (kana[index + 1] ?? '')
    let options
    if (DIGRAPHS[pair]) {
      options = DIGRAPHS[pair]
      index += 1
    } else if (BASE[char]) {
      options = BASE[char]
    } else {
      throw new Error(`Неизвестный символ каны: ${char} в «${kanaInput}»`)
    }

    if (geminate) {
      geminate = false
      options = options.flatMap((option) => {
        const doubled = option[0] + option
        // っち: IME принимает и cchi, и tchi.
        return option.startsWith('ch') ? [doubled, `t${option}`] : [doubled]
      })
    }

    tokens.push(options)
  }

  return tokens
}

const VARIANTS_CAP = 128

// Все допустимые написания слова ромадзи (первый вариант — основной).
export function kanaToRomajiVariants(kana) {
  const tokens = tokenize(kana)
  let variants = ['']
  for (const options of tokens) {
    const next = []
    for (const variant of variants) {
      for (const option of options) {
        next.push(variant + option)
        if (next.length >= VARIANTS_CAP) {
          break
        }
      }
      if (next.length >= VARIANTS_CAP) {
        break
      }
    }
    variants = next
  }
  return [...new Set(variants)]
}

export function kanaToRomaji(kana) {
  return tokenize(kana)
    .map((options) => options[0])
    .join('')
}
