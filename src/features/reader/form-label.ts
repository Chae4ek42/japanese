import type { IpadicFeatures } from '../../shared/lib/kuromoji-tokenizer'

const POS_RU: Record<string, string> = {
  動詞: 'глагол',
  形容詞: 'i-прилагательное',
  形容動詞: 'na-прилагательное',
  名詞: 'существительное',
  副詞: 'наречие',
  連体詞: 'определение',
  助詞: 'частица',
  助動詞: 'связка / вспомогательный',
  接続詞: 'союз',
  感動詞: 'междометие',
  記号: 'знак',
  接頭詞: 'приставка',
  フィラー: 'филлер',
}

const CONJ_FORM_RU: Record<string, string> = {
  基本形: 'словарная форма',
  連用形: 'срединная форма (連用形)',
  未然形: 'незавершённая форма (未然形)',
  連用タ接続: 'форма перед 〜た',
  連用テ接続: 'форма перед 〜て',
  仮定形: 'условная форма',
  命令形: 'повелительная форма',
  体言接続: 'перед существительным',
  ガル接続: 'форма перед 〜がる',
}

function hasBasic(group: IpadicFeatures[], basic: string): boolean {
  return group.some((token) => token.basic_form === basic)
}

function hasAnyBasic(group: IpadicFeatures[], basics: string[]): boolean {
  return basics.some((basic) => hasBasic(group, basic))
}

/** Human-readable Russian gloss for the conjugated surface vs lemma. */
export function describeMorphForm(group: IpadicFeatures[]): string {
  if (!group.length) return ''
  const head = group[0]!
  const bits: string[] = []

  const polite = hasBasic(group, 'ます')
  const past = hasBasic(group, 'た')
  const neg =
    hasBasic(group, 'ない') ||
    hasBasic(group, 'ん') ||
    hasBasic(group, 'ぬ')
  const desire = hasBasic(group, 'たい')
  const progressive = hasAnyBasic(group, ['いる', 'おる'])
  const perfective = hasBasic(group, 'しまう')
  const preparatory = hasBasic(group, 'おく')
  const trySee = hasBasic(group, 'みる')
  const passive = hasAnyBasic(group, ['れる', 'られる'])
  const causative = hasAnyBasic(group, ['せる', 'させる'])
  const copulaDesu = hasBasic(group, 'です')
  const copulaDa = hasBasic(group, 'だ')

  if (polite && neg && past) {
    bits.push('вежливое отрицательное прошедшее (ませんでした)')
  } else if (polite && neg) {
    bits.push('вежливое отрицание (ません)')
  } else if (polite && past) {
    bits.push('вежливое прошедшее (ました)')
  } else if (polite) {
    bits.push('вежливая форма (ます)')
  } else if (progressive && past) {
    bits.push('продолженное прошедшее (〜ていた)')
  } else if (progressive) {
    bits.push('продолженная форма (〜ている)')
  } else if (perfective && past) {
    bits.push('завершённость (〜てしまった)')
  } else if (perfective) {
    bits.push('завершённость (〜てしまう)')
  } else if (preparatory) {
    bits.push('заготовка на будущее (〜ておく)')
  } else if (trySee) {
    bits.push('попробовать (〜てみる)')
  } else if (desire) {
    bits.push('желание (〜たい)')
  } else if (causative && passive) {
    bits.push('понудительно-страдательный залог')
  } else if (causative) {
    bits.push('понудительный залог (〜せる / 〜させる)')
  } else if (passive) {
    bits.push('страдательный / возможность (〜れる / 〜られる)')
  } else if (neg && past) {
    bits.push('отрицательное прошедшее')
  } else if (neg) {
    bits.push('отрицание')
  } else if (past) {
    bits.push('прошедшее время')
  } else if (copulaDesu && group.length === 1) {
    bits.push('вежливая связка')
  } else if (copulaDa && group.length === 1) {
    bits.push('связка だ')
  } else if (group.length === 1) {
    const form = CONJ_FORM_RU[head.conjugated_form]
    if (form && head.conjugated_form !== '*' && head.conjugated_form !== '基本形') {
      bits.push(form)
    } else if (head.conjugated_form === '基本形') {
      bits.push('словарная форма')
    }
  }

  return bits.join(' · ')
}

export function posLabelRu(pos: string): string {
  return POS_RU[pos] || pos
}
