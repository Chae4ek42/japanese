import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectGlossFootnotes } from '../../src/shared/lib/jmdict-gloss'

describe('collectGlossFootnotes', () => {
  it('возвращает пустой список без пометок', () => {
    assert.deepEqual(collectGlossFootnotes(['день', 'солнце']), [])
  })

  it('объясняет {～に} и ведущее :', () => {
    const notes = collectGlossFootnotes([': {～に} среди бела дня'])
    assert.ok(notes.some((n) => n.marker === '{～…}'))
    assert.ok(notes.some((n) => n.marker === ':'))
    assert.ok(!notes.some((n) => n.marker === '[…]'))
  })

  it('объясняет необязательную частицу в [に]', () => {
    const notes = collectGlossFootnotes([': {～[に]} по (во) всей стране'])
    assert.ok(notes.some((n) => n.marker === '{～…}'))
    assert.ok(notes.some((n) => n.marker === '[…]'))
    assert.ok(notes.some((n) => n.marker === ':'))
  })

  it('объясняет (ср.) и (уст.), если они есть', () => {
    const notes = collectGlossFootnotes(['(ср.) {あのよう(～な)}', '(уст.) там'])
    assert.ok(notes.some((n) => n.marker === '(ср.)'))
    assert.ok(notes.some((n) => n.marker === '(уст.)'))
  })
})
