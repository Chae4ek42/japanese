import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_LATENCY_MODEL,
  deriveGrade,
  isForgivableTypo,
  levenshtein,
} from '../../src/shared/lib/review'

describe('review grading helpers', () => {
  it('detects forgivable typos of distance 1 and same length', () => {
    assert.equal(levenshtein('neko', 'neko'), 0)
    assert.equal(isForgivableTypo(['neko'], 'neko'), false)
    assert.equal(isForgivableTypo(['neko'], 'neko'), false)
    assert.equal(isForgivableTypo(['neko'], 'neko'), false)
    assert.equal(isForgivableTypo(['neko'], 'neko'), false)
    assert.equal(isForgivableTypo(['neko'], 'nekp'), true)
    assert.equal(isForgivableTypo(['neko'], 'nek'), false)
  })

  it('maps outcomes to grades', () => {
    assert.equal(
      deriveGrade({
        wrong: true,
        hintUsed: false,
        dontKnow: false,
        typoForgiven: false,
        mistakesOnCard: 1,
        latencyMs: 1000,
        answerLength: 4,
        mode: 'romaji',
        latencyModel: DEFAULT_LATENCY_MODEL,
      }),
      1,
    )
    assert.equal(
      deriveGrade({
        wrong: false,
        hintUsed: false,
        dontKnow: false,
        typoForgiven: true,
        mistakesOnCard: 0,
        latencyMs: 1000,
        answerLength: 4,
        mode: 'romaji',
        latencyModel: DEFAULT_LATENCY_MODEL,
      }),
      2,
    )
    assert.equal(
      deriveGrade({
        wrong: false,
        hintUsed: false,
        dontKnow: false,
        typoForgiven: false,
        mistakesOnCard: 0,
        latencyMs: 1800,
        answerLength: 4,
        mode: 'romaji',
        latencyModel: DEFAULT_LATENCY_MODEL,
      }),
      3,
    )
  })
})
