import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

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
