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
    assert.equal(normalizePath('/train/'), '/train')
    assert.equal(normalizePath('/vocab/train/'), '/vocab/train')
    assert.equal(normalizePath('/mine/'), '/mine')
  })

  it('парсит известные пути', () => {
    assert.deepEqual(parsePath('/'), { page: 'home' })
    assert.deepEqual(parsePath('/kana'), { page: 'kana' })
    assert.deepEqual(parsePath('/vocab'), { page: 'vocab' })
    assert.deepEqual(parsePath('/train'), { page: 'train' })
    assert.deepEqual(parsePath('/vocab/train'), { page: 'train' })
    assert.deepEqual(parsePath('/mine'), { page: 'mine' })
    assert.deepEqual(parsePath('/vocab/mine'), { page: 'mine' })
    assert.deepEqual(parsePath('/analytics'), { page: 'analytics' })
    assert.deepEqual(parsePath('/theory'), { page: 'theory' })
    assert.deepEqual(parsePath('/accounts'), { page: 'accounts' })
  })

  it('неизвестный путь отдаёт home при парсинге', () => {
    assert.deepEqual(parsePath('/nope'), { page: 'home' })
    assert.equal(isKnownPath('/nope'), false)
    assert.equal(isKnownPath('/kana'), true)
    assert.equal(isKnownPath('/train'), true)
    assert.equal(isKnownPath('/mine'), true)
    assert.equal(isKnownPath('/theory'), true)
    assert.equal(isKnownPath('/accounts'), true)
  })

  it('строит пути из маршрута и страницы', () => {
    assert.equal(pathForRoute({ page: 'numbers' }), '/numbers')
    assert.equal(pathForRoute({ page: 'train' }), '/train')
    assert.equal(pathForRoute({ page: 'mine' }), '/mine')
    assert.equal(pathForRoute({ page: 'theory' }), '/theory')
    assert.equal(pathForRoute({ page: 'accounts' }), '/accounts')
    assert.equal(pathForPage('train'), '/train')
    assert.equal(pathForPage('home'), '/')
    assert.equal(pathForPage('mine'), '/mine')
    assert.equal(pathForPage('theory'), '/theory')
    assert.equal(pathForPage('accounts'), '/accounts')
  })

  it('shouldHandleClientNav пропускает модификаторы', () => {
    assert.equal(shouldHandleClientNav({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }), true)
    assert.equal(shouldHandleClientNav({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }), false)
    assert.equal(shouldHandleClientNav({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }), false)
  })
})
