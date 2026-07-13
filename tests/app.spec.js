import { expect, test } from '@playwright/test'

async function openFreshApp(page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

test('home screen renders numbers trainer', async ({ page }) => {
  await openFreshApp(page)
  await expect(page.locator('h1')).toHaveText('Японские числа')
  await expect(page.getByTestId('start-numbers')).toBeVisible()
  await expect(page.getByTestId('numbers-mode-plain')).toBeVisible()
  await expect(page.getByTestId('numbers-mode-age')).toBeVisible()
  await expect(page.getByTestId('numbers-cheat-sheet')).toBeVisible()
})

test('numbers: space reveals kanji and kana, then advances', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Numbers flow covered on desktop.')
  await openFreshApp(page)

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

  await page.getByTestId('numbers-range-10').click()
  await page.getByTestId('start-numbers').click()
  await expect(page.getByTestId('current-number')).toBeVisible()

  await page.getByTestId('numbers-hint-button').click()
  await expect(page.getByTestId('number-kanji')).toBeVisible()

  await page.getByTestId('numbers-hint-button').click()
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})
