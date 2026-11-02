import { test } from '@playwright/test'
import { expect, openFreshApp, clickNav, swipeTouch } from './helpers.js'

test('dictionary: catalog, groups and my words', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Dictionary flow covered on desktop.')
  await openFreshApp(page)
  await clickNav(page, 'nav-vocab')
  await expect(page.getByTestId('vocab-page')).toBeVisible()
  await expect(page.getByTestId('vocab-list')).toBeVisible()

  await page.getByTestId('vocab-mode-group').click()
  await page.getByTestId('vocab-group-weekdays').click()
  await expect(page.getByTestId('vocab-word-月曜日')).toBeVisible()

  const toggle = page.locator('[data-testid^="vocab-toggle-"]').first()
  const toggleId = await toggle.getAttribute('data-testid')
  await toggle.click()
  await clickNav(page, 'nav-mine')
  await expect(page.getByTestId('mine-page')).toBeVisible()
  await expect(page.getByTestId('vocab-list').locator('[data-testid^="vocab-word-"]')).toHaveCount(1)

  await page.getByTestId(toggleId).click()
  await expect(page.getByText('Пока пусто')).toBeVisible()
})

test('vocab setup: drill vs srs mode switch', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Setup mode switch covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await expect(page.getByTestId('vocab-setup')).toBeVisible()
  await expect(page.getByTestId('vocab-session-mode-drill')).toHaveClass(/is-active/)
  await expect(page.getByTestId('vocab-source-kanji')).toBeVisible()
  await expect(page.getByTestId('vocab-srs-settings')).toHaveCount(0)

  await page.getByTestId('vocab-session-mode-srs').click()
  await expect(page.getByTestId('vocab-session-mode-srs')).toHaveClass(/is-active/)
  await expect(page.getByTestId('vocab-srs-deck')).toBeVisible()
  await expect(page.getByTestId('vocab-srs-settings')).toBeVisible()
  await expect(page.getByTestId('vocab-source-kanji')).toHaveCount(0)
  await expect(page.getByTestId('vocab-new-per-day')).toBeVisible()
  await page.getByTestId('vocab-setup-more-toggle').click()
  await expect(page.getByTestId('vocab-retention-90')).toBeVisible()
  await page.getByTestId('vocab-retention-95').click()
  await expect(page.getByTestId('vocab-target-retention-value')).toHaveText('95%')

  await page.getByTestId('vocab-session-mode-drill').click()
  await expect(page.getByTestId('vocab-session-mode-drill')).toHaveClass(/is-active/)
  await expect(page.getByTestId('vocab-source-kanji')).toBeVisible()
  await expect(page.getByTestId('vocab-srs-settings')).toHaveCount(0)
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
  const writing = await page.getByTestId('vocab-current-writing').innerText()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('vocab-hint-panel')).toBeVisible()
  const romajiParts = await page.locator('[data-testid="vocab-hint-panel"] .kanji-word-romaji').allInnerTexts()
  const answer = romajiParts
    .map((part) => part.trim().replace(/[\s_\-’']/g, '').toLowerCase())
    .filter(Boolean)
    .join('/')
  await page.getByTestId('vocab-answer-input').fill(answer)
  await expect(page.getByTestId('session-chips').locator('.session-chip')).toHaveText([
    '1 карточка',
    /^0% чисто/,
    /^серия 0/,
  ])
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(writing)

  await page.getByText('← К настройкам').click()
  await page.getByTestId('vocab-drill-choice').click()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-choice-grid')).toBeVisible()
  await expect(page.getByTestId('vocab-choice-0')).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.locator('.vocab-choice-button.is-correct')).toBeVisible()
})

test('vocab trainer mobile: no keyboard input, hint and navigation work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only hint button.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-current-writing')).toBeVisible()
  await expect(page.getByTestId('vocab-answer-input')).toHaveCount(0)
  await expect(page.locator('input:focus, textarea:focus')).toHaveCount(0)
  await expect(page.getByTestId('vocab-hint-button')).toBeVisible()
  await page.getByTestId('vocab-hint-button').click()
  await expect(page.getByTestId('vocab-hint-panel')).toBeVisible()
  await expect(page.getByTestId('vocab-hint-button')).toBeDisabled()
  await expect(page.locator('input:focus, textarea:focus')).toHaveCount(0)

  const first = await page.getByTestId('vocab-current-writing').innerText()
  await expect(page.getByTestId('vocab-skip-next')).toHaveCount(0)
  await expect(page.getByTestId('vocab-skip-prev')).toHaveCount(0)
  await swipeTouch(page, page.getByTestId('vocab-current-writing'))
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(first)
  await expect(page.getByTestId('vocab-answer-input')).toHaveCount(0)
  await expect(page.locator('input:focus, textarea:focus')).toHaveCount(0)
  await expect(page.getByTestId('vocab-hint-button')).toBeEnabled()
})

