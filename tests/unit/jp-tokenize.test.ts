import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PARTICLE_CLOZE_CARDS,
  buildParticlePool,
  particleCardSurface,
} from '../../src/data/particles.ts'
import {
  contentTokens,
  sentenceKnownByMine,
  tokenizeJapanese,
} from '../../src/shared/lib/jp-tokenize.ts'

describe('jp-tokenize', () => {
  it('режет предложение на слова словаря', () => {
    const tokens = tokenizeJapanese('私は学生です。')
    const surfaces = tokens.map((token) => token.surface)
    assert.ok(surfaces.includes('私'))
    assert.ok(surfaces.includes('は'))
    assert.ok(surfaces.includes('学生'))
    assert.ok(tokens.some((token) => token.isParticle && token.surface === 'は'))
  })

  it('contentTokens пропускает частицы и служебные', () => {
    const content = contentTokens(tokenizeJapanese('私は学生です。'))
    const writings = content.map((token) => token.word?.writing)
    assert.ok(writings.includes('私') || writings.includes('わたし'))
    assert.ok(writings.includes('学生'))
    assert.ok(!writings.includes('です'))
    assert.equal(
      content.every((token) => !token.isParticle),
      true,
    )
  })

  it('узнаёт слова на кане и катакане', () => {
    const content = contentTokens(tokenizeJapanese('コーヒーは好きです。パンもください。'))
    const writings = content.map((token) => token.word?.writing)
    assert.ok(writings.includes('コーヒー'), writings.join(','))
    assert.ok(writings.includes('好き') || writings.includes('すき'), writings.join(','))
    assert.ok(writings.includes('パン'), writings.join(','))
  })

  it('sentenceKnownByMine требует все знаменательные слова из моих', () => {
    const surface = '私は学生です。'
    const content = contentTokens(tokenizeJapanese(surface))
    const ids = content.flatMap((token) =>
      token.word?.variantIds?.length
        ? token.word.variantIds
        : token.word?.id
          ? [token.word.id]
          : [],
    )
    assert.ok(ids.length >= 1)
    assert.equal(sentenceKnownByMine(surface, new Set()), false)
    assert.equal(sentenceKnownByMine(surface, new Set(ids)), true)
    assert.equal(sentenceKnownByMine(surface, new Set(ids.slice(0, 1))), false)
  })
})

describe('particles mineOnly filter', () => {
  it('оставляет только предложения из известных слов', () => {
    const all = buildParticlePool('all')
    assert.ok(all.length > 0)

    const emptyMine = all.filter((card) =>
      sentenceKnownByMine(particleCardSurface(card), new Set()),
    )
    for (const card of emptyMine) {
      assert.equal(
        contentTokens(tokenizeJapanese(particleCardSurface(card))).length,
        0,
        card.id,
      )
    }

    const sample = PARTICLE_CLOZE_CARDS.find(
      (card) => contentTokens(tokenizeJapanese(particleCardSurface(card))).length >= 2,
    )
    assert.ok(sample)
    const content = contentTokens(tokenizeJapanese(particleCardSurface(sample!)))
    const mine = new Set(
      content.flatMap((token) =>
        token.word?.variantIds?.length
          ? token.word.variantIds
          : token.word?.id
            ? [token.word.id]
            : [],
      ),
    )
    const filtered = all.filter((card) =>
      sentenceKnownByMine(particleCardSurface(card), mine),
    )
    assert.ok(filtered.some((card) => card.id === sample!.id))
    assert.ok(filtered.length < all.length)
  })
})
