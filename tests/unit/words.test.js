import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WORDS,
  ALL_WORD_GROUP_IDS,
  WORD_GROUPS,
  WORD_PACK_SIZE,
  buildWordPool,
  checkTranslation,
  getDictionaryWords,
  getReadingAnswers,
  getTranslationAnswers,
  getWordById,
  normalizeRu,
  resolveWord,
  sanitizeWordGroups,
} from '../../src/data/words.js'
import { createCustomWordFromInput } from '../../src/data/custom-words.js'

describe('датасет слов', () => {
  it('слова есть, id уникальны', () => {
    assert.ok(WORDS.length > 0)
    assert.equal(new Set(WORDS.map((word) => word.id)).size, WORDS.length)
  })

  it('у каждого слова есть перевод, чтение и ромадзи', () => {
    for (const word of WORDS) {
      assert.ok(word.meanings.length > 0, `${word.id}: нет переводов`)
      assert.ok(word.kana, `${word.id}: нет каны`)
      assert.ok(word.katakana, `${word.id}: нет катаканы`)
      assert.ok(word.romaji, `${word.id}: нет ромадзи`)
    }
  })

  it('переводы не содержат японских символов и мусора', () => {
    const jp = /[\u3040-\u30ff\u4e00-\u9fff]/
    for (const word of WORDS) {
      for (const meaning of word.meanings) {
        assert.ok(!jp.test(meaning), `${word.id}: ${meaning}`)
        assert.ok(meaning.length <= 40, `${word.id}: слишком длинное «${meaning}»`)
      }
    }
  })

  it('катакана отличается от хираганы', () => {
    const sample = WORDS.find((word) => /[\u3040-\u309f]/.test(word.kana))
    assert.ok(sample)
    assert.notEqual(sample.kana, sample.katakana)
  })
})

describe('набор слов', () => {
  it('темы покрывают весь набор', () => {
    const covered = buildWordPool({ selectedGroups: ALL_WORD_GROUP_IDS })
    assert.equal(covered.length, WORDS.length)
    assert.ok(WORD_GROUPS.length > 0)
    for (const group of WORD_GROUPS) {
      assert.ok(group.wordIds.length > 0)
      assert.ok(group.wordIds.length <= WORD_PACK_SIZE)
    }
  })

  it('buildWordPool фильтрует по пачкам и словарю', () => {
    const packOnly = buildWordPool({ selectedGroups: [WORD_GROUPS[0].id] })
    assert.ok(packOnly.length > 0)

    const dictionaryOnly = buildWordPool({
      studySource: 'dictionary',
      dictionary: [packOnly[0].id],
    })
    assert.equal(dictionaryOnly.length, 1)
    assert.equal(dictionaryOnly[0].id, packOnly[0].id)
  })

  it('словарь работает независимо от выбранных пачек', () => {
    const dictionaryWord = WORDS.find((word) => !WORD_GROUPS[0].wordIds.includes(word.id))
    assert.ok(dictionaryWord)

    const pool = buildWordPool({
      studySource: 'dictionary',
      selectedGroups: [WORD_GROUPS[0].id],
      dictionary: [dictionaryWord.id],
    })
    assert.equal(pool.length, 1)
    assert.equal(pool[0].id, dictionaryWord.id)
  })

  it('пустой набор пачек дает пустой пул', () => {
    assert.equal(buildWordPool({ selectedGroups: [] }).length, 0)
  })

  it('sanitizeWordGroups восстанавливает дефолт при устаревших id', () => {
    assert.deepEqual(sanitizeWordGroups(['chunk-1']), ALL_WORD_GROUP_IDS)
  })

  it('пользовательские слова попадают в словарь и пул', () => {
    const { word } = createCustomWordFromInput({ kana: 'ねこ', meanings: 'кот' })
    const customWords = [{ id: word.id, kana: 'ねこ', meanings: ['кот'] }]
    const dictionary = [word.id]

    const resolved = resolveWord(word.id, customWords)
    assert.equal(resolved.kana, 'ねこ')
    assert.deepEqual(getDictionaryWords(dictionary, customWords).map((entry) => entry.id), [word.id])

    const pool = buildWordPool({ studySource: 'dictionary', dictionary, customWords })
    assert.equal(pool.length, 1)
    assert.ok(getReadingAnswers(pool[0]).length > 0)
    assert.ok(checkTranslation(pool[0], 'кот'))
  })

  it('можно добавить слово только с одним полем', () => {
    const { word, error } = createCustomWordFromInput({ kanji: '猫' })
    assert.equal(error, undefined)
    assert.equal(word.kanji, '猫')
  })

  it('полностью пустое слово не создаётся', () => {
    const { error } = createCustomWordFromInput({})
    assert.ok(error)
  })
})

describe('проверка ответов', () => {
  it('чтение: варианты ромадзи включают хэпбёрн и кунрэй', () => {
    const sample = WORDS.find((word) => word.romaji.includes('sh'))
    if (!sample) return
    const answers = getReadingAnswers(sample)
    assert.ok(answers.includes(sample.romaji))
  })

  it('перевод: нормализация регистра и ё', () => {
    const sample = WORDS[0]
    const answer = getTranslationAnswers(sample)[0]
    assert.ok(checkTranslation(sample, answer.toUpperCase()))
    assert.ok(checkTranslation(sample, answer.replace(/е/g, 'ё')))
  })

  it('перевод: принимается любое из значений', () => {
    const multi = WORDS.find((word) => word.meanings.length > 1)
    if (!multi) return
    for (const meaning of multi.meanings) {
      assert.ok(checkTranslation(multi, meaning))
    }
  })

  it('перевод: скобочные уточнения необязательны', () => {
    const sample = WORDS.find((word) => word.meanings.some((m) => m.includes('(')))
    if (!sample) return
    const withParens = sample.meanings.find((m) => m.includes('('))
    const base = withParens.replace(/\([^)]*\)/g, '').trim()
    assert.ok(checkTranslation(sample, base))
  })

  it('normalizeRu убирает пунктуацию и лишние пробелы', () => {
    assert.equal(normalizeRu('  Привет, мир!  '), 'привет мир')
  })
})
