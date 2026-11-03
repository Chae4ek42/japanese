import { test } from '@playwright/test'
import { expect, mockAccountsApi } from './helpers.js'

async function openSeededTrainer(page) {
  await mockAccountsApi(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('adaptive-seeded')) return
    sessionStorage.setItem('adaptive-seeded', '1')
    localStorage.clear()
    localStorage.setItem('jp-account-session-v1', JSON.stringify({
      token: 'e2e-token', accountId: 'acc_e2e_default', expiresAt: Date.now() + 86400000,
    }))
    const customWords = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`custom:w${i}`, {
      id: `custom:w${i}`, writing: `語${i}`, kana: 'ことば', romaji: `kotoba${i}`, meanings: [`слово ${i}`], kanji: [],
    }]))
    localStorage.setItem('jp-state-draft-v1:acc_e2e_default', JSON.stringify({
      version: 32, vocab: {
        myWords: Object.keys(customWords), customWords, learnedWordIds: Object.keys(customWords),
        preferences: { sessionMode: 'drill', source: 'level', newWordLimit: 1,
          wordJlptLevels: [5], mineIncludeLearned: false, includeColloquial: false },
      },
    }))
  })
  await page.goto('/train', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('new-vocab-session').click()
  await expect(page.getByTestId('vocab-setup')).toBeVisible()
}

test('adaptive: full mine deck, sliding window, saved progress and fixed mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Typed recall flow covered on desktop.')
  await openSeededTrainer(page)
  await expect(page.getByTestId('vocab-session-mode-drill')).toHaveClass(/is-active/)
  await page.getByTestId('vocab-session-mode-adaptive').click()
  await expect(page.getByTestId('vocab-adaptive-deck')).toContainText('12 слов')
  await expect(page.getByTestId('vocab-source-level')).toHaveCount(0)
  await page.getByTestId('vocab-setup-more-toggle').click()
  await expect(page.getByTestId('vocab-word-jlpt-5')).toHaveCount(0)
  await expect(page.getByTestId('vocab-adaptive-in-flight')).toHaveCount(0)
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-session-mode-label')).toHaveText('Повторение')
  await expect(page.getByTestId('vocab-session-pick-even')).toHaveCount(0)
  await expect(page.getByTestId('vocab-session-pick-adaptive')).toHaveCount(0)
  await expect(page.locator('[data-testid^="vocab-session-word-"]')).toHaveCount(12)

  const shown = []
  for (let i = 0; i < 25; i++) {
    const writing = await page.getByTestId('vocab-current-writing').innerText()
    shown.push(writing)
    await page.getByTestId('vocab-answer-input').fill(`kotoba${writing.replace(/\D/g, '')}`)
    await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(writing)
  }
  expect(new Set(shown.slice(0, 6)).size).toBeLessThanOrEqual(5)
  expect(new Set(shown).size).toBeGreaterThan(5)
  await expect(page.getByTestId('vocab-adaptive-progress')).toContainText('В группе: 5')
  const current = await page.getByTestId('vocab-current-writing').innerText()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('new-vocab-session')).toBeVisible()
  await expect(page.getByTestId('vocab-current-writing')).toHaveCount(0)
  await page.getByTestId('vocab-session-card').filter({ has: page.getByRole('heading', { name: 'Тренировка 1', exact: true }) }).getByRole('button', { name: 'Продолжить', exact: true }).click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(current)
  await expect(page.getByTestId('vocab-session-mode-label')).toHaveText('Повторение')
  await expect(page.locator('[data-testid^="vocab-session-word-"]')).toHaveCount(12)
  // Skipping an unanswered card is a failure, never fabricated successful recall.
  await page.getByTestId('vocab-skip-next').click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(current)
  const id = current.replace(/\D/g, '')
  await expect(page.getByTestId(`vocab-session-word-custom:w${id}`)).toContainText('1✗')
  const accuracy = page.getByTestId(`vocab-session-accuracy-custom:w${id}`)
  const beforeHistory = await accuracy.getAttribute('title')
  await page.getByTestId('vocab-skip-prev').click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(current)
  await page.getByTestId('vocab-answer-input').fill(`kotoba${id}`)
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(current)
  await expect(accuracy).toHaveAttribute('title', beforeHistory)
  await page.screenshot({ path: testInfo.outputPath('adaptive-session.png'), fullPage: true })
})

test('adaptive mobile: explicit recall succeeds, hint followed by recall fails', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile self-assessment flow.')
  await openSeededTrainer(page)
  await page.getByTestId('vocab-session-mode-adaptive').click()
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-answer-input')).toHaveCount(0)
  const first = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-remember').click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(first)
  await expect(page.getByTestId('session-chips').locator('.session-chip')).toHaveText([
    '1 карточка', /^100% чисто/, /^серия 1/,
  ])
  const second = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-hint-button').click()
  await page.getByTestId('vocab-remember').click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(second)
  await expect(page.getByTestId('session-chips').locator('.session-chip')).toHaveText([
    '2 карточки', /^50% чисто/, /^серия 0/,
  ])
  await page.screenshot({ path: testInfo.outputPath('adaptive-mobile.png'), fullPage: true })
})
