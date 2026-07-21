import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isKnownPath,
  normalizePath,
  parsePath,
  pathForPage,
  pathForRoute,
  shouldHandleClientNav,
} from '../../src/shared/lib/routes.ts'

describe('routes', () => {
  it('нормализует слэши', () => {
    assert.equal(normalizePath('/'), '/')
    assert.equal(normalizePath('/kana/'), '/kana')
    assert.equal(normalizePath('/vocab/train/'), '/vocab/train')
  })

  it('парсит известные пути', () => {
    assert.deepEqual(parsePath('/'), { page: 'home' })
    assert.deepEqual(parsePath('/kana'), { page: 'kana' })
    assert.deepEqual(parsePath('/vocab'), { page: 'vocab', section: 'catalog' })
    assert.deepEqual(parsePath('/vocab/train'), { page: 'vocab', section: 'train' })
    assert.deepEqual(parsePath('/vocab/mine'), { page: 'vocab', section: 'mine' })
  })

  it('неизвестный путь отдаёт home при парсинге', () => {
    assert.deepEqual(parsePath('/nope'), { page: 'home' })
    assert.equal(isKnownPath('/nope'), false)
    assert.equal(isKnownPath('/kana'), true)
  })

  it('строит пути из маршрута и страницы', () => {
    assert.equal(pathForRoute({ page: 'numbers' }), '/numbers')
    assert.equal(pathForRoute({ page: 'vocab', section: 'mine' }), '/vocab/mine')
    assert.equal(pathForPage('vocab', 'train'), '/vocab/train')
    assert.equal(pathForPage('home'), '/')
  })

  it('shouldHandleClientNav пропускает модификаторы', () => {
    assert.equal(shouldHandleClientNav({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }), true)
    assert.equal(shouldHandleClientNav({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }), false)
    assert.equal(shouldHandleClientNav({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }), false)
  })
})
