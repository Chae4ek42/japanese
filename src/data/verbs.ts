import { kanaToRomaji } from '../shared/lib/kana'
import { DEFAULT_HYPERPARAMS, createStatsRecord } from '../shared/lib/trainer'
import type { Hyperparams, StatsRecord, VerbFormId, VerbGroup, VerbsFocus } from '../shared/lib/types'

export const VERB_HYPERPARAMS: Hyperparams = { ...DEFAULT_HYPERPARAMS }

export const VERB_FORMS: Array<{ id: VerbFormId; label: string; hint: string }> = [
  { id: 'te', label: 'て', hint: 'て-форма: связка действий, てください, ている' },
  { id: 'ta', label: 'た', hint: 'Простое прошедшее (た-форма)' },
  { id: 'nai', label: 'ない', hint: 'Простое отрицание' },
  { id: 'masu', label: 'ます', hint: 'Вежливое настоящее / будущее' },
  { id: 'potential', label: 'возможн.', hint: 'Возможная форма: могу сделать' },
]

export const VERB_FORM_LABELS: Record<VerbFormId, string> = {
  te: 'て-форма',
  ta: 'た-форма',
  nai: 'ない (отрицание)',
  masu: 'ます (вежливая)',
  potential: 'возможная форма',
}

export interface VerbLexeme {
  id: string
  writing: string
  kana: string
  meaning: string
  group: VerbGroup
}

export interface VerbFormResult {
  writing: string
  kana: string
  romaji: string
}

export interface VerbCard {
  id: string
  verbId: string
  form: VerbFormId
  dictionary: VerbFormResult
  meaning: string
  group: VerbGroup
  target: VerbFormResult
}

const GODAN: Record<string, { a: string; i: string; e: string; te: string; ta: string }> = {
  う: { a: 'わ', i: 'い', e: 'え', te: 'って', ta: 'った' },
  つ: { a: 'た', i: 'ち', e: 'て', te: 'って', ta: 'った' },
  る: { a: 'ら', i: 'り', e: 'れ', te: 'って', ta: 'った' },
  む: { a: 'ま', i: 'み', e: 'め', te: 'んで', ta: 'んだ' },
  ぶ: { a: 'ば', i: 'び', e: 'べ', te: 'んで', ta: 'んだ' },
  ぬ: { a: 'な', i: 'に', e: 'ね', te: 'んで', ta: 'んだ' },
  く: { a: 'か', i: 'き', e: 'け', te: 'いて', ta: 'いた' },
  ぐ: { a: 'が', i: 'ぎ', e: 'げ', te: 'いで', ta: 'いだ' },
  す: { a: 'さ', i: 'し', e: 'せ', te: 'して', ta: 'した' },
}

function result(writing: string, kana: string): VerbFormResult {
  return { writing, kana, romaji: kanaToRomaji(kana) }
}

function replaceEnd(source: string, from: string, to: string): string {
  if (source.endsWith(from)) return source.slice(0, -from.length) + to
  return source
}

function apply(writing: string, kana: string, from: string, to: string): VerbFormResult {
  return result(replaceEnd(writing, from, to), replaceEnd(kana, from, to))
}

function isSuru(kana: string): boolean {
  return kana === 'する' || kana.endsWith('する')
}

function isKuru(kana: string): boolean {
  return kana === 'くる'
}

function conjugateGodan(verb: VerbLexeme, form: VerbFormId): VerbFormResult {
  const last = verb.kana.slice(-1)
  const row = GODAN[last]
  if (!row) {
    throw new RangeError(`Неизвестное окончание godan: ${verb.kana}`)
  }

  const te = verb.kana === 'いく' ? 'って' : row.te
  const ta = verb.kana === 'いく' ? 'った' : row.ta

  switch (form) {
    case 'te':
      return apply(verb.writing, verb.kana, last, te)
    case 'ta':
      return apply(verb.writing, verb.kana, last, ta)
    case 'nai':
      return apply(verb.writing, verb.kana, last, `${row.a}ない`)
    case 'masu':
      return apply(verb.writing, verb.kana, last, `${row.i}ます`)
    case 'potential':
      return apply(verb.writing, verb.kana, last, `${row.e}る`)
  }
}

