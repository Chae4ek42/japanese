import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('reader: unknown words start a train session', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Reader train flow covered on desktop.')
  test.setTimeout(90_000)
  await openFreshApp(page)
  await page.getByTestId('nav-reader').click()
  await expect(page.getByTestId('reader-page')).toBeVisible()

  await page.getByTestId('reader-input').fill('水を飲む。')
  await expect(page.getByTestId('reader-train-unknown')).toBeVisible({ timeout: 60_000 })
  await page.getByTestId('reader-train-unknown').click()

  await expect(page).toHaveURL(/\/train$/)
  await expect(page.getByTestId('train-page')).toBeVisible()
  await expect(page.getByTestId('vocab-current-writing')).toBeVisible({ timeout: 20_000 })
})

test('reader: texts autosave into the library', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Reader library covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-reader').click()
  await expect(page.getByTestId('reader-page')).toBeVisible()

  await page.getByTestId('reader-input').fill('今日はいい天気です。')
  await expect(page.getByTestId('reader-library')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.reader-library-item.is-active')).toContainText('今日はいい天気です')
  await expect(page.getByTestId('reader-save-hint')).toHaveText('Сохраняется само')

  await page.getByTestId('reader-new-text').click()
  await expect(page.getByTestId('reader-input')).toHaveValue('')
  await page.getByTestId('reader-input').fill('水を飲む。')
  await expect(page.getByTestId('reader-library').locator('.reader-library-item')).toHaveCount(2, {
    timeout: 10_000,
  })
})
