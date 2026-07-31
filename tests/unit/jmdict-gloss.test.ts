import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cleanQuizGloss,
  collectGlossFootnotes,
  normalizeQuizGlossKey,
  pickQuizMeaning,
} from '../../src/shared/lib/jmdict-gloss'

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

describe('cleanQuizGloss', () => {
  it('отбрасывает отсылки (см.)', () => {
    assert.equal(cleanQuizGloss('(см.) こちら'), null)
    assert.equal(cleanQuizGloss('(см.) みえる 4'), null)
  })

  it('убирает нумерацию и краткие пометы', () => {
    assert.equal(cleanQuizGloss('1) сам'), 'сам')
    assert.equal(cleanQuizGloss('(прост.) я'), 'я')
    assert.equal(cleanQuizGloss('2) (прост.) он, она'), 'он, она')
  })

  it('убирает {～…} и ведущее :', () => {
    assert.equal(cleanQuizGloss(': {～に} среди бела дня'), 'среди бела дня')
    assert.equal(cleanQuizGloss('{～へ} сюда'), 'сюда')
    assert.equal(cleanQuizGloss(': {～に} (уст.) там'), 'там')
  })

  it('отбрасывает голые конструкции и остаточный ～', () => {
    assert.equal(cleanQuizGloss('{～に}'), null)
    assert.equal(cleanQuizGloss('делать ～ вместе'), null)
  })

  it('укорачивает длинные пояснения в скобках', () => {
    const long =
      'вы (обращение между посторонними, женщинами-подругами и жены к мужу)'
    assert.equal(cleanQuizGloss(long), 'вы')
  })

  it('выбирает первое пригодное значение', () => {
    assert.equal(pickQuizMeaning(['(см.) こちら', '1) здесь; эта сторона']), 'здесь; эта сторона')
    assert.equal(pickQuizMeaning(['(эпист.)', '1) Вы', '2) с Вашей стороны']), 'Вы')
    assert.equal(pickQuizMeaning(['(см.) あせби']), null)
  })

  it('нормализует ключ для дедупа', () => {
    assert.equal(normalizeQuizGlossKey('Вы'), normalizeQuizGlossKey('вы'))
  })
})
