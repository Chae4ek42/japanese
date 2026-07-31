import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyLocalWordEdits,
  buildCustomWord,
  buildWordFromReadings,
  createReadingDraft,
  extractKanjiChars,
  isCustomWordId,
  parseMeaningsInput,
  resolveMyWords,
} from '../../src/features/vocab/customWords.ts'
import { buildVocabPool } from '../../src/features/vocab/pool.ts'
import { DEFAULT_VOCAB_PREFERENCES } from '../../src/shared/state/app-state.ts'

describe('custom words', () => {
  it('парсит значения и кандзи', () => {
    assert.deepEqual(parseMeaningsInput('японский, японский язык; язык'), [
      'японский',
      'японский язык',
      'язык',
    ])
    assert.deepEqual(extractKanjiChars('日本語'), ['日', '本', '語'])
    assert.deepEqual(extractKanjiChars('あいう'), [])
  })

  it('собирает своё слово', () => {
    const word = buildCustomWord({
      writing: '猫',
      kana: 'ねこ',
      romaji: 'neko',
      meanings: 'кошка, кот',
    })
    assert.ok(word)
    assert.ok(isCustomWordId(word.id))
    assert.equal(word.writing, '猫')
    assert.equal(word.kana, 'ねこ')
    assert.equal(word.romaji, 'neko')
    assert.deepEqual(word.meanings, ['кошка', 'кот'])
    assert.deepEqual(word.kanji, ['猫'])
  })

  it('отклоняет неполные поля', () => {
    assert.equal(
      buildCustomWord({ writing: '猫', kana: '', romaji: 'neko', meanings: 'кошка' }),
      null,
    )
  })

  it('сохраняет id при редактировании', () => {
    const word = buildCustomWord({
      id: 'custom:fixed-id',
      writing: '犬',
      kana: 'いぬ',
      romaji: 'inu',
      meanings: 'собака',
    })
    assert.ok(word)
    assert.equal(word.id, 'custom:fixed-id')
    assert.equal(word.writing, '犬')
  })

  it('сохраняет bank id при правке словарного слова', () => {
    const word = buildCustomWord({
      id: '1311110',
      writing: '私',
      kana: 'わたし',
      romaji: 'watashi',
      meanings: 'я',
    })
    assert.ok(word)
    assert.equal(word.id, '1311110')
  })

  it('собирает слово с несколькими чтениями', () => {
    const word = buildWordFromReadings({
      id: '1311110',
      writing: '私',
      readings: [
        createReadingDraft({ id: 'a', kana: 'わたし', romaji: 'watashi', meanings: ['я'] }),
        createReadingDraft({ id: 'b', kana: 'わたくし', romaji: 'watakushi', meanings: ['я (вежл.)'] }),
      ],
    })
    assert.ok(word)
    assert.equal(word.readings?.length, 2)
    assert.equal(word.kana, 'わたし / わたくし')
    assert.deepEqual(word.meanings, ['я', 'я (вежл.)'])
  })

  it('применяет правку с несколькими чтениями без схлопывания', () => {
    const base = {
      id: '1311110',
      writing: '私',
      kana: 'わたし / わたくし',
      romaji: 'watashi / watakushi',
      meanings: ['я'],
      kanji: ['私'],
      readings: [
        { id: 'a', kana: 'わたし', romaji: 'watashi', meanings: ['я'] },
        { id: 'b', kana: 'わたくし', romaji: 'watakushi', meanings: ['я (вежл.)'] },
      ],
      variantIds: ['a', 'b'],
    }
    const override = buildWordFromReadings({
      id: '1311110',
      writing: '私',
      readings: [
        createReadingDraft({ id: 'a', kana: 'わたし', romaji: 'watashi', meanings: ['я', 'меня'] }),
        createReadingDraft({ id: 'b', kana: 'わたくし', romaji: 'watakushi', meanings: ['я (форм.)'] }),
      ],
      variantIds: ['a', 'b'],
    })
    assert.ok(override)
    const [edited] = applyLocalWordEdits([base], { '1311110': override })
    assert.ok(edited)
    assert.equal(edited.readings?.length, 2)
    assert.deepEqual(edited.readings?.[0]?.meanings, ['я', 'меня'])
    assert.deepEqual(edited.readings?.[1]?.meanings, ['я (форм.)'])
  })

  it('резолвит свои слова в пуле mine', () => {
    const custom = buildCustomWord({
      writing: '犬',
      kana: 'いぬ',
      romaji: 'inu',
      meanings: 'собака',
    })
    assert.ok(custom?.id)
    const resolved = resolveMyWords([custom.id], { [custom.id]: custom })
    assert.equal(resolved.length, 1)
    assert.equal(resolved[0].writing, '犬')

    const pool = buildVocabPool(
      { ...DEFAULT_VOCAB_PREFERENCES, source: 'mine' },
      [custom.id],
      { [custom.id]: custom },
    )
    assert.equal(pool.length, 1)
    assert.equal(pool[0].answers[0], 'inu')
  })
})
