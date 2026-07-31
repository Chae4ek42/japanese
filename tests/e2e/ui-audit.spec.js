import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'
import fs from 'node:fs'
import path from 'node:path'

const ROUTES = [
  { name: 'home', open: async (page) => {} },
  { name: 'kana-setup', open: async (page) => page.getByTestId('nav-kana').click() },
  {
    name: 'kana-practice',
    open: async (page) => {
      await page.getByTestId('nav-kana').click()
      await page.getByTestId('start-practice').click()
    },
  },
  { name: 'numbers-setup', open: async (page) => page.getByTestId('nav-numbers').click() },
  {
    name: 'numbers-practice',
    open: async (page) => {
      await page.getByTestId('nav-numbers').click()
      await page.getByTestId('start-numbers').click()
    },
  },
  { name: 'kanji-grid', open: async (page) => page.getByTestId('nav-kanji').click() },
  {
    name: 'kanji-trainer',
    open: async (page) => {
      await page.getByTestId('nav-kanji').click()
      await page.getByTestId('kanji-cell-日').click()
      await page.getByTestId('kanji-trainer').waitFor({ state: 'visible' })
    },
  },
  { name: 'vocab-setup', open: async (page) => page.getByTestId('nav-vocab').click() },
  {
    name: 'vocab-practice',
    open: async (page) => {
      await page.getByTestId('open-vocab-train').click()
      await page.getByTestId('start-vocab').click()
      await page.getByTestId('vocab-current-writing').waitFor({ state: 'visible' })
    },
  },
  { name: 'context-setup', open: async (page) => page.getByTestId('nav-context').click() },
]

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const rootOverflow = Math.max(0, doc.scrollWidth - window.innerWidth)

    const offenders = []
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue
      if (el.closest('.selection-board-wrap, .site-nav, .kanji-filter-tabs')) continue

      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) continue
      if (rect.right > window.innerWidth + 2 || rect.left < -2) {
        const tag = el.tagName.toLowerCase()
        const testId = el.getAttribute('data-testid') || ''
        const cls = typeof el.className === 'string' ? el.className.slice(0, 80) : ''
        offenders.push({
          tag,
          testId,
          cls,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        })
      }
    }

    const seen = new Set()
    const unique = []
    for (const item of offenders) {
      const key = `${item.testId}|${item.cls}|${item.tag}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(item)
      if (unique.length >= 12) break
    }

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      rootOverflow,
      bodyScrollWidth: body.scrollWidth,
      offenders: unique,
    }
  })
}

test('ui overflow audit across main routes', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const outDir = path.join('test-results', 'ui-audit', testInfo.project.name)
  fs.mkdirSync(outDir, { recursive: true })
  const report = []

  await openFreshApp(page)

  for (const route of ROUTES) {
    await openFreshApp(page)
    await route.open(page)
    await page.waitForTimeout(400)
    const metrics = await measureOverflow(page)
    await page.screenshot({
      path: path.join(outDir, `${route.name}.png`),
      fullPage: true,
    })
    report.push({ route: route.name, ...metrics })

    expect.soft(metrics.rootOverflow, `${route.name} root overflow`).toBeLessThanOrEqual(2)
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
})