test('vocab trainer mobile: swipes work over controls without tapping them', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Real touch navigation is mobile-only.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('vocab-source-group').click()
  await page.getByTestId('vocab-train-group-weekdays').click()
  await page.getByTestId('start-vocab').click()
  const writing = page.getByTestId('vocab-current-writing')
  const first = await writing.innerText()
  await expect(page.getByTestId('vocab-mobile-session')).not.toHaveAttribute('open')
  await expect(page.getByTestId('vocab-edit-card')).toHaveAttribute('aria-label', 'Изменить слово')
  await expect(page.getByTestId('vocab-edit-card').locator('svg')).toBeVisible()

  await swipeTouch(page, writing)
  await expect(writing).not.toHaveText(first)
  await expect(page.getByTestId('kanji-info-card')).toHaveCount(0)
  const second = await writing.innerText()

  await swipeTouch(page, page.getByTestId('vocab-edit-card'), { dx: 120 })
  await expect(writing).toHaveText(first)
  await expect(page.getByTestId('vocab-card-editor')).toHaveCount(0)

  await swipeTouch(page, page.getByTestId('vocab-hint-button'))
  await expect(writing).toHaveText(second)
  await expect(page.getByTestId('vocab-hint-panel')).toHaveCount(0)
  await page.getByTestId('vocab-toggle-learned').tap()
  await expect(page.getByTestId('vocab-toggle-learned')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('vocab-toggle-learned').tap()
  await expect(page.getByTestId('vocab-toggle-learned')).toHaveAttribute('aria-pressed', 'false')

  await swipeTouch(page, writing, { dx: 8, dy: -100 })
  await expect(writing).toHaveText(second)

  await page.getByTestId('vocab-edit-card').tap()
  await expect(page.getByTestId('vocab-card-editor')).toBeVisible()
  await swipeTouch(page, page.getByTestId('vocab-edit-writing'))
  await expect(writing).toHaveText(second)
  await page.getByTestId('vocab-edit-cancel').tap()

  await page.getByTestId('vocab-mobile-session').locator('summary').tap()
  await swipeTouch(page, page.locator('.vocab-session-row-writing').first())
  await expect(writing).toHaveText(second)
})

test('vocab trainer: skip navigation preserves history without changing session counters', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Skip navigation covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('open-vocab-train').click()
  await page.getByTestId('start-vocab').click()

  const first = await page.getByTestId('vocab-current-writing').innerText()
  const sessionChips = page.getByTestId('session-chips').locator('.session-chip')
  const initialSessionChips = ['0 карточек', /^100% чисто/, /^серия 0/]
  await expect(sessionChips).toHaveText(initialSessionChips)
  await expect(page.getByTestId('vocab-skip-prev')).toBeDisabled()

  await page.getByTestId('vocab-skip-next').click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(first)
  await expect(page.getByTestId('vocab-skip-prev')).toBeEnabled()
  await expect(sessionChips).toHaveText(initialSessionChips)

  const second = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-skip-prev').click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(first)
  await expect(sessionChips).toHaveText(initialSessionChips)

  await page.getByTestId('vocab-skip-next').click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(second)
  await expect(sessionChips).toHaveText(initialSessionChips)
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

test('mine page nav and legacy redirect', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Mine URL covered on desktop.')
  await openFreshApp(page)
  await clickNav(page, 'nav-vocab')
  await expect(page).toHaveURL(/\/vocab$/)
  await expect(page.getByTestId('vocab-page')).toBeVisible()
  await expect(page.getByTestId('vocab-tab-mine')).toHaveCount(0)

  await clickNav(page, 'nav-mine')
  await expect(page).toHaveURL(/\/mine$/)
  await expect(page.getByTestId('mine-page')).toBeVisible()

  await page.goto('/vocab/mine')
  await expect(page).toHaveURL(/\/mine$/)
  await expect(page.getByTestId('mine-page')).toBeVisible()

  await page.getByTestId('nav-train').click()
  await expect(page).toHaveURL(/\/train$/)
  await expect(page.getByTestId('train-page')).toBeVisible()
})

test('dictionary: add and edit custom word', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Custom word flow covered on desktop.')
  await openFreshApp(page)
  await clickNav(page, 'nav-mine')
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

  await page.getByTestId('vocab-word-猫').click()
  const editButton = page.locator('[data-testid^="vocab-edit-"]').first()
  await editButton.click()
  await expect(page.getByTestId('custom-word-editing-label')).toBeVisible()
  await page.getByTestId('custom-word-romaji').fill('neko-san')
  await page.getByTestId('custom-word-meanings').fill('кот')
  await page.getByTestId('custom-word-submit').click()

  await expect(page.getByTestId('vocab-word-猫')).toContainText('кот')
  await expect(page.getByTestId('custom-word-editing-label')).toHaveCount(0)
  await page.getByTestId('vocab-word-猫').click()
  await page.locator('[data-testid^="vocab-edit-"]').first().click()
  await expect(page.getByTestId('custom-word-romaji')).toHaveValue('neko-san')
  await expect(page.getByTestId('custom-word-meanings')).toHaveValue('кот')
})
