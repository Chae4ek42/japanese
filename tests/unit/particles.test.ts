import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CORE_PARTICLES,
  PARTICLE_CLOZE_CARDS,
  buildParticlePool,
  formatParticlePrompt,
  getParticleCard,
  particleChoiceOptions,
  splitParticlePrompt,
} from '../../src/data/particles.ts'

describe('particles cloze bank', () => {
  it('имеет 12 основных частиц', () => {
    assert.equal(CORE_PARTICLES.length, 12)
    assert.deepEqual(
      [...CORE_PARTICLES],
      ['は', 'が', 'を', 'に', 'で', 'へ', 'と', 'も', 'の', 'から', 'まで', 'や'],
    )
  })

  it('карточки уникальны и с валидным ответом', () => {
    const ids = new Set<string>()
    for (const card of PARTICLE_CLOZE_CARDS) {
      assert.ok(!ids.has(card.id), `duplicate ${card.id}`)
      ids.add(card.id)
      assert.ok(card.prompt.includes('___'), card.id)
      assert.ok((CORE_PARTICLES as readonly string[]).includes(card.answer), card.id)
      assert.equal(getParticleCard(card.id)?.id, card.id)
    }
    assert.ok(PARTICLE_CLOZE_CARDS.length >= 80, `bank size ${PARTICLE_CLOZE_CARDS.length}`)
    assert.equal(buildParticlePool().length, PARTICLE_CLOZE_CARDS.length)
  })

  it('фильтрует набор по фокусу', () => {
    const frame = buildParticlePool('frame')
    const connect = buildParticlePool('connect')
    assert.ok(frame.every((card) => ['は', 'が', 'を', 'に', 'で', 'へ'].includes(card.answer)))
    assert.ok(connect.every((card) => ['と', 'も', 'の', 'から', 'まで', 'や'].includes(card.answer)))
    assert.equal(frame.length + connect.length, PARTICLE_CLOZE_CARDS.length)
  })

  it('пада отдаёт фиксированный порядок частиц', () => {
    const options = particleChoiceOptions('all')
    assert.equal(options.length, 12)
    assert.deepEqual(options, [...CORE_PARTICLES])
    assert.equal(particleChoiceOptions('frame').length, 6)
  })

  it('у каждой карточки есть kana и romaji с пропуском', () => {
    for (const card of PARTICLE_CLOZE_CARDS) {
      assert.ok(card.kana.includes('___'), card.id)
      assert.ok(card.romaji.includes('___'), card.id)
    }
  })

  it('подставляет частицу и режет промпт по пропуску', () => {
    assert.equal(formatParticlePrompt('私___学生です。', 'は'), '私は学生です。')
    assert.deepEqual(splitParticlePrompt('私___学生です。'), {
      before: '私',
      after: '学生です。',
    })
  })
})
