import { expect, test } from '@playwright/test'

async function openFreshApp(page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

async function openNumbersTrainer(page) {
  await page.getByTestId('nav-numbers').click()
}

test('home screen renders landing page', async ({ page }) => {
  await openFreshApp(page)
  await expect(page.getByTestId('nav-home')).toBeVisible()
  await expect(page.getByTestId('nav-kana')).toBeVisible()
  await expect(page.getByTestId('nav-numbers')).toBeVisible()
  await expect(page.getByTestId('nav-stats')).toBeVisible()
  await expect(page.getByTestId('open-kana')).toBeVisible()
  await expect(page.getByTestId('open-numbers')).toBeVisible()
  await expect(page.getByText('Тренажёры для повседневной практики')).toBeVisible()
})

test('header navigates to stats page', async ({ page }) => {
  await openFreshApp(page)
  await page.getByTestId('nav-stats').click()
  await expect(page.getByTestId('stats-page')).toBeVisible()
  await expect(page.getByTestId('numbers-stats')).toBeVisible()
})

test('header navigates to kana trainer', async ({ page }) => {
  await openFreshApp(page)
  await page.getByTestId('nav-kana').click()
  await expect(page.getByTestId('start-practice')).toBeVisible()

  await page.getByTestId('nav-main').click()
  await expect(page.getByTestId('open-kana')).toBeVisible()
})

test('kana: instant mode accepts romaji answer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Kana flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-kana').click()
  await page.getByTestId('start-practice').click()
  await expect(page.getByTestId('current-symbol')).toBeVisible()

  const symbol = await page.getByTestId('current-symbol').innerText()
  await page.keyboard.press('Space')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-hint/)
  const hintText = await page.locator('.feedback.is-hint').innerText()
  const answer = hintText.replace('Подсказка:', '').trim().split(' / ')[0]
  await page.getByTestId('answer-input').fill(answer)
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
  await expect(page.getByTestId('current-symbol')).not.toHaveText(symbol)
})

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
