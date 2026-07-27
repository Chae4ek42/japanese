import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('context: setup then sentence drill for family group', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Context flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-context').click()
  await expect(page).toHaveURL(/\/context$/)
  await expect(page.getByTestId('context-page')).toBeVisible()
  await expect(page.getByTestId('context-setup')).toBeVisible()
  await expect(page.getByTestId('context-group-family')).toHaveClass(/is-active/)
  await expect(page.getByTestId('context-batch-size')).toHaveValue('3')
  await page.getByTestId('context-start').click()
  await expect(page.getByTestId('context-drill')).toBeVisible()
  await expect(page.getByTestId('context-sentence')).toBeVisible()
  await expect(page.getByTestId('context-target')).toBeVisible()
  await expect(page.getByTestId('context-speak')).toBeVisible()
  await expect(page.getByTestId('context-add-word')).toBeVisible()
  await expect(page.getByTestId('context-add-grammar')).toBeVisible()
  await page.getByTestId('context-reveal').click()
  await expect(page.getByTestId('context-gloss')).toBeVisible()
  const know = page.getByTestId('context-know')
  if (await know.count()) {
    await know.click()
  } else {
    await page.locator('[data-testid^="context-know-"]').first().click()
  }
  await expect(page.getByTestId('context-coverage')).toContainText('1 /')

  await page.getByTestId('context-back-setup').click()
  await expect(page.getByTestId('context-setup')).toBeVisible()
  await expect(page.getByTestId('context-continue')).toBeVisible()
  await expect(page.getByTestId('context-training-log')).toBeVisible()
  await page.getByTestId('context-continue').click()
  await expect(page.getByTestId('context-drill')).toBeVisible()
  await expect(page.getByTestId('context-sentence')).toBeVisible()
})
