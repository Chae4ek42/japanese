import { test } from '@playwright/test'
import { expect, openFreshApp, clickNav } from './helpers.js'

test('header navigates to verbs trainer', async ({ page }) => {
  await openFreshApp(page)
  await page.getByTestId('nav-verbs').click()
  await expect(page.getByTestId('start-verbs')).toBeVisible()
  await expect(page.getByTestId('verbs-page')).toBeVisible()

  await page.getByTestId('nav-main').click()
  await expect(page.getByTestId('open-verbs')).toBeVisible()
})

test('theory verbs unit opens conjugation trainer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Theory verbs CTA covered on desktop.')
  await openFreshApp(page)
  await clickNav(page, 'nav-theory')
  await page.getByTestId('theory-nav-verbs').click()
  await expect(page.getByTestId('theory-unit-verbs')).toBeVisible()
  await page.getByTestId('theory-open-verbs').click()
  await expect(page.getByTestId('verbs-page')).toBeVisible()
  await expect(page.getByTestId('start-verbs')).toBeVisible()
})

test('verbs: start and pick an answer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Verbs flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-verbs').click()
  await page.getByTestId('start-verbs').click()
  await expect(page.getByTestId('verb-prompt')).toBeVisible()
  await expect(page.getByTestId('verb-form-label')).toBeVisible()
  await page.locator('[data-testid^="verb-choice-"]').first().click()
  await expect(page.locator('.particles-feedback.is-success, .particles-feedback.is-error')).toBeVisible()
})
