import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setSavedWords } from '../../src/shared/lib/savedWords'
import { createMainTrainingSet } from '../../src/shared/lib/trainingSets'
import { createStatsRecord } from '../../src/shared/lib/trainer'
import { createDefaultAppState } from '../../src/shared/state/app-state'
import { sanitizeVocabState } from '../../src/shared/state/slices/vocab'
import type { VocabState } from '../../src/shared/lib/types'

describe('independent saved vocabulary', () => {
  function fixture(): VocabState {
    const vocab = createDefaultAppState().vocab
    return {
      ...vocab,
      learnedWordIds: ['custom:word'],
      customWords: {
        'custom:word': { id: 'custom:word', kanji: ['猫'], writing: '猫', kana: 'ねこ', romaji: 'neko', meanings: ['кошка'] },
      },
      stats: { 'custom:word': createStatsRecord() },
      trainingSets: [
        createMainTrainingSet(['custom:word'], 1),
        { id: 'theme', name: 'Тема', wordIds: ['custom:word'], createdAt: 1, updatedAt: 1 },
      ],
    }
  }

  it('сохранение и удаление из Моих слов сохраняет наборы, статус, определение и статистику', () => {
    const original = fixture()
    const saved = setSavedWords(original, ['custom:word', 'custom:word'], true, 10)
    assert.deepEqual(saved.myWords, ['custom:word'])
    assert.deepEqual(saved.myWordAddedAt, { 'custom:word': 10 })
    const removed = setSavedWords(saved, ['custom:word'], false, 20)
    assert.deepEqual(removed.myWords, [])
    assert.deepEqual(removed.myWordAddedAt, {})
    for (const state of [saved, removed]) {
      assert.strictEqual(state.trainingSets, original.trainingSets)
      assert.strictEqual(state.learnedWordIds, original.learnedWordIds)
      assert.strictEqual(state.customWords, original.customWords)
      assert.strictEqual(state.stats, original.stats)
      assert.strictEqual(state.memory, original.memory)
    }
  })

  it('повторное добавление сохраняет дату и ссылку на состояние', () => {
    const saved = setSavedWords(fixture(), ['custom:word'], true, 10)
    assert.strictEqual(setSavedWords(saved, ['custom:word'], true, 20), saved)
    assert.strictEqual(setSavedWords(saved, ['unknown'], false, 20), saved)
  })

  it('резервная копия не возвращает несохранённое пользовательское слово в Мои слова', () => {
    const saved = setSavedWords(fixture(), ['custom:word'], true, 10)
    const removed = setSavedWords(saved, ['custom:word'], false, 20)
    const restored = sanitizeVocabState(JSON.parse(JSON.stringify(removed)), createDefaultAppState().vocab)
    assert.deepEqual(restored.myWords, [])
    assert.deepEqual(restored.learnedWordIds, ['custom:word'])
    assert.deepEqual(restored.trainingSets, removed.trainingSets)
    assert.equal(restored.customWords['custom:word']?.writing, '猫')
    assert.deepEqual(Object.keys(restored.stats), ['custom:word'])
  })
})
