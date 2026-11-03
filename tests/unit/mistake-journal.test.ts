import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectMistakes } from '../../src/features/mistakes/journal.ts'
import { createDefaultAppState } from '../../src/shared/state/app-state.ts'
import { createStatsRecord } from '../../src/shared/lib/trainer.ts'

const word = (id: string) => ({ id, writing: '猫', kana: 'ねこ', romaji: 'neko', meanings: ['кошка'], kanji: [] })

describe('word difficulties journal', () => {
  it('shows only resolvable words with sufficient recent failure evidence', () => {
    const state = createDefaultAppState()
    for (const id of ['custom:hard', 'custom:recovered', 'custom:new', 'custom:hidden']) state.vocab.customWords[id] = word(id)
    const wrong = { ...createStatsRecord(), errors: 50, recentAnswers: Array(10).fill('wrong') }
    state.vocab.stats['custom:hard'] = wrong
    state.vocab.stats['custom:hidden'] = wrong
    state.vocab.stats['unresolved'] = wrong
    state.vocab.stats['custom:recovered'] = { ...wrong, recentAnswers: [...Array(5).fill('wrong'), ...Array(10).fill('correct')] }
    state.vocab.stats['custom:new'] = { ...wrong, recentAnswers: ['wrong'] }
    state.vocab.hiddenWordIds = ['custom:hidden']
    state.kana.stats['hiragana:a'] = wrong
    const entries = collectMistakes(state)
    assert.deepEqual(entries.map((entry) => entry.id), ['custom:hard'])
    assert.equal(entries[0].kana, 'ねこ')
    assert.equal(entries[0].meaning, 'кошка')
  })
})
