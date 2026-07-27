import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ContextSentence } from '../../src/shared/lib/types'
import {
  addWordToBatch,
  appendSentencePage,
  canGoPrev,
  createEmptySession,
  createTrainingLogEntry,
  goNextInHistory,
  goPrevPage,
  pickRandomUnknownGrammar,
  recordWordsLearned,
  sentenceStillHasBatchUnknowns,
  togglePageRevealed,
  withBatchIds,
} from '../../src/features/context/session'
import { sanitizeContextSession, sanitizeTrainingLog } from '../../src/shared/state/slices/context'

function sentence(id: string, wordIds: string[] = ['a']): ContextSentence {
  return {
    id,
    text: `文${id}`,
    glossRu: `gloss ${id}`,
    wordIds,
    grammarIds: ['particle_wa'],
    source: 'seed',
  }
}

describe('context session helpers', () => {
  it('appends pages without truncating history when navigating back', () => {
    let session = createEmptySession('family', ['w1', 'w2'], 1000)
    session = appendSentencePage(session, sentence('s1'))
    session = appendSentencePage(session, sentence('s2'))
    session = goPrevPage(session)
    assert.equal(session.pageIndex, 0)
    assert.equal(canGoPrev(session), false)
    session = appendSentencePage(session, sentence('s3'))
    assert.equal(session.pages.length, 3)
    assert.equal(session.pages.map((page) => page.sentence.id).join(','), 's1,s2,s3')
    assert.equal(session.pageIndex, 2)
  })

  it('preserves revealed flag when toggling and moving in history', () => {
    let session = createEmptySession('family', ['w1'], 1000)
    session = appendSentencePage(session, sentence('s1'))
    session = appendSentencePage(session, sentence('s2'))
    session = togglePageRevealed(session)
    assert.equal(session.pages[1]?.revealed, true)
    session = goPrevPage(session)
    assert.equal(session.pages[1]?.revealed, true)
    assert.equal(session.pages[0]?.revealed, false)
    session = goNextInHistory(session)
    assert.equal(session.pages[1]?.revealed, true)
  })

  it('detects remaining batch unknowns for multi-word stay-on-page', () => {
    const s = sentence('m', ['a', 'b', 'c'])
    assert.equal(sentenceStillHasBatchUnknowns(s, ['a', 'b'], ['a']), true)
    assert.equal(sentenceStillHasBatchUnknowns(s, ['a', 'b'], ['a', 'b']), false)
    assert.equal(sentenceStillHasBatchUnknowns(s, ['a'], ['a']), false)
  })

  it('adds word to batch and replaces when full', () => {
    assert.deepEqual(addWordToBatch(['a', 'b'], 'c', { maxSize: 5 }), ['a', 'b', 'c'])
    const replaced = addWordToBatch(['a', 'b', 'c'], 'd', { maxSize: 3, protectIds: ['a', 'b'] })
    assert.equal(replaced.includes('d'), true)
    assert.equal(replaced.includes('a'), true)
    assert.equal(replaced.includes('b'), true)
    assert.equal(replaced.includes('c'), false)
  })

  it('picks unknown grammar from catalog', () => {
    const catalog = [
      { id: 'g1', labelRu: 'one', cue: '1' },
      { id: 'g2', labelRu: 'two', cue: '2' },
    ]
    const picked = pickRandomUnknownGrammar(catalog, ['g1'])
    assert.equal(picked?.id, 'g2')
    assert.equal(pickRandomUnknownGrammar(catalog, ['g1', 'g2']), null)
  })

  it('records learned words and builds training log entry', () => {
    let session = createEmptySession('family', ['w1'], 42)
    session = appendSentencePage(session, sentence('s1'))
    session = recordWordsLearned(withBatchIds(session, []), ['w1'])
    const entry = createTrainingLogEntry(session, 'completed', 99)
    assert.equal(entry.id, 'ctx-42')
    assert.deepEqual(entry.wordsLearnedIds, ['w1'])
    assert.equal(entry.sentencesSeen, 1)
    assert.equal(entry.outcome, 'completed')
    assert.equal(entry.endedAt, 99)
  })
})

describe('context session sanitize', () => {
  it('sanitizes session and training log', () => {
    const session = sanitizeContextSession({
      groupId: 'family',
      batchIds: ['a', 'a', ''],
      pages: [
        { sentence: sentence('s1'), revealed: true },
        { sentence: { id: 'bad', text: '', glossRu: '' }, revealed: false },
      ],
      pageIndex: 99,
      recentSentenceIds: ['s1'],
      wordsLearnedIds: ['a'],
      startedAt: 1,
      status: 'active',
    })
    assert.ok(session)
    assert.deepEqual(session?.batchIds, ['a'])
    assert.equal(session?.pages.length, 1)
    assert.equal(session?.pageIndex, 0)
    assert.equal(session?.pages[0]?.revealed, true)

    const log = sanitizeTrainingLog([
      {
        id: 'ctx-1',
        groupId: 'family',
        startedAt: 1,
        wordsLearnedIds: ['a'],
        sentencesSeen: 2,
        outcome: 'completed',
      },
      { id: '', groupId: 'x' },
    ])
    assert.equal(log.length, 1)
    assert.equal(log[0]?.outcome, 'completed')
  })
})
