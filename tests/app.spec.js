import { expect, test } from '@playwright/test'

async function openFreshApp(page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

test('home screen renders core controls', async ({ page }) => {
  await openFreshApp(page)
  await expect(page.locator('h1')).toHaveText('Хирагана и катакана')
  await expect(page.getByTestId('start-practice')).toBeVisible()
  await expect(page.getByTestId('tab-stats')).toBeVisible()
  await expect(page.getByText('Повторять подсказанные')).toBeVisible()
})

test('single-card flow waits after hint until correct input', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed training flow is covered on desktop; mobile gets visual smoke coverage.')
  await openFreshApp(page)

  await page.getByTestId('clear-selection').click()
  await page.getByTestId('group-toggle-nn').click()
  await page.getByTestId('start-practice').click()

  await expect(page.getByTestId('current-symbol')).toHaveText('ん')

  const input = page.getByTestId('answer-input')
  await page.keyboard.press('Space')
  await expect(page.getByText('Подсказка: n / nn')).toBeVisible()
  await expect(page.getByTestId('current-symbol')).toHaveText('ん')

  await input.fill('x')
  await expect(page.getByTestId('current-symbol')).toHaveText('ん')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-wrong/)

  await input.fill('n')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})

test('stats reflect practiced item', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed stats flow is covered on desktop; mobile gets visual smoke coverage.')
  await openFreshApp(page)

  await page.getByTestId('clear-selection').click()
  await page.getByTestId('group-toggle-nn').click()
  await page.getByTestId('start-practice').click()

  await page.getByTestId('answer-input').fill('n')
  await page.waitForTimeout(350)
  await page.getByTestId('tab-stats').click()

  await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
  await expect(page.locator('.metric-card').filter({ hasText: 'Завершено' })).toContainText('1')
  await expect(page.getByText('Проблемные карточки')).toBeVisible()
})

test('hinted card is not counted as successful', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed stats flow is covered on desktop; mobile gets visual smoke coverage.')
  await openFreshApp(page)

  await page.getByTestId('clear-selection').click()
  await page.getByTestId('group-toggle-nn').click()
  await page.getByTestId('start-practice').click()

  await page.keyboard.press('Space')
  await page.getByTestId('answer-input').fill('n')
  await page.waitForTimeout(350)
  await page.getByTestId('tab-stats').click()

  const resolvedCard = page.locator('.metric-card').filter({ hasText: 'Завершено' })
  await expect(resolvedCard).toContainText('0')
})
