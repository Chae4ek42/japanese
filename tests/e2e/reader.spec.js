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
