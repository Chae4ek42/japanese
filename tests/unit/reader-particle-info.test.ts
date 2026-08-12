import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lookupParticleInfo } from '../../src/features/reader/particle-info.ts'

describe('reader particle info', () => {
  it('отдаёт значение и примеры для に', () => {
    const info = lookupParticleInfo('に')
    assert.ok(info)
    assert.equal(info!.surface, 'に')
    assert.ok(info!.shortLabel.includes('ni'))
    assert.ok(info!.lead.length > 0)
    assert.ok(info!.examples.length >= 3)
    assert.ok(info!.topic?.id === 'ni')
  })

  it('для неизвестной частицы возвращает null', () => {
    assert.equal(lookupParticleInfo('ばかり'), null)
  })
})
