import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { choiceItemClass, pickShuffledOptions } from '../../src/shared/lib/choiceDrill.ts'
import { splitCloze } from '../../src/shared/lib/cloze.ts'

describe('choice drill helpers', () => {
  it('классы кнопок: верно / неверно / показать ответ', () => {
    assert.equal(choiceItemClass('pad', 'は', null, 'が'), 'pad')
    assert.equal(
      choiceItemClass('pad', 'は', { pick: 'は', correct: true }, 'は'),
      'pad is-correct',
    )
    assert.equal(
      choiceItemClass('pad', 'は', { pick: 'は', correct: false }, 'が'),
      'pad is-wrong',
    )
    assert.equal(
      choiceItemClass('pad', 'が', { pick: 'は', correct: false }, 'が'),
      'pad is-reveal',
    )
  })

  it('набор вариантов всегда содержит ответ', () => {
    const options = pickShuffledOptions(
      'て',
      ['て', 'た', 'ない', 'ます', 'て'],
      4,
      (item) => item,
      () => 0.2,
    )
    assert.ok(options.includes('て'))
    assert.equal(new Set(options).size, options.length)
    assert.ok(options.length <= 4)
  })

  it('клоз режет промпт по ___', () => {
    assert.deepEqual(splitCloze('私___学生です'), { before: '私', after: '学生です' })
    assert.deepEqual(splitCloze('空白 нет'), { before: '空白 нет', after: '' })
  })
})