function conjugateIchidan(verb: VerbLexeme, form: VerbFormId): VerbFormResult {
  switch (form) {
    case 'te':
      return apply(verb.writing, verb.kana, 'る', 'て')
    case 'ta':
      return apply(verb.writing, verb.kana, 'る', 'た')
    case 'nai':
      return apply(verb.writing, verb.kana, 'る', 'ない')
    case 'masu':
      return apply(verb.writing, verb.kana, 'る', 'ます')
    case 'potential':
      return apply(verb.writing, verb.kana, 'る', 'られる')
  }
}

function conjugateIrregular(verb: VerbLexeme, form: VerbFormId): VerbFormResult {
  if (isKuru(verb.kana)) {
    switch (form) {
      case 'te':
        return result(replaceEnd(verb.writing, '来る', '来て'), 'きて')
      case 'ta':
        return result(replaceEnd(verb.writing, '来る', '来た'), 'きた')
      case 'nai':
        return result(replaceEnd(verb.writing, '来る', '来ない'), 'こない')
      case 'masu':
        return result(replaceEnd(verb.writing, '来る', '来ます'), 'きます')
      case 'potential':
        return result(replaceEnd(verb.writing, '来る', '来られる'), 'こられる')
    }
  }

  if (isSuru(verb.kana)) {
    switch (form) {
      case 'te':
        return apply(verb.writing, verb.kana, 'する', 'して')
      case 'ta':
        return apply(verb.writing, verb.kana, 'する', 'した')
      case 'nai':
        return apply(verb.writing, verb.kana, 'する', 'しない')
      case 'masu':
        return apply(verb.writing, verb.kana, 'する', 'します')
      case 'potential':
        return apply(verb.writing, verb.kana, 'する', 'できる')
    }
  }

  throw new RangeError(`Неизвестный неправильный глагол: ${verb.kana}`)
}

export function conjugateVerb(verb: VerbLexeme, form: VerbFormId): VerbFormResult {
  if (verb.group === 'godan') return conjugateGodan(verb, form)
  if (verb.group === 'ichidan') return conjugateIchidan(verb, form)
  return conjugateIrregular(verb, form)
}

export const VERB_LEXEMES: VerbLexeme[] = [
  { id: 'kaku', writing: '書く', kana: 'かく', meaning: 'писать', group: 'godan' },
  { id: 'yomu', writing: '読む', kana: 'よむ', meaning: 'читать', group: 'godan' },
  { id: 'nomu', writing: '飲む', kana: 'のむ', meaning: 'пить', group: 'godan' },
  { id: 'hanasu', writing: '話す', kana: 'はなす', meaning: 'говорить', group: 'godan' },
  { id: 'matsu', writing: '待つ', kana: 'まつ', meaning: 'ждать', group: 'godan' },
  { id: 'kau', writing: '買う', kana: 'かう', meaning: 'покупать', group: 'godan' },
  { id: 'iku', writing: '行く', kana: 'いく', meaning: 'идти / ехать', group: 'godan' },
  { id: 'oyogu', writing: '泳ぐ', kana: 'およぐ', meaning: 'плавать', group: 'godan' },
  { id: 'asobu', writing: '遊ぶ', kana: 'あそぶ', meaning: 'играть', group: 'godan' },
  { id: 'shinu', writing: '死ぬ', kana: 'しぬ', meaning: 'умирать', group: 'godan' },
  { id: 'toru', writing: '取る', kana: 'とる', meaning: 'брать', group: 'godan' },
  { id: 'tsukuru', writing: '作る', kana: 'つくる', meaning: 'делать / готовить', group: 'godan' },
  { id: 'shiru', writing: '知る', kana: 'しる', meaning: 'знать', group: 'godan' },
  { id: 'kaeru-godan', writing: '帰る', kana: 'かえる', meaning: 'возвращаться', group: 'godan' },
  { id: 'au', writing: '会う', kana: 'あう', meaning: 'встречаться', group: 'godan' },
  { id: 'motsu', writing: '持つ', kana: 'もつ', meaning: 'держать / иметь', group: 'godan' },
  { id: 'kiku', writing: '聞く', kana: 'きく', meaning: 'слушать / спрашивать', group: 'godan' },
  { id: 'omou', writing: '思う', kana: 'おもう', meaning: 'думать', group: 'godan' },
  { id: 'isogu', writing: '急ぐ', kana: 'いそぐ', meaning: 'спешить', group: 'godan' },
  { id: 'taberu', writing: '食べる', kana: 'たべる', meaning: 'есть', group: 'ichidan' },
  { id: 'miru', writing: '見る', kana: 'みる', meaning: 'смотреть', group: 'ichidan' },
  { id: 'okiru', writing: '起きる', kana: 'おきる', meaning: 'вставать', group: 'ichidan' },
  { id: 'oshieru', writing: '教える', kana: 'おしえる', meaning: 'учить / объяснять', group: 'ichidan' },
  { id: 'neru', writing: '寝る', kana: 'ねる', meaning: 'спать', group: 'ichidan' },
  { id: 'akeru', writing: '開ける', kana: 'あける', meaning: 'открывать', group: 'ichidan' },
  { id: 'shimeru', writing: '閉める', kana: 'しめる', meaning: 'закрывать', group: 'ichidan' },
  { id: 'kiru', writing: '着る', kana: 'きる', meaning: 'надевать (одежду)', group: 'ichidan' },
  { id: 'iru', writing: 'いる', kana: 'いる', meaning: 'быть (о живом)', group: 'ichidan' },
  { id: 'dekiru', writing: 'できる', kana: 'できる', meaning: 'мочь / получаться', group: 'ichidan' },
  { id: 'suru', writing: 'する', kana: 'する', meaning: 'делать', group: 'irregular' },
  { id: 'kuru', writing: '来る', kana: 'くる', meaning: 'приходить', group: 'irregular' },
  { id: 'benkyou-suru', writing: '勉強する', kana: 'べんきょうする', meaning: 'учиться', group: 'irregular' },
  { id: 'denwa-suru', writing: '電話する', kana: 'でんわする', meaning: 'звонить', group: 'irregular' },
]

