import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAIN_TRAINING_SET_ID,
  addWordsToTrainingSet,
  createMainTrainingSet,
  moveWordsBetweenTrainingSets,
  removeWordsFromTrainingSet,
  sanitizeTrainingSets,
} from '../../src/shared/lib/trainingSets.ts'

describe('training sets', () => {
  it('мигрирует legacy trainingWordIds в основной набор', () => {
    const sets = sanitizeTrainingSets(undefined, ['a', 'b', 'a'], [])
    assert.equal(sets.length, 1)
    assert.equal(sets[0]!.id, MAIN_TRAINING_SET_ID)
    assert.deepEqual(sets[0]!.wordIds, ['a', 'b'])
  })

  it('добавляет и удаляет слова', () => {
    let sets = [createMainTrainingSet(['1'])]
    sets = addWordsToTrainingSet(sets, MAIN_TRAINING_SET_ID, ['2', '1'])
    assert.deepEqual(sets[0]!.wordIds, ['1', '2'])
    sets = removeWordsFromTrainingSet(sets, MAIN_TRAINING_SET_ID, ['1'])
    assert.deepEqual(sets[0]!.wordIds, ['2'])
  })

  it('переносит слова между наборами', () => {
    const now = 1
    let sets = [
      createMainTrainingSet(['1', '2'], now),
      {
        id: 'set_x',
        name: 'Теория',
        wordIds: ['3'],
        createdAt: now,
        updatedAt: now,
      },
    ]
    sets = moveWordsBetweenTrainingSets(sets, {
      fromSetId: 'set_x',
      toSetId: MAIN_TRAINING_SET_ID,
      wordIds: ['3'],
    })
    assert.deepEqual(sets.find((s) => s.id === MAIN_TRAINING_SET_ID)?.wordIds, ['1', '2', '3'])
    assert.deepEqual(sets.find((s) => s.id === 'set_x')?.wordIds, [])
  })
})
