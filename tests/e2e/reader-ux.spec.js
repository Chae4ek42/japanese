import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

const SHOT = 'test-results/reader-ux'

async function metrics(page) {
  return page.evaluate(() => {
    const pageEl = document.querySelector('.reader-page')
    const bar = document.querySelector('.reader-library-bar')
    const compose = document.querySelector('.reader-compose')
    const input = document.querySelector('[data-testid="reader-input"]')
    const workspace = document.querySelector('[data-testid="reader-workspace"]')
    const neu = document.querySelector('[data-testid="reader-new-text"]')
    const del = document.querySelector('.reader-library-delete')
    const token = document.querySelector('[data-testid^="reader-token-"]')
    const tools = [...document.querySelectorAll('.reader-sentence-tools button')]
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
      }
    }
    return {
      inner: { w: window.innerWidth, h: window.innerHeight },
      scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      page: box(pageEl),
      bar: box(bar),
      compose: box(compose),
      input: box(input),
      workspace: box(workspace),
      newButton: box(neu),
      deleteButton: box(del),
      token: box(token),
      tools: tools.map((el) => ({ text: el.textContent?.trim(), ...box(el) })),
      composeBelowFold: compose ? compose.getBoundingClientRect().top > window.innerHeight - 80 : null,
    }
  })
}

test('reader ui/ux walkthrough', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const tag = testInfo.project.name
  await openFreshApp(page)
  await page.getByTestId('nav-reader').click()
  await expect(page.getByTestId('reader-page')).toBeVisible()

  const nestedButtonErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /cannot (be a descendant of|contain a nested) <button>/i.test(msg.text())) {
      nestedButtonErrors.push(msg.text())
    }
  })

  await page.screenshot({ path: `${SHOT}/${tag}-01-empty.png`, fullPage: true })
  const empty = await metrics(page)
  testInfo.attach(`${tag}-empty-metrics`, { body: JSON.stringify(empty, null, 2), contentType: 'application/json' })
  expect(empty.overflowX, 'horizontal overflow on empty reader').toBeLessThanOrEqual(2)
  expect(empty.composeBelowFold, 'textarea should be on screen when empty').toBe(false)
  expect(empty.newButton?.h ?? 0, 'New tap target').toBeGreaterThanOrEqual(36)

  await page.getByTestId('reader-input').fill('今日はいい天気です。水を飲む。')
  await expect(page.getByTestId('reader-library')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('reader-tokens').locator('.reader-sentence')).toHaveCount(2, { timeout: 60_000 })

  await page.screenshot({ path: `${SHOT}/${tag}-02-filled.png`, fullPage: true })
  const filled = await metrics(page)
  testInfo.attach(`${tag}-filled-metrics`, { body: JSON.stringify(filled, null, 2), contentType: 'application/json' })
  expect(filled.overflowX, 'horizontal overflow with text').toBeLessThanOrEqual(2)
  expect(filled.deleteButton?.h ?? 0, 'delete tap target').toBeGreaterThanOrEqual(36)
  expect(nestedButtonErrors, 'nested button in reader tokens').toEqual([])

  const firstToken = page.locator('[data-testid^="reader-token-"]').first()
  await firstToken.click()
  await expect(page.getByTestId('reader-panel')).toBeVisible()
  await page.screenshot({ path: `${SHOT}/${tag}-03-word.png`, fullPage: true })

  await page.getByTestId('reader-new-text').click()
  await expect(page.getByTestId('reader-input')).toHaveValue('')
  await page.getByTestId('reader-input').fill('私は学生です。')
  await expect(page.getByTestId('reader-library').locator('.reader-library-item')).toHaveCount(2, {
    timeout: 15_000,
  })

  const firstChip = page.locator('.reader-library-item').last().getByRole('button').first()
  await firstChip.click()
  await expect(page.getByTestId('reader-input')).toHaveValue(/今日はいい天気です/)

  await page.getByTestId('reader-library-rename').fill('Погода')
  await page.getByTestId('reader-library-rename').blur()
  await expect(page.locator('.reader-library-item.is-active .reader-library-title')).toHaveText('Погода')

  await page.getByTestId('reader-duplicate-text').click()
  await expect(page.getByTestId('reader-library').locator('.reader-library-item')).toHaveCount(3)
  await expect(page.locator('.reader-library-item.is-active .reader-library-title')).toContainText('копия')

  await page.screenshot({ path: `${SHOT}/${tag}-04-library.png`, fullPage: true })
  const library = await metrics(page)
  testInfo.attach(`${tag}-library-metrics`, { body: JSON.stringify(library, null, 2), contentType: 'application/json' })

  const activeDelete = page.locator('.reader-library-item.is-active [data-testid^="reader-library-delete-"]')
  await activeDelete.click()
  await expect(page.getByTestId('reader-library').locator('.reader-library-item')).toHaveCount(2)
})
