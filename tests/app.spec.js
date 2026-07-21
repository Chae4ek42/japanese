import { expect, test } from '@playwright/test'

async function openFreshApp(page) {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('nav-home').waitFor({ state: 'visible' })
}

async function openNumbersTrainer(page) {
  await page.getByTestId('nav-numbers').click()
}

test('home screen renders landing page', async ({ page }) => {
  await openFreshApp(page)
  await expect(page.getByTestId('nav-home')).toBeVisible()
  await expect(page.getByTestId('nav-kana')).toBeVisible()
  await expect(page.getByTestId('nav-kanji')).toBeVisible()
  await expect(page.getByTestId('nav-numbers')).toBeVisible()
  await expect(page.getByTestId('nav-vocab')).toBeVisible()
  await expect(page.getByTestId('open-kana')).toBeVisible()
  await expect(page.getByTestId('open-kanji')).toBeVisible()
  await expect(page.getByTestId('open-numbers')).toBeVisible()
  await expect(page.getByTestId('open-vocab')).toBeVisible()
  await expect(page.getByTestId('open-vocab-train')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'JP тренажёры' })).toBeVisible()
})

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

  await page.getByTestId('vocab-hint-button').click()
  const hint = await page.locator('.feedback.is-hint').innerText()
  const answer = hint.replace('Подсказка:', '').trim()
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

test('kanji section opens trainer from table', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Kanji flow covered on desktop.')
  await openFreshApp(page)
  await page.getByTestId('nav-kanji').click()
  await expect(page.getByTestId('kanji-page')).toBeVisible()
  await expect(page.getByTestId('kanji-level-N5')).toBeVisible()

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

  await page.getByTestId('kanji-reveal-word').click()
  await expect(page.getByTestId('kanji-reveal-word')).toHaveText('Показать')
  await expect(page.getByTestId('kanji-word-meanings')).toHaveCount(0)

  await page.getByTestId('kanji-chip-日').click()
  await expect(page.getByTestId('kanji-tip')).toBeVisible()
  await expect(page.getByTestId('kanji-tip')).toContainText('N5')

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

test('header navigates to kana trainer', async ({ page }) => {
  await openFreshApp(page)
  await page.getByTestId('nav-kana').click()
  await expect(page).toHaveURL(/\/kana$/)
  await expect(page.getByTestId('start-practice')).toBeVisible()

  await page.getByTestId('nav-main').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('open-kana')).toBeVisible()
})

test('deep links open sections from URL', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
  await page.goto('/vocab/train', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('vocab-setup')).toBeVisible()
  await expect(page).toHaveURL(/\/vocab\/train$/)

  await page.goto('/numbers', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('start-numbers')).toBeVisible()

  await page.goto('/unknown-path', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/$/)
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
