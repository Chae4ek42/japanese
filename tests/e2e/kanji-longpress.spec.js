import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('mobile long-press opens kanji info from grid and chip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Long-press is mobile-only.')
  await openFreshApp(page)
  await page.getByTestId('nav-kanji').click()
  await expect(page.getByTestId('kanji-page')).toBeVisible()

  await page.getByTestId('kanji-cell-日').click({ delay: 600 })
  await expect(page.getByTestId('kanji-info-card')).toBeVisible()
  await expect(page.getByTestId('kanji-info-card')).toContainText('N5')
  await expect(page.getByTestId('kanji-trainer')).toHaveCount(0)
  await page.getByTestId('kanji-info-close').click()
  await expect(page.getByTestId('kanji-info-card')).toHaveCount(0)

  await page.getByTestId('kanji-cell-日').click()
  await expect(page.getByTestId('kanji-trainer')).toBeVisible()

  const chip = page.getByTestId('kanji-chip-日')
  await chip.scrollIntoViewIfNeeded()
  await chip.click({ delay: 600 })
  await expect(page.getByTestId('kanji-info-card')).toBeVisible()
  await page.getByTestId('kanji-info-close').click()

  const glyph = page.getByTestId('kanji-focus-char')
  await glyph.scrollIntoViewIfNeeded()
  await glyph.click({ delay: 600 })
  await expect(page.getByTestId('kanji-info-card')).toBeVisible()
})
