import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getCheatSheetTopic,
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

  it('частицы: клик по に открывает тему с примерами', () => {
    const core = PARTICLES_CHEAT_SHEET.sections.find((section) => section.id === 'core')
    assert.equal(core?.topicByCell?.['に'], 'ni')
    const ni = getCheatSheetTopic(PARTICLES_CHEAT_SHEET.topics, 'ni')
    assert.ok(ni)
    assert.equal(ni!.badge, 'に')
    assert.ok(ni!.senses.length >= 4)
    const examples = ni!.senses.flatMap((sense) => sense.examples)
    assert.ok(examples.length >= 8)
    assert.ok(examples.every((example) => example.jp && example.gloss))
    assert.ok(examples.some((example) => example.jp.includes('学校に')))
  })

  it('глаголы: группы, て-форма и сводная таблица', () => {
    assert.ok(VERB_FORMS_CHEAT_SHEET.sections.length >= 6)
    assert.ok(VERB_FORMS_CHEAT_SHEET.sections.some((section) => section.id === 'groups'))
    assert.ok(VERB_FORMS_CHEAT_SHEET.sections.some((section) => section.id === 'te-godan'))
    const table = VERB_FORMS_CHEAT_SHEET.sections.find((section) => section.id === 'table')
    assert.ok(table?.rows?.some((row) => row[0] === 'て'))
    assert.ok(table?.rows?.some((row) => row.includes('書きます')))
  })

  it('глаголы: темы форм с примерами', () => {
    const uses = VERB_FORMS_CHEAT_SHEET.sections.find((section) => section.id === 'uses')
    assert.equal(uses?.topicByCell?.['て-форма'], 'te')
    const te = getCheatSheetTopic(VERB_FORMS_CHEAT_SHEET.topics, 'te')
    assert.ok(te)
    assert.ok(te!.senses.some((sense) => sense.examples.some((ex) => /ください/.test(ex.jp))))
  })
})
