import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('kanji section shows word list and can stage training words', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Kanji flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-kanji').click()
  await expect(page.getByTestId('kanji-page')).toBeVisible()
  await expect(page.getByTestId('kanji-filter-tabs')).toBeVisible()
  await expect(page.getByTestId('kanji-filter-N5')).toBeVisible()

  await page.getByTestId('kanji-cell-日').click()
  await expect(page.getByTestId('kanji-trainer')).toBeVisible()
  await expect(page.getByTestId('kanji-focus-char')).toHaveText('日')
  await expect(page.getByTestId('kanji-word-list')).toBeVisible()
  await expect(page.getByTestId('kanji-word-writing').first()).toBeVisible()
  await expect(page.getByTestId('vocab-setup')).toHaveCount(0)
  await expect(page.getByTestId('kanji-open-train')).toHaveCount(0)

  const writing = await page.getByTestId('kanji-word-writing').first().innerText()
  await page.getByTestId(`kanji-word-open-${writing}`).click()
  await expect(page.getByTestId('kanji-word-detail')).toBeVisible()

  const trainButton = page.locator('[data-testid^="kanji-train-word-"]').first()
  await expect(trainButton).toBeVisible()
  await trainButton.click()
  await expect(trainButton).toHaveText('В наборе')

  await page.getByTestId('kanji-save-word').first().click()
  await expect(page.getByTestId('kanji-save-word').first()).toHaveText('В моих')

  await expect(page.getByTestId('kanji-word-edit')).toBeVisible()

  const writingBeforeHide = await page.getByTestId('kanji-word-writing').first().innerText()
  await page.getByTestId('kanji-hide-word').first().click()
  await expect(page.getByTestId('kanji-restore-hidden-words')).toBeVisible()
  await expect(page.getByTestId('kanji-word-detail')).toHaveCount(0)
  await expect(page.getByTestId('kanji-word-writing').first()).not.toHaveText(writingBeforeHide)

  await page.getByTestId('kanji-restore-hidden-words').click()
  await expect(page.getByTestId('kanji-restore-hidden-words')).toHaveCount(0)

  await page.getByTestId('kanji-toggle-learned').click()
  await page.getByText('← Все кандзи').click()
  await expect(page.getByTestId('kanji-cell-日')).toHaveClass(/is-learned/)

  await page.getByTestId('kanji-cell-日').click({ button: 'middle' })
  await expect(page.getByTestId('kanji-info-card')).toBeVisible()
  await expect(page.getByTestId('kanji-info-card')).toContainText('N5')
  await expect(page.getByTestId('kanji-info-words')).toBeVisible()
  await expect(page.getByTestId('kanji-info-words')).toContainText('毎日')
  await expect(page.locator('[data-testid^="kanji-info-train-word-"]').first()).toBeVisible()
  await page.getByTestId('kanji-info-close').click()
  await expect(page.getByTestId('kanji-info-card')).toHaveCount(0)
})

test('kanji composition card opens component stack', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Composition covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-kanji').click()
  await page.getByTestId('kanji-filter-N5').click()
  await page.getByTestId('kanji-cell-語').click({ button: 'middle' })
  await expect(page.getByTestId('kanji-info-card')).toBeVisible()
  await expect(page.getByTestId('kanji-composition')).toBeVisible()
  await expect(page.getByTestId('kanji-composition-formula')).toContainText('→ 語')
  await expect(page.getByTestId('kanji-composition-mnemonic')).toBeVisible()

  await page.getByTestId('kanji-component-言').click()
  await expect(page.getByTestId('kanji-stack-path')).toContainText('語 → 言')
  await expect(page.getByTestId('kanji-info-card')).toContainText('言')
  await page.getByTestId('kanji-info-stack-back').click()
  await expect(page.getByTestId('kanji-stack-path')).toHaveCount(0)
  await expect(page.getByTestId('kanji-info-char')).toHaveAttribute('data-character', '語')
})
