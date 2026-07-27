import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectGrammarIds } from '../../src/features/context/grammar'
import { isContextLlmConfigured } from '../../src/features/context/llm'
import { matchWordIdsInText } from '../../src/features/context/matchWords'

describe('context llm helpers', () => {
  it('без env LLM выключен', () => {
    assert.equal(isContextLlmConfigured(), false)
  })

  it('детектит базовую грамматику', () => {
    const ids = detectGrammarIds('お父さんはいますか。')
    assert.ok(ids.includes('particle_wa'))
    assert.ok(ids.includes('existence_aru_iru'))
    assert.ok(ids.includes('question_ka'))
  })

  it('матчит id слова 父 в тексте', () => {
    const ids = matchWordIdsInText('父です。')
    assert.ok(ids.includes('1497610'))
  })
})
