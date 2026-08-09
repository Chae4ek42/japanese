import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { THEORY_UNITS, getTheoryUnit } from '../../src/features/theory/units'
import { getVocabGroup } from '../../src/features/vocab/groups'

describe('theory units', () => {
  it('содержит урок по こ・そ・あ・ど с сеткой', () => {
    const unit = getTheoryUnit('ko-so-a-do')
    assert.ok(unit)
    assert.equal(unit!.readingGroupId, 'reading-demo')
    const table = unit!.sections.find((section) => section.table)?.table
    assert.ok(table)
    assert.ok(table!.rows.some((row) => row.includes('これ') && row.includes('ここ')))
    assert.ok(table!.rows.some((row) => row.includes('あちら') || row.join(' ').includes('あちら')))
  })

  it('все юниты ссылаются на существующие reading-группы', () => {
    assert.ok(THEORY_UNITS.length >= 8)
    for (const unit of THEORY_UNITS) {
      assert.ok(unit.sections.length > 0, unit.id)
      if (!unit.readingGroupId) continue
      const group = getVocabGroup(unit.readingGroupId)
      assert.ok(group, `${unit.id} → ${unit.readingGroupId}`)
      assert.equal(group!.kind ?? 'reading', 'reading')
    }
  })

  it('в юнитах есть встроенные примеры слов', () => {
    const withExamples = THEORY_UNITS.filter((unit) =>
      unit.sections.some((section) => (section.examples?.length ?? 0) > 0),
    )
    assert.ok(withExamples.length >= 6)
  })
})
