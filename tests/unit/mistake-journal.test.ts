import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectMistakes, filterMistakes } from '../../src/features/mistakes/journal.ts'
import { createDefaultAppState } from '../../src/shared/state/app-state.ts'
import { createStatsRecord } from '../../src/shared/lib/trainer.ts'
import { KANA_STATS_CARDS } from '../../src/data/kana.ts'
import { buildParticlePool } from '../../src/data/particles.ts'
import { buildVerbPool } from '../../src/data/verbs.ts'
import { allNumberCards } from '../../src/shared/lib/numberCards.ts'

describe('mistake journal evidence', () => {
  it('collects five sections, keeps hints separate and resolves correct answers', () => {
    const state = createDefaultAppState()
    const now = Date.now()
    const sample = { ...createStatsRecord(), errors: 2, clears: 3, lastErrorAt: now, recentAnswers: ['wrong', 'correct'] as const }
    const stats = () => ({ ...sample, recentAnswers: [...sample.recentAnswers] })
    state.kana.stats[KANA_STATS_CARDS[0].id] = stats()
    state.numbers.stats[allNumberCards()[0].id] = stats()
    state.particles.stats[buildParticlePool('all')[0].id] = stats()
    state.verbs.stats[buildVerbPool('all')[0].id] = stats()
    state.vocab.customWords['custom:test'] = { id: 'custom:test', writing: '猫', kana: 'ねこ', romaji: 'neko', meanings: ['кошка'] }
    state.vocab.stats['custom:test'] = { ...createStatsRecord(), hints: 1, lastHintAt: now + 1 }
    const entries = collectMistakes(state)
    assert.equal(entries.length, 5)
    assert.equal(entries[0].section, 'vocab')
    assert.equal(entries[0].stats.errors, 0)
    assert.match(entries[0].answer, /ねこ.*кошка/)
    assert.match(entries[0].detail, /не сохранён/)
    assert.ok(entries.every((entry) => entry.answer && entry.title))
    assert.equal(entries.find((entry) => entry.section === 'kana')?.recentErrors, 1)
  })

  it('retains unknown-date legacy mistakes only in all-time filter and excludes pristine cards', () => {
    const state = createDefaultAppState()
    const [old, current, pristine] = KANA_STATS_CARDS
    const now = Date.now()
    state.kana.stats[old.id] = { ...createStatsRecord(), errors: 1 }
    state.kana.stats[current.id] = { ...createStatsRecord(), errors: 1, lastErrorAt: now - 2 * 86_400_000 }
    state.kana.stats[pristine.id] = createStatsRecord()
    const entries = collectMistakes(state)
    assert.equal(entries.length, 2)
    assert.equal(filterMistakes(entries, 'all', '7', now).length, 1)
    assert.equal(filterMistakes(entries, 'all', 'all', now).length, 2)
    assert.equal(filterMistakes(entries, 'verbs', 'all', now).length, 0)
  })

  it('uses persisted kana confusion counts without assigning fabricated dates', () => {
    const state = createDefaultAppState()
    const [from, to] = KANA_STATS_CARDS
    state.kana.stats[from.id] = { ...createStatsRecord(), errors: 4, lastErrorAt: 123 }
    state.kana.history.confusions[`${from.id}>${to.id}`] = 3
    const [entry] = collectMistakes(state)
    assert.deepEqual(entry.confusion, { cardId: to.id, label: `${to.symbol} (${to.primaryAnswer})`, count: 3 })
    assert.equal(entry.lastDifficultyAt, 123)
  })
})
