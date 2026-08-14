import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VocabCard } from '../../src/shared/lib/types'
import { buildMeaningPrompt, buildMixedPrompt } from '../../src/features/vocab/mixed'
import { cleanQuizGloss, pickQuizMeaning } from '../../src/shared/lib/jmdict-gloss'

function card(partial: Partial<VocabCard> & Pick<VocabCard, 'id' | 'writing'>): VocabCard {
  return {
    kana: partial.kana ?? 'あ',
    romaji: partial.romaji ?? 'a',
    answers: partial.answers ?? ['a'],
    meaning: partial.meaning ?? 'значение',
    meanings: partial.meanings ?? [partial.meaning ?? 'значение'],
    ...partial,
  }
}

describe('vocab mixed prompts', () => {
  const pool: VocabCard[] = [
    card({ id: '1', writing: '父', kana: 'ちち', romaji: 'chichi', meaning: 'отец' }),
    card({ id: '2', writing: '母', kana: 'はは', romaji: 'haha', meaning: 'мать' }),
    card({ id: '3', writing: '兄', kana: 'あに', romaji: 'ani', meaning: 'старший брат' }),
    card({ id: '4', writing: '姉', kana: 'あね', romaji: 'ane', meaning: 'старшая сестра' }),
    card({ id: '5', writing: '弟', kana: 'おとうと', romaji: 'otouto', meaning: 'младший брат' }),
    card({ id: '6', writing: '妹', kana: 'いもうと', romaji: 'imouto', meaning: 'младшая сестра' }),
  ]

  it('meaning prompt показывает написание и варианты перевода', () => {
    const prompt = buildMeaningPrompt(pool[0]!, pool, { rng: () => 0 })
    assert.ok(prompt)
    assert.equal(prompt!.kind, 'meaning')
    assert.equal(prompt!.stemText, '父')
    assert.equal(prompt!.correctAnswer, 'отец')
    assert.ok(prompt!.options.includes('отец'))
    assert.ok(prompt!.options.length >= 2)
    assert.ok(prompt!.options.length <= 6)
  })

  it('mixed prompt чередует типы вопросов', () => {
    const kinds = new Set<string>()
    for (let i = 0; i < 40; i += 1) {
      const prompt = buildMixedPrompt(pool[i % pool.length]!, pool, { rng: () => (i % 7) / 7 })
      assert.ok(prompt)
      kinds.add(prompt!.kind)
      assert.ok(prompt!.options.includes(prompt!.correctAnswer))
      assert.ok(prompt!.options.length <= 6)
    }
    assert.ok(kinds.has('meaning'))
    assert.ok(kinds.has('reading'))
    assert.ok(kinds.has('writing'))
  })

  it('для слова каной не спрашивает чтение', () => {
    const kanaPool: VocabCard[] = [
      card({ id: 'a', writing: 'どうも', kana: 'どうも', romaji: 'doumo', meaning: 'спасибо / очень' }),
      card({ id: 'b', writing: 'ちょっと', kana: 'ちょっと', romaji: 'chotto', meaning: 'немножко' }),
      card({ id: 'c', writing: 'とても', kana: 'とても', romaji: 'totemo', meaning: 'очень' }),
      card({ id: 'd', writing: 'いつも', kana: 'いつも', romaji: 'itsumo', meaning: 'всегда' }),
      card({ id: 'e', writing: 'まだ', kana: 'まだ', romaji: 'mada', meaning: 'ещё' }),
      card({ id: 'f', writing: 'もう', kana: 'もう', romaji: 'mou', meaning: 'уже' }),
    ]
    for (let i = 0; i < 30; i += 1) {
      const prompt = buildMixedPrompt(kanaPool[0]!, kanaPool, { rng: () => i / 30 })
      assert.ok(prompt)
      assert.notEqual(prompt!.kind, 'reading')
    }
  })

  it('writing prompt спрашивает написание по значению', () => {
    let writingPrompt = null
    for (let i = 0; i < 30; i += 1) {
      const prompt = buildMixedPrompt(pool[0]!, pool, { rng: () => i / 30 })
      if (prompt?.kind === 'writing') {
        writingPrompt = prompt
        break
      }
    }
    assert.ok(writingPrompt)
    assert.equal(writingPrompt!.stemMode, 'text')
    assert.equal(writingPrompt!.correctAnswer, '父')
    assert.ok(writingPrompt!.options.every((item) => /[一-龯ぁ-んァ-ン]/.test(item) || item.length >= 1))
  })
})

describe('quiz gloss quality for mixed choices', () => {
  it('отбрасывает голые конструкции и примеры употребления', () => {
    assert.equal(cleanQuizGloss('{～に}'), null)
    assert.equal(cleanQuizGloss('пример: 本を読む'), null)
    assert.equal(cleanQuizGloss('употребл. в письмах'), null)
  })

  it('не оставляет ～ в вариантах ответа', () => {
    assert.equal(cleanQuizGloss('делать ～ что-л. для кого-л.'), null)
  })

  it('по-прежнему достаёт короткое лексическое значение', () => {
    assert.equal(cleanQuizGloss('{～へ} сюда'), 'сюда')
    assert.equal(pickQuizMeaning(['(см.) こちら', '1) здесь']), 'здесь')
  })
})
