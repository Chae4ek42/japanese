import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALL_CARD_IDS,
  GROUP_IDS,
  GROUP_PRESETS,
  KANA_STATS_CARDS,
  buildPool,
  getCardById,
  getConfusableIds,
} from '../../src/data/kana'

describe('данные каны', () => {
  it('карточки уникальны и находятся по id', () => {
    assert.equal(new Set(ALL_CARD_IDS).size, ALL_CARD_IDS.length)
    for (const id of ALL_CARD_IDS) {
      assert.ok(getCardById(id))
    }
  })

  it('пресеты ссылаются на существующие группы', () => {
    for (const preset of GROUP_PRESETS) {
      for (const groupId of preset.groups) {
        assert.ok(GROUP_IDS.includes(groupId), `${groupId} из пресета ${preset.id}`)
      }
    }
  })

  it('buildPool фильтрует по азбуке и группам', () => {
    const pool = buildPool('hiragana', ['vowels'])
    assert.equal(pool.length, 5)
    assert.ok(pool.every((card) => card.script === 'hiragana'))

    const both = buildPool('both', ['vowels'])
    assert.equal(both.length, 10)

    assert.deepEqual(buildPool('hiragana', []), [])
  })
})

describe('карта путаниц', () => {
  it('связи симметричны', () => {
    for (const card of KANA_STATS_CARDS) {
      for (const otherId of getConfusableIds(card.id)) {
        assert.ok(
          getConfusableIds(otherId).includes(card.id),
          `${card.id} -> ${otherId} должно быть двунаправленным`,
        )
      }
    }
  })

  it('двойники не выходят за пределы своей азбуки', () => {
    for (const card of KANA_STATS_CARDS) {
      for (const otherId of getConfusableIds(card.id)) {
        assert.equal(otherId.split(':')[0], card.script)
      }
    }
  })

  it('классические пары присутствуют', () => {
    assert.ok(getConfusableIds('katakana:shi').includes('katakana:tsu'))
    assert.ok(getConfusableIds('katakana:so').includes('katakana:n'))
    assert.ok(getConfusableIds('hiragana:nu').includes('hiragana:me'))
    assert.ok(getConfusableIds('hiragana:wa').includes('hiragana:ne'))
  })

  it('все id в карте путаниц существуют', () => {
    const known = new Set(ALL_CARD_IDS)
    for (const card of KANA_STATS_CARDS) {
      for (const otherId of getConfusableIds(card.id)) {
        assert.ok(known.has(otherId), `${otherId} не существует`)
      }
    }
  })
})
