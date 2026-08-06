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
  await expect(page.getByTestId('vocab-list').locator('[data-testid^="vocab-word-"]')).toHaveCount(1)

  await page.getByTestId(toggleId).click()
  await expect(page.getByText('Пока пусто')).toBeVisible()
})

test('vocab trainer: romaji and choice modes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Vocab trainer covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await expect(page).toHaveURL(/\/train$/)
  await expect(page.getByTestId('train-page')).toBeVisible()
  await expect(page.getByTestId('vocab-setup')).toBeVisible()
  await expect(page.getByTestId('vocab-source-kanji')).toBeVisible()
  await expect(page.getByTestId('vocab-source-list')).toBeVisible()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-current-writing')).toBeVisible()
  await expect(page.getByTestId('vocab-answer-input')).toBeVisible()
  await expect(page.getByTestId('vocab-hint-button')).toHaveCount(0)

  const kanjiChip = page.locator('[data-kanji-chip]').first()
  if ((await kanjiChip.count()) > 0) {
    await kanjiChip.click({ button: 'middle' })
    await expect(page.getByTestId('kanji-info-card')).toBeVisible()
    await page.getByTestId('kanji-info-close').click()
    await expect(page.getByTestId('kanji-info-card')).toHaveCount(0)
  }

  await page.getByTestId('vocab-answer-input').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('vocab-hint-panel')).toBeVisible()
  const romajiParts = await page.locator('[data-testid="vocab-hint-panel"] .kanji-word-romaji').allInnerTexts()
  const answer = romajiParts
    .map((part) => part.trim().replace(/[\s_\-’']/g, '').toLowerCase())
    .filter(Boolean)
    .join('/')
  await page.getByTestId('vocab-answer-input').fill(answer)
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)

  await page.getByText('← К настройкам').click()
  await page.getByTestId('vocab-drill-choice').click()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-choice-grid')).toBeVisible()
  await expect(page.getByTestId('vocab-choice-0')).toBeVisible()
})

test('vocab trainer mobile: hint button reveals reading', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only hint button.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-answer-input')).toBeVisible()
  await expect(page.getByTestId('vocab-hint-button')).toBeVisible()
  await page.getByTestId('vocab-hint-button').click()
  await expect(page.getByTestId('vocab-hint-panel')).toBeVisible()
  await expect(page.getByTestId('vocab-hint-button')).toBeDisabled()
})

test('vocab trainer: skip next scores as correct, previous navigates history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Skip navigation covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('start-vocab').click()

  const first = await page.getByTestId('vocab-current-writing').innerText()
  await expect(page.getByTestId('vocab-skip-prev')).toBeDisabled()

  await page.getByTestId('vocab-skip-next').click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(first)
  await expect(page.getByTestId('vocab-skip-prev')).toBeEnabled()
  await expect(page.getByTestId('session-chips')).toContainText('1 карточек')
  await expect(page.getByTestId('session-chips')).toContainText('серия 1')

  const second = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-skip-prev').click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(first)

  await page.getByTestId('vocab-skip-next').click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(second)
  await expect(page.getByTestId('session-chips')).toContainText('1 карточек')
})

test('vocab trainer: arrow keys navigate cards', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Keyboard navigation covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('start-vocab').click()

  const first = await page.getByTestId('vocab-current-writing').innerText()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(first)
  const second = await page.getByTestId('vocab-current-writing').innerText()

  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(first)

  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(second)
})

test('vocab trainer: in-session panel changes pick mode and shows word stats', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Sidebar controls covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('vocab-source-group').click()
  await page.getByTestId('vocab-train-group-weekdays').click()
  await page.getByTestId('vocab-new-word-limit').fill('1')
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-session-sidebar')).toBeVisible()
  await page.getByTestId('vocab-session-toggle-filters').click()
  await expect(page.getByTestId('vocab-session-word-jlpt')).toBeVisible()
  await page.getByTestId('vocab-session-word-jlpt-5').click()
  await expect(page.getByTestId('vocab-session-word-jlpt-5')).toHaveAttribute('aria-pressed', 'true')

  await expect(page.getByTestId('vocab-session-sort')).toBeVisible()
  await page.getByTestId('vocab-session-sort-accuracy-desc').click()
  await expect(page.getByTestId('vocab-session-sort-accuracy-desc')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('vocab-session-sort-novelty').click()
  await expect(page.getByTestId('vocab-session-sort-novelty')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('vocab-session-pick-even').click()
  await expect(page.getByTestId('vocab-session-pick-even')).toHaveClass(/is-active/)
  await expect(page.getByTestId('vocab-session-sort')).toBeVisible()
  await expect(page.getByTestId('vocab-session-weight-slider')).toHaveCount(0)

  const sessionWords = page.locator('[data-testid^="vocab-session-word-"]')
  const countBefore = await sessionWords.count()
  await expect(page.getByTestId('vocab-add-source-word')).toBeVisible()
  await page.getByTestId('vocab-add-source-word').click()
  await expect(sessionWords).toHaveCount(countBefore + 1)

  await page.getByTestId('vocab-session-pick-adaptive').click()
  await expect(page.getByTestId('vocab-session-pick-adaptive')).toHaveClass(/is-active/)
  await expect(page.getByTestId('vocab-session-sort')).toBeVisible()
})

test('dictionary tabs update URL', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Dictionary URL covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-vocab').click()
  await expect(page).toHaveURL(/\/vocab$/)
  await page.getByTestId('vocab-tab-mine').click()
  await expect(page).toHaveURL(/\/vocab\/mine$/)
  await expect(page.getByTestId('vocab-tab-train')).toHaveCount(0)
  await page.getByTestId('nav-train').click()
  await expect(page).toHaveURL(/\/train$/)
  await expect(page.getByTestId('train-page')).toBeVisible()
})

test('dictionary: add and edit custom word', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Custom word flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-vocab').click()
  await page.getByTestId('vocab-tab-mine').click()
  await expect(page.getByTestId('custom-word-open')).toBeVisible()
  await expect(page.getByTestId('custom-word-form')).toHaveCount(0)
  await page.getByTestId('custom-word-open').click()
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

  await expect(page.getByTestId('vocab-mine-copy-words')).toBeVisible()
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByTestId('vocab-mine-copy-words').click()
  await expect(page.getByTestId('vocab-mine-copy-words')).toHaveText('Скопировано')
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe('猫')

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
