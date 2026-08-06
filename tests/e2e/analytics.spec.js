import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('analytics page opens from nav with chart sections', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Analytics covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-analytics').click()
  await expect(page).toHaveURL(/\/analytics$/)
  await expect(page.getByTestId('analytics-page')).toBeVisible()
  await expect(page.getByTestId('analytics-overview')).toBeVisible()
  await expect(page.getByTestId('analytics-time')).toBeVisible()
  await expect(page.getByTestId('analytics-vocab')).toBeVisible()
  await expect(page.getByTestId('analytics-kanji')).toBeVisible()
})
