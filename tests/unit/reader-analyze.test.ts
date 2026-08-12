import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import * as kuromoji from '@patdx/kuromoji'
import NodeDictionaryLoader from '@patdx/kuromoji/node'
import {
  analyzeMorphGroups,
  groupTokensIntoSentences,
  mergeMorphTokens,
} from '../../src/features/reader/analyze.ts'

describe('reader kuromoji analyze', () => {
  it('склеивает спряжения и находит слова банка', async () => {
    const dic_path = path.resolve('node_modules/@patdx/kuromoji/dict')
    const tokenizer = await new kuromoji.TokenizerBuilder({
      loader: new NodeDictionaryLoader({ dic_path }),
    }).build()

    const sample =
      '昨日友達と新しいレストランで美味しい寿司を食べました。雨が降っていたので電車で帰りました。'
    const raw = tokenizer.tokenize(sample)
    const groups = mergeMorphTokens(raw)
    const surfaces = groups.map((group) => group.map((token) => token.surface_form).join(''))

    assert.ok(surfaces.includes('食べました'))
    assert.ok(surfaces.includes('降っていた'))
    assert.ok(surfaces.includes('で'))
    assert.ok(!surfaces.some((surface) => surface === '降っ'))

    const tokens = analyzeMorphGroups(raw)
    const taberu = tokens.find((token) => token.lemma === '食べる')
    assert.ok(taberu)
    assert.equal(taberu!.surface, '食べました')
    assert.ok(taberu!.words.length > 0)
    assert.equal(taberu!.words[0]!.writing, '食べる')

    const de = tokens.filter((token) => token.surface === 'で')
    assert.ok(de.length >= 2)
    assert.ok(de.every((token) => token.kind === 'particle'))

    const furu = tokens.find((token) => token.lemma === '降る')
    assert.ok(furu)
    assert.equal(furu!.surface, '降っていた')

    const sentences = groupTokensIntoSentences(tokens)
    assert.equal(sentences.length, 2)
    assert.ok(sentences[0]!.text.endsWith('。'))
    assert.ok(sentences[1]!.text.includes('電車'))

    assert.equal(taberu!.formLabel.includes('прошедш'), true)
  })

  it('не склеивает です с прилагательным и пишет форму', async () => {
    const dic_path = path.resolve('node_modules/@patdx/kuromoji/dict')
    const tokenizer = await new kuromoji.TokenizerBuilder({
      loader: new NodeDictionaryLoader({ dic_path }),
    }).build()

    const raw = tokenizer.tokenize('楽しいです。美味しかったです。見られる。')
    const tokens = analyzeMorphGroups(raw)
    const surfaces = tokens.map((token) => token.surface)

    assert.ok(surfaces.includes('楽しい'))
    assert.ok(surfaces.includes('です'))
    assert.ok(!surfaces.includes('楽しいです'))
    assert.ok(surfaces.includes('美味しかった'))
    assert.ok(!surfaces.includes('美味しかったです'))
    assert.ok(surfaces.includes('見られる'))

    const tanoshii = tokens.find((token) => token.surface === '楽しい')
    assert.ok(tanoshii)
    assert.equal(tanoshii!.lemma, '楽しい')
    assert.ok(tanoshii!.formLabel.includes('словарная'))

    const oishii = tokens.find((token) => token.surface === '美味しかった')
    assert.ok(oishii)
    assert.equal(oishii!.lemma, '美味しい')
    assert.ok(oishii!.formLabel.includes('прошедш'))

    const mirareru = tokens.find((token) => token.surface === '見られる')
    assert.ok(mirareru)
    assert.equal(mirareru!.lemma, '見る')
  })
})
