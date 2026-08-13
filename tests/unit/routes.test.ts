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
    assert.deepEqual(parsePath('/particles'), { page: 'particles' })
    assert.deepEqual(parsePath('/verbs'), { page: 'verbs' })
    assert.deepEqual(parsePath('/reader'), { page: 'reader' })
  })

  it('неизвестный путь отдаёт home при парсинге', () => {
    assert.deepEqual(parsePath('/nope'), { page: 'home' })
    assert.equal(isKnownPath('/nope'), false)
    assert.equal(isKnownPath('/kana'), true)
    assert.equal(isKnownPath('/train'), true)
    assert.equal(isKnownPath('/mine'), true)
    assert.equal(isKnownPath('/theory'), true)
    assert.equal(isKnownPath('/accounts'), true)
    assert.equal(isKnownPath('/particles'), true)
    assert.equal(isKnownPath('/verbs'), true)
    assert.equal(isKnownPath('/reader'), true)
  })

  it('строит пути из маршрута и страницы', () => {
    assert.equal(pathForRoute({ page: 'numbers' }), '/numbers')
    assert.equal(pathForRoute({ page: 'particles' }), '/particles')
    assert.equal(pathForRoute({ page: 'verbs' }), '/verbs')
    assert.equal(pathForRoute({ page: 'reader' }), '/reader')
    assert.equal(pathForRoute({ page: 'train' }), '/train')
    assert.equal(pathForRoute({ page: 'mine' }), '/mine')
    assert.equal(pathForRoute({ page: 'theory' }), '/theory')
    assert.equal(pathForRoute({ page: 'accounts' }), '/accounts')
    assert.equal(pathForPage('train'), '/train')
    assert.equal(pathForPage('home'), '/')
    assert.equal(pathForPage('mine'), '/mine')
    assert.equal(pathForPage('theory'), '/theory')
    assert.equal(pathForPage('accounts'), '/accounts')
    assert.equal(pathForPage('particles'), '/particles')
    assert.equal(pathForPage('verbs'), '/verbs')
    assert.equal(pathForPage('reader'), '/reader')
  })

  it('реестр страниц покрывает все пути навбара', async () => {
    const { PAGE_META, navItems, homeEntries } = await import('../../src/shared/lib/pages.ts')
    assert.equal(navItems('primary').length > 0, true)
    assert.equal(navItems('primary').some((page) => page.id === 'vocab'), true)
    assert.equal(navItems('primary').some((page) => page.id === 'mine'), true)
    assert.equal(navItems('primary').some((page) => page.id === 'theory'), true)
    assert.equal(navItems('primary').some((page) => page.id === 'analytics'), true)
    assert.equal(homeEntries('practice').some((page) => page.home.testId === 'open-kana'), true)
    assert.equal(homeEntries('practice').some((page) => page.id === 'verbs'), true)
    assert.equal(navItems('primary').some((page) => page.id === 'verbs'), true)
    assert.equal(
      PAGE_META.every((page) => pathForPage(page.id) === page.path),
      true,
    )
  })

  it('shouldHandleClientNav пропускает модификаторы', () => {
    assert.equal(shouldHandleClientNav({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }), true)
    assert.equal(shouldHandleClientNav({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }), false)
    assert.equal(shouldHandleClientNav({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }), false)
  })
})
