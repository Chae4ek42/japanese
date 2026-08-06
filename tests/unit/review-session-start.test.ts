import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  masteryOutcomeFromRound,
  startReviewPracticeSession,
} from '../../src/features/vocab/reviewSession.ts'
import {
  DEFAULT_VOCAB_PREFERENCES,
  sanitizeVocabState,
} from '../../src/shared/state/slices/vocab.ts'
import { createDefaultAppState } from '../../src/shared/state/app-state.ts'
import type { VocabCard } from '../../src/shared/lib/types'

function card(id: string): VocabCard {
  return {
    id,
    writing: id,
    kana: id,
    romaji: id,
    answers: [id],
    meaning: id,
    meanings: [id],
  }
}

describe('masteryOutcomeFromRound', () => {
  it('считает медленный/обычный успех как correct, не hint', () => {
    assert.equal(masteryOutcomeFromRound({ wrong: false }), 'correct')
    assert.equal(
      masteryOutcomeFromRound({ wrong: false, hintUsed: false, wrongRecorded: false }),
      'correct',
    )
  })

  it('пишет wrong для провала и восстановления после ошибки', () => {
    assert.equal(masteryOutcomeFromRound({ wrong: true }), 'wrong')
    assert.equal(masteryOutcomeFromRound({ wrong: false, dontKnow: true }), 'wrong')
    assert.equal(masteryOutcomeFromRound({ wrong: false, wrongRecorded: true }), 'wrong')
  })

  it('пишет hint только после подсказки без ошибки', () => {
    assert.equal(masteryOutcomeFromRound({ wrong: false, hintUsed: true }), 'hint')
  })
})

describe('startReviewPracticeSession', () => {
  it('в обычном режиме держит весь scope, не урезая до квоты новых', () => {
    const scope = Array.from({ length: 12 }, (_, i) => card(`w${i}`))
    const { session, planEmpty, newCount } = startReviewPracticeSession({
      scope,
      preferences: {
        ...DEFAULT_VOCAB_PREFERENCES,
        sessionMode: 'drill',
        pickMode: 'adaptive',
        sessionMinutes: 15,
      },
      memory: {},
      stats: {},
      newUsedToday: 40,
      spacedRepetition: false,
    })

    assert.equal(planEmpty, false)
    assert.equal(session.poolIds.length, 12)
    assert.equal(newCount, 12)
  })

  it('в SRS режет сессию до due + newPerDay, старые добавления раньше', () => {
    const now = Date.parse('2026-08-06T12:00:00Z')
    const scope = Array.from({ length: 8 }, (_, i) => card(`w${i}`))
    const myWordAddedAt: Record<string, number> = {}
    for (let i = 0; i < 8; i += 1) {
      myWordAddedAt[`w${i}`] = now - (8 - i) * 86_400_000
    }

    const { session, planEmpty, dueCount, newCount } = startReviewPracticeSession({
      scope,
      preferences: {
        ...DEFAULT_VOCAB_PREFERENCES,
        sessionMode: 'srs',
        source: 'mine',
        pickMode: 'adaptive',
        newPerDay: 3,
        sessionMinutes: 15,
      },
      memory: {},
      stats: {},
      newUsedToday: 0,
      myWordAddedAt,
      spacedRepetition: true,
      now,
    })

    assert.equal(planEmpty, false)
    assert.equal(dueCount, 0)
    assert.equal(newCount, 3)
    assert.equal(session.poolIds.length, 3)
    assert.deepEqual(session.poolIds, ['w0', 'w1', 'w2'])
  })

  it('в SRS учитывает уже введённые сегодня новые', () => {
    const scope = Array.from({ length: 5 }, (_, i) => card(`w${i}`))
    const { session, newCount } = startReviewPracticeSession({
      scope,
      preferences: {
        ...DEFAULT_VOCAB_PREFERENCES,
        sessionMode: 'srs',
        source: 'mine',
        newPerDay: 2,
        sessionMinutes: 15,
      },
      memory: {},
      stats: {},
      newUsedToday: 2,
      myWordAddedAt: Object.fromEntries(scope.map((c, i) => [c.id, i])),
      spacedRepetition: true,
    })

    assert.equal(newCount, 0)
    assert.equal(session.poolIds.length, 0)
  })

  it('mine в drill не включает spacedRepetition — полный набор', () => {
    const scope = Array.from({ length: 6 }, (_, i) => card(`w${i}`))
    const { session, newCount } = startReviewPracticeSession({
      scope,
      preferences: {
        ...DEFAULT_VOCAB_PREFERENCES,
        sessionMode: 'drill',
        source: 'mine',
        newPerDay: 2,
      },
      memory: {},
      stats: {},
      newUsedToday: 0,
      spacedRepetition: false,
    })
    assert.equal(session.poolIds.length, 6)
    assert.equal(newCount, 6)
  })
})

describe('sanitizeVocabPreferences sessionMode', () => {
  it('по умолчанию drill', () => {
    const state = sanitizeVocabState({}, createDefaultAppState().vocab)
    assert.equal(state.preferences.sessionMode, 'drill')
  })

  it('legacy mine+v2 без sessionMode → srs и source mine', () => {
    const raw = {
      preferences: {
        drillMode: 'romaji',
        source: 'mine',
        level: 5,
        groupId: 'family',
        pickMode: 'adaptive',
        inputMode: 'instant',
        wordJlptLevels: [],
        newWordLimit: -1,
        trainFullGroup: false,
        mineIncludeLearned: true,
        selectedKanji: [],
        targetRetention: 0.9,
        newPerDay: 10,
        sessionMinutes: 15,
        reviewV2: true,
      },
    }
    const migrated = sanitizeVocabState(raw, createDefaultAppState().vocab)
    assert.equal(migrated.preferences.sessionMode, 'srs')
    assert.equal(migrated.preferences.source, 'mine')
  })

  it('srs принудительно держит source=mine', () => {
    const state = sanitizeVocabState(
      {
        preferences: {
          ...DEFAULT_VOCAB_PREFERENCES,
          sessionMode: 'srs',
          source: 'level',
        },
      },
      createDefaultAppState().vocab,
    )
    assert.equal(state.preferences.sessionMode, 'srs')
    assert.equal(state.preferences.source, 'mine')
  })
})
