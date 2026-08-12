import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PARTICLES_CHEAT_SHEET,
  VERB_FORMS_CHEAT_SHEET,
} from '../../src/data/cheatSheets/index.ts'

describe('cheat sheets', () => {
  it('частицы: есть базовые двенадцать и разделы сравнения', () => {
    assert.ok(PARTICLES_CHEAT_SHEET.sections.length >= 5)
    const core = PARTICLES_CHEAT_SHEET.sections.find((section) => section.id === 'core')
    assert.ok(core?.rows?.some((row) => row[0] === 'は'))
    assert.ok(core?.rows?.some((row) => row[0] === 'や'))
    assert.equal(core?.rows?.length, 12)
    assert.ok(PARTICLES_CHEAT_SHEET.sections.some((section) => section.id === 'ha-ga'))
    assert.ok(PARTICLES_CHEAT_SHEET.sections.some((section) => section.id === 'ni-de-e'))
  })

  it('глаголы: группы, て-форма и сводная таблица', () => {
    assert.ok(VERB_FORMS_CHEAT_SHEET.sections.length >= 6)
    assert.ok(VERB_FORMS_CHEAT_SHEET.sections.some((section) => section.id === 'groups'))
    assert.ok(VERB_FORMS_CHEAT_SHEET.sections.some((section) => section.id === 'te-godan'))
    const table = VERB_FORMS_CHEAT_SHEET.sections.find((section) => section.id === 'table')
    assert.ok(table?.rows?.some((row) => row[0] === 'て'))
    assert.ok(table?.rows?.some((row) => row.includes('書きます')))
  })
})
