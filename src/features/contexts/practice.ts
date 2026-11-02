import { kanaToRomaji, toHiragana } from '../../shared/lib/kana'
import type { WordContext } from '../../shared/lib/types'

function normalize(value: string) {
  return toHiragana(value.normalize('NFKC').trim()).toLowerCase().replace(/[\s'’-]/g, '').replace(/shy/g, 'sh').replace(/chy/g, 'ch').replace(/jy/g, 'j')
}

export function acceptsContextAnswer(example: WordContext, answer: string): boolean {
  const expected = [example.surface]
  if (example.reading) expected.push(example.reading, kanaToRomaji(example.reading))
  if (/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(example.surface)) expected.push(kanaToRomaji(example.surface))
  const key = normalize(answer)
  return Boolean(key) && expected.some((value) => normalize(value) === key)
}

export function contextCloze(example: WordContext): string {
  // Hide every occurrence so a repeated word cannot disclose the answer.
  return example.sentence.split(example.surface).join('［　　　］')
}

export function contextSourceLabel(example: WordContext): string {
  const kind = example.sourceKind === 'reader' ? 'Из вашего текста' : example.sourceKind === 'theory' ? 'Из теории' : 'Ваш пример'
  return example.sourceTitle ? `${kind} · ${example.sourceTitle}` : kind
}
