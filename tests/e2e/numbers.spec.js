import { test } from '@playwright/test'
import { expect, openFreshApp, openNumbersTrainer } from './helpers.js'

test('header navigates to numbers trainer', async ({ page }) => {
  await openFreshApp(page)
  await openNumbersTrainer(page)
  await expect(page.getByTestId('start-numbers')).toBeVisible()
  await expect(page.getByTestId('numbers-cheat-sheet')).toBeVisible()

  await page.getByTestId('nav-main').click()
  await expect(page.getByTestId('open-numbers')).toBeVisible()
})

test('numbers: space reveals kanji and kana, then advances', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Numbers flow covered on desktop.')
  await openFreshApp(page)
  await openNumbersTrainer(page)

  await page.getByTestId('numbers-range-10').click()
  await page.getByTestId('start-numbers').click()
  await expect(page.getByTestId('current-number')).toBeVisible()

  const firstNumber = await page.getByTestId('current-number').innerText()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('number-kanji')).toBeVisible()
  await expect(page.getByTestId('number-kana')).toBeVisible()
  await expect(page.locator('.practice-stage')).toHaveClass(/is-hint/)

  await page.keyboard.press('Space')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
  await expect(page.getByTestId('current-number')).not.toHaveText(firstNumber)
})

test('numbers mobile smoke: reveal and advance', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only smoke test.')
  await openFreshApp(page)
  await openNumbersTrainer(page)

  await page.getByTestId('numbers-range-10').click()
  await page.getByTestId('start-numbers').click()
  await expect(page.getByTestId('current-number')).toBeVisible()

  await page.getByTestId('numbers-hint-button').click()
  await expect(page.getByTestId('number-kanji')).toBeVisible()

  await page.getByTestId('numbers-hint-button').click()
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})