const ALL_FORMS: VerbFormId[] = VERB_FORMS.map((form) => form.id)

function dictionaryOf(verb: VerbLexeme): VerbFormResult {
  return result(verb.writing, verb.kana)
}

function makeCard(verb: VerbLexeme, form: VerbFormId): VerbCard {
  const target = conjugateVerb(verb, form)
  return {
    id: `${verb.id}:${form}`,
    verbId: verb.id,
    form,
    dictionary: dictionaryOf(verb),
    meaning: verb.meaning,
    group: verb.group,
    target,
  }
}

export const VERB_CARDS: VerbCard[] = VERB_LEXEMES.flatMap((verb) =>
  ALL_FORMS.filter((form) => {
    const target = conjugateVerb(verb, form)
    return target.writing !== verb.writing
  }).map((form) => makeCard(verb, form)),
)

const VERB_CARD_BY_ID = new Map(VERB_CARDS.map((card) => [card.id, card]))

export function getVerbCard(id: string): VerbCard | null {
  return VERB_CARD_BY_ID.get(id) ?? null
}

export function buildVerbPool(focus: VerbsFocus = 'all'): VerbCard[] {
  if (focus === 'all') return VERB_CARDS
  return VERB_CARDS.filter((card) => card.form === focus)
}

export function verbChoiceOptions(card: VerbCard, count = 6): VerbFormResult[] {
  const sameVerb = VERB_CARDS.filter((item) => item.verbId === card.verbId).map((item) => item.target)
  const sameForm = VERB_CARDS.filter((item) => item.form === card.form).map((item) => item.target)
  const pool = [...sameVerb, ...sameForm, ...VERB_CARDS.map((item) => item.target)]
  const unique = new Map<string, VerbFormResult>()
  unique.set(card.target.writing, card.target)
  for (const option of pool) {
    if (unique.size >= count) break
    if (!unique.has(option.writing)) unique.set(option.writing, option)
  }
  const options = [...unique.values()]
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = options[i]
    options[i] = options[j]
    options[j] = tmp
  }
  return options
}

export function ensureVerbStats(stats: Record<string, StatsRecord>, cardId: string): StatsRecord {
  return stats[cardId] ?? createStatsRecord()
}

export function verbGroupLabel(group: VerbGroup): string {
  if (group === 'godan') return 'I · う'
  if (group === 'ichidan') return 'II · る'
  return 'III · する/来る'
}
