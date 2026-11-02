import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LESSON_CHECKS, scoreLessonCheck } from '../../src/features/theory/lessonChecks.ts'
import { THEORY_UNITS } from '../../src/features/theory/units.ts'

test('every theory unit has an authored check with valid options', () => {
  for (const unit of THEORY_UNITS) {
    const questions = LESSON_CHECKS[unit.id]!
    assert.ok(questions.length >= 2, unit.id)
    for (const question of questions) {
      assert.ok(question.options[question.answer])
      assert.ok(question.explanation.length > 0)
    }
    assert.equal(scoreLessonCheck(questions, questions.map((question) => question.answer)), questions.length)
    assert.equal(scoreLessonCheck(questions, []), 0)
    assert.equal(scoreLessonCheck(questions, questions.map((question) => (question.answer + 1) % question.options.length)), 0)
  }
})
