const ROMAJI = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  ゐ: 'wi',
  ゑ: 'we',
  を: 'wo',
  ん: 'n',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゃ: 'ya',
  ゅ: 'yu',
  ょ: 'yo',
  っ: '',
  ー: '',
}

const VOICED = {
  か: 'が',
  き: 'ぎ',
  く: 'ぐ',
  け: 'げ',
  こ: 'ご',
  さ: 'ざ',
  し: 'じ',
  す: 'ず',
  せ: 'ぜ',
  そ: 'ぞ',
  た: 'だ',
  ち: 'ぢ',
  つ: 'づ',
  て: 'で',
  と: 'ど',
  は: 'ば',
  ひ: 'び',
  ふ: 'ぶ',
  へ: 'べ',
  ほ: 'ぼ',
}

const SEMIVOICED = {
  は: 'ぱ',
  ひ: 'ぴ',
  ふ: 'ぷ',
  へ: 'ぺ',
  ほ: 'ぽ',
}

export function toHiragana(text) {
  return Array.from(String(text ?? ''))
    .map((ch) => {
      const code = ch.codePointAt(0)
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCodePoint(code - 0x60)
      }
      return ch
    })
    .join('')
}

export function isKanaChar(ch) {
  return /[\u3040-\u309f\u30a0-\u30ff]/.test(ch)
}

export function isKanjiChar(ch) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)
}

export function kanaToRomaji(kana) {
  let out = ''
  const s = toHiragana(String(kana ?? '').normalize('NFKC'))
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    const next = s[i + 1]
    if (ch === 'っ') {
      const nextRomaji = ROMAJI[next] || ''
      out += nextRomaji ? nextRomaji[0] : ''
      continue
    }
    if (next && 'ゃゅょ'.includes(next)) {
      const base = ROMAJI[ch] || ''
      const small = ROMAJI[next] || ''
      if (base.endsWith('i') && small) {
        out += `${base.slice(0, -1)}${small}`
        i += 1
        continue
      }
    }
    out += ROMAJI[ch] ?? (/[a-zA-Z0-9]/.test(ch) ? ch : '')
  }
  return out
}

export function withRendakuVariants(reading) {
  const base = toHiragana(reading)
  if (!base) {
    return []
  }
  const variants = new Set([base])
  const first = base[0]
  if (VOICED[first]) {
    variants.add(`${VOICED[first]}${base.slice(1)}`)
  }
  if (SEMIVOICED[first]) {
    variants.add(`${SEMIVOICED[first]}${base.slice(1)}`)
  }
  return [...variants]
}
