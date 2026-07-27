import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STARTER_GRAMMAR_IDS } from '../../src/features/context/grammar'
import {
  pickActiveBatch,
  pickIPlusOneSentence,
  pickNextTargetWord,
  pickSentenceForBatch,
  scoreBatchSentence,
  scoreSentence,
} from '../../src/features/context/picker'
import { getWordsForGroup } from '../../src/features/vocab/groups'
import type { ContextSentence } from '../../src/shared/lib/types'

describe('context i+1 picker', () => {
  it('принимает предложение с одним новым словом', () => {
    const sentence: ContextSentence = {
      id: 't1',
      text: '父です。',
      glossRu: 'Это отец.',
      wordIds: ['1497610'],
      grammarIds: ['copula_desu'],
      source: 'seed',
    }
    const score = scoreSentence(sentence, '1497610', new Set(), new Set(STARTER_GRAMMAR_IDS), {
      knownWordIds: [],
      knownGrammarIds: [...STARTER_GRAMMAR_IDS],
    })
    assert.ok(score != null && score > 0)
  })

  it('отклоняет предложение с лишним неизвестным словом', () => {
    const sentence: ContextSentence = {
      id: 't2',
      text: '私の父です。',
      glossRu: 'Это мой отец.',
      wordIds: ['1311110', '1497610'],
      grammarIds: ['particle_no', 'copula_desu'],
      source: 'seed',
    }
    const score = scoreSentence(sentence, '1497610', new Set(), new Set(STARTER_GRAMMAR_IDS), {
      knownWordIds: [],
      knownGrammarIds: [...STARTER_GRAMMAR_IDS],
    })
    assert.equal(score, null)
  })

  it('принимает два новых слова при maxNewPerSentence=2', () => {
    const sentence: ContextSentence = {
      id: 't3',
      text: '私の父です。',
      glossRu: 'Это мой отец.',
      wordIds: ['1311110', '1497610'],
      grammarIds: ['particle_no', 'copula_desu'],
      source: 'seed',
    }
    const score = scoreBatchSentence(
      sentence,
      new Set(['1311110', '1497610']),
      new Set(),
      new Set(STARTER_GRAMMAR_IDS),
      {
        knownWordIds: [],
        knownGrammarIds: [...STARTER_GRAMMAR_IDS],
        maxNewPerSentence: 2,
      },
    )
    assert.ok(score != null && score > 0)
  })

  it('находит seed-предложение для 父 в группе семья', () => {
    const picked = pickIPlusOneSentence('1497610', {
      knownWordIds: [],
      knownGrammarIds: [...STARTER_GRAMMAR_IDS],
      preferThemes: ['family'],
    })
    assert.equal(picked.reason, 'ok')
    assert.ok(picked.sentence)
    assert.ok(picked.sentence!.text.includes('父'))
  })

  it('выбирает следующее слово группы с доступным i+1', () => {
    const words = getWordsForGroup('family')
    const next = pickNextTargetWord(words, {
      knownWordIds: [],
      knownGrammarIds: [...STARTER_GRAMMAR_IDS],
      preferThemes: ['family'],
    })
    assert.ok(next?.id)
    const picked = pickIPlusOneSentence(next!.id!, {
      knownWordIds: [],
      knownGrammarIds: [...STARTER_GRAMMAR_IDS],
      preferThemes: ['family'],
    })
    assert.equal(picked.reason, 'ok')
  })

  it('собирает пакет и предложение для нескольких новых слов', () => {
    const words = getWordsForGroup('family')
    const options = {
      knownWordIds: [] as string[],
      knownGrammarIds: [...STARTER_GRAMMAR_IDS],
      preferThemes: ['family'],
      maxNewPerSentence: 2,
      batchSize: 3,
    }
    const batch = pickActiveBatch(words, options)
    assert.ok(batch.length >= 1 && batch.length <= 3)
    const picked = pickSentenceForBatch(
      batch.map((word) => word.id!),
      options,
    )
    assert.equal(picked.reason, 'ok')
    assert.ok(picked.unknownWordIds.length >= 1)
    assert.ok(picked.unknownWordIds.length <= 2)
  })
})
