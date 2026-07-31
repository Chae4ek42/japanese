import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('kanji section opens trainer from table', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Kanji flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-kanji').click()
  await expect(page.getByTestId('kanji-page')).toBeVisible()
  await expect(page.getByTestId('kanji-filter-tabs')).toBeVisible()
  await expect(page.getByTestId('kanji-filter-N5')).toBeVisible()

  await page.getByTestId('kanji-cell-日').click()
  await expect(page.getByTestId('kanji-trainer')).toBeVisible()
  await expect(page.getByTestId('kanji-focus-char')).toHaveText('日')
  await expect(page.getByTestId('kanji-word-writing')).toBeVisible()

  await page.getByTestId('kanji-reveal-word').click()
  await expect(page.getByTestId('kanji-reveal-word')).toHaveText('Скрыть')
  await expect(page.getByTestId('kanji-word-kana')).toBeVisible()
  await expect(page.getByTestId('kanji-word-kana').locator('.kanji-word-kana .reading-seg.is-focus')).toBeVisible()
  await expect(page.getByTestId('kanji-word-meanings')).toBeVisible()
  await expect(page.getByTestId('kanji-word-meanings').locator('li').first()).toBeVisible()
  await expect(page.getByTestId('kanji-save-word')).toBeVisible()
  await page.getByTestId('kanji-save-word').click()
  await expect(page.getByTestId('kanji-save-word')).toHaveText('В моих')

  const writingBeforeHide = await page.getByTestId('kanji-word-writing').innerText()
  await page.getByTestId('kanji-hide-word').click()
  await expect(page.getByTestId('kanji-restore-hidden-words')).toBeVisible()
  await expect(page.getByTestId('kanji-word-writing')).not.toHaveText(writingBeforeHide)
  await page.getByTestId('kanji-restore-hidden-words').click()
  await expect(page.getByTestId('kanji-restore-hidden-words')).toHaveCount(0)

  await page.getByTestId('kanji-reveal-word').click()
  await expect(page.getByTestId('kanji-reveal-word')).toHaveText('Показать')
  await expect(page.getByTestId('kanji-word-meanings')).toHaveCount(0)

  await page.getByTestId('kanji-chip-日').click({ button: 'middle' })
  await expect(page.getByTestId('kanji-info-card')).toBeVisible()
  await expect(page.getByTestId('kanji-info-card')).toContainText('N5')
  await page.getByTestId('kanji-info-close').click()
  await expect(page.getByTestId('kanji-info-card')).toHaveCount(0)

  await page.getByTestId('kanji-toggle-learned').click()
  await page.getByText('← Все кандзи').click()
  await expect(page.getByTestId('kanji-cell-日')).toHaveClass(/is-learned/)

  await page.getByTestId('kanji-cell-日').click({ button: 'middle' })
  await expect(page.getByTestId('kanji-info-card')).toBeVisible()
  await expect(page.getByTestId('kanji-info-card')).toContainText('N5')
  await expect(page.getByTestId('kanji-info-words')).toBeVisible()
  await expect(page.getByTestId('kanji-info-words')).toContainText('毎日')
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
