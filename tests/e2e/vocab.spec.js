import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('dictionary: catalog, groups and my words', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Dictionary flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-vocab').click()
  await expect(page.getByTestId('vocab-page')).toBeVisible()
  await expect(page.getByTestId('vocab-list')).toBeVisible()

  await page.getByTestId('vocab-mode-group').click()
  await page.getByTestId('vocab-group-weekdays').click()
  await expect(page.getByTestId('vocab-word-月曜日')).toBeVisible()

  const toggle = page.locator('[data-testid^="vocab-toggle-"]').first()
  const toggleId = await toggle.getAttribute('data-testid')
  await toggle.click()
  await page.getByTestId('vocab-tab-mine').click()
  await expect(page.getByTestId('vocab-list').locator('.vocab-word')).toHaveCount(1)

  await page.getByTestId(toggleId).click()
  await expect(page.getByText('Пока пусто')).toBeVisible()
})

test('vocab trainer: romaji and choice modes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Vocab trainer covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await expect(page).toHaveURL(/\/vocab\/train$/)
  await expect(page.getByTestId('vocab-setup')).toBeVisible()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-current-writing')).toBeVisible()
  await expect(page.getByTestId('vocab-answer-input')).toBeVisible()

  const kanjiChip = page.locator('[data-kanji-chip]').first()
  if ((await kanjiChip.count()) > 0) {
    await kanjiChip.click({ button: 'middle' })
    await expect(page.getByTestId('kanji-info-card')).toBeVisible()
    await page.getByTestId('kanji-info-close').click()
    await expect(page.getByTestId('kanji-info-card')).toHaveCount(0)
  }

  await page.getByTestId('vocab-hint-button').click()
  await expect(page.getByTestId('vocab-hint-panel')).toBeVisible()
  await expect(page.getByTestId('vocab-hint-romaji')).toBeVisible()
  await expect(page.getByTestId('vocab-hint-meanings')).toBeVisible()
  const answer = (await page.getByTestId('vocab-hint-romaji').innerText()).trim()
  await page.getByTestId('vocab-answer-input').fill(answer.replace(/[\s_\-’']/g, '').toLowerCase())
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)

  await page.getByText('← К настройкам').click()
  await page.getByTestId('vocab-drill-choice').click()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-choice-grid')).toBeVisible()
  await expect(page.getByTestId('vocab-choice-0')).toBeVisible()
})

test('vocab trainer: skip next and previous without scoring', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Skip navigation covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('start-vocab').click()

  const first = await page.getByTestId('vocab-current-writing').innerText()
  await expect(page.getByTestId('vocab-skip-prev')).toBeDisabled()

  await page.getByTestId('vocab-skip-next').click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(first)
  await expect(page.getByTestId('vocab-skip-prev')).toBeEnabled()
  await expect(page.getByTestId('session-chips')).toContainText('0 карточек')
  await expect(page.getByTestId('session-chips')).toContainText('серия 0')

  const second = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-skip-prev').click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(first)

  await page.getByTestId('vocab-skip-next').click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(second)
})

test('dictionary tabs update URL', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Dictionary URL covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-vocab').click()
  await expect(page).toHaveURL(/\/vocab$/)
  await page.getByTestId('vocab-tab-mine').click()
  await expect(page).toHaveURL(/\/vocab\/mine$/)
  await page.getByTestId('vocab-tab-train').click()
  await expect(page).toHaveURL(/\/vocab\/train$/)
})

test('dictionary: add and edit custom word', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Custom word flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-vocab').click()
  await page.getByTestId('vocab-tab-mine').click()
  await expect(page.getByTestId('custom-word-form')).toBeVisible()

  await page.getByTestId('custom-word-writing').fill('猫')
  await page.getByTestId('custom-word-kana').fill('ねこ')
  await page.getByTestId('custom-word-romaji').fill('neko')
  await page.getByTestId('custom-word-meanings').fill('кошка, кот')
  await page.getByTestId('custom-word-submit').click()

  await expect(page.getByTestId('vocab-word-猫')).toBeVisible()
  await expect(page.getByTestId('vocab-word-猫')).toContainText('neko')
  await expect(page.getByTestId('vocab-word-猫')).toContainText('кошка')
  await expect(page.getByTestId('vocab-word-猫')).toContainText('своё')

  const editButton = page.locator('[data-testid^="vocab-edit-"]').first()
  await editButton.click()
  await expect(page.getByTestId('custom-word-editing-label')).toBeVisible()
  await page.getByTestId('custom-word-romaji').fill('neko-san')
  await page.getByTestId('custom-word-meanings').fill('кот')
  await page.getByTestId('custom-word-submit').click()

  await expect(page.getByTestId('vocab-word-猫')).toContainText('neko-san')
  await expect(page.getByTestId('vocab-word-猫')).toContainText('кот')
  await expect(page.getByTestId('custom-word-editing-label')).toHaveCount(0)
})
