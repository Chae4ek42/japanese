import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('reader saves original sentence and cloze settles hints and answers once', async ({ page }) => {
  test.setTimeout(90_000)
  await openFreshApp(page)
  await page.getByTestId('nav-reader').click()
  await page.getByTestId('reader-input').fill('水を飲む。')
  await page.getByTestId('reader-token-水').click({ timeout: 60_000 })
  await page.getByTestId('reader-toggle-mine').click()
  await expect(page.getByRole('status').filter({ hasText: 'Пример сохранён' })).toBeVisible()
  await page.getByRole('button', { name: /Практика в предложениях/ }).click()
  await expect(page).toHaveURL(/\/contexts$/)
  await expect(page.locator('.context-sentence')).toHaveText('［　　　］を飲む。')
  await page.getByRole('button', { name: 'Показать ответ', exact: true }).click()
  await expect(page.getByText('Попытки в этом примере: 1 · Без подсказки верно: 0')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Показать ответ', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Следующий пример' }).click()
  await page.getByRole('textbox').fill('mizu')
  await page.getByRole('button', { name: 'Проверить', exact: true }).click()
  await expect(page.getByText('Попытки в этом примере: 2 · Без подсказки верно: 1')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Проверить', exact: true })).toBeDisabled()
})
