import { expect, test } from '@playwright/test'

async function openFreshApp(page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

async function startSingleCardPractice(page) {
  await page.getByTestId('clear-selection').click()
  await page.getByTestId('group-toggle-nn').click()
  await page.getByTestId('start-practice').click()
  await expect(page.getByTestId('current-symbol')).toHaveText('ん')
}

test('home screen renders core controls', async ({ page }) => {
  await openFreshApp(page)
  await expect(page.locator('h1')).toHaveText('Хирагана и катакана')
  await expect(page.getByTestId('start-practice')).toBeVisible()
  await expect(page.getByTestId('tab-stats')).toBeVisible()
  await expect(page.getByTestId('input-mode-instant')).toBeVisible()
  await expect(page.getByTestId('input-mode-submit')).toBeVisible()
  await expect(page.getByText('Возвращать ошибки через пару карточек')).toBeVisible()
})

test('group presets fill the selection', async ({ page }) => {
  await openFreshApp(page)

  await page.getByTestId('preset-dakuten').click()
  await expect(page.getByTestId('group-toggle-g')).toHaveClass(/is-active/)
  await expect(page.getByTestId('group-toggle-p')).toHaveClass(/is-active/)
  await expect(page.getByTestId('group-toggle-vowels')).not.toHaveClass(/is-active/)

  await page.getByTestId('preset-base').click()
  await expect(page.getByTestId('group-toggle-vowels')).toHaveClass(/is-active/)
  await expect(page.getByTestId('group-toggle-g')).not.toHaveClass(/is-active/)
})

test('single-card flow waits after hint until correct input', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed training flow is covered on desktop; mobile gets its own smoke test.')
  await openFreshApp(page)
  await startSingleCardPractice(page)

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

test('hint button reveals the answer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Covered by the mobile smoke test.')
  await openFreshApp(page)
  await startSingleCardPractice(page)

  await page.getByTestId('hint-button').click()
  await expect(page.getByText('Подсказка: n / nn')).toBeVisible()
  await expect(page.getByTestId('current-symbol')).toHaveText('ん')
})

test('submit mode requires Enter and reveals answer on mistake', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed training flow is covered on desktop.')
  await openFreshApp(page)

  await page.getByTestId('input-mode-submit').click()
  await startSingleCardPractice(page)

  const input = page.getByTestId('answer-input')

  await input.fill('x')
  await expect(page.locator('.practice-stage')).not.toHaveClass(/is-wrong/)

  await input.press('Enter')
  await expect(page.getByText(/Правильно: n \/ nn/)).toBeVisible()
  await expect(page.getByTestId('current-symbol')).toHaveText('ん')
  await expect(input).toHaveValue('')

  await input.fill('n')
  await expect(page.getByTestId('current-symbol')).toHaveText('ん')

  await input.press('Enter')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})

test('session chips track progress during practice', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed training flow is covered on desktop.')
  await openFreshApp(page)
  await startSingleCardPractice(page)

  await expect(page.getByTestId('session-chips')).toContainText('0 карточек')
  await page.getByTestId('answer-input').fill('n')
  await expect(page.getByTestId('session-chips')).toContainText('1 карточка')
  await expect(page.getByTestId('session-chips')).toContainText('серия 1')
})

test('info tooltips appear on hover', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Hover interactions are desktop-specific; on mobile tooltips open by tap (focus).')
  await openFreshApp(page)
  await page.getByTestId('tab-stats').click()

  const masteryCard = page.getByTestId('progress-Мастерство')
  await expect(page.locator('.info-tip-bubble.is-portal')).toHaveCount(0)

  await masteryCard.locator('.info-tip').hover()
  await expect(page.locator('.info-tip-bubble.is-portal')).toBeVisible()
  await expect(page.locator('.info-tip-bubble.is-portal')).toContainText('насколько уверенно вы знаете знак')
})

test('stats reflect practiced item', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed stats flow is covered on desktop.')
  await openFreshApp(page)
  await startSingleCardPractice(page)

  await page.getByTestId('answer-input').fill('n')
  await page.waitForTimeout(350)
  await page.getByTestId('tab-stats').click()

  await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
  await expect(page.getByTestId('metric-Верных ответов')).toContainText('1')
  await expect(page.getByTestId('activity-chart')).toBeVisible()
  await expect(page.getByTestId('mastery-map-hiragana')).toBeVisible()
  await expect(page.getByTestId('mastery-map-katakana')).toBeVisible()
  await expect(page.getByText('Проблемные карточки')).toBeVisible()
})

test('hinted card is not counted as clean answer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed stats flow is covered on desktop.')
  await openFreshApp(page)
  await startSingleCardPractice(page)

  await page.keyboard.press('Space')
  await page.getByTestId('answer-input').fill('n')
  await page.waitForTimeout(350)
  await page.getByTestId('tab-stats').click()

  await expect(page.getByTestId('metric-Верных ответов')).toContainText('0')
  await expect(page.getByTestId('metric-Подсказок')).toContainText('1')
})

test('confused answer is recorded in stats', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed stats flow is covered on desktop.')
  await openFreshApp(page)

  await page.getByTestId('input-mode-submit').click()
  await page.getByTestId('script-katakana').click()
  await page.getByTestId('clear-selection').click()
  await page.getByTestId('group-toggle-s').click()
  await page.getByTestId('group-toggle-t').click()
  await page.getByTestId('start-practice').click()

  const input = page.getByTestId('answer-input')
  const symbol = await page.getByTestId('current-symbol').textContent()
  const wrongAnswerBySymbol = { シ: 'tsu', ツ: 'shi' }
  const wrongAnswer = wrongAnswerBySymbol[symbol] ?? 'shi'
  const correctIsShi = symbol === 'シ'

  await input.fill(wrongAnswer)
  await input.press('Enter')
  await expect(page.getByText(/Правильно:/)).toBeVisible()

  // Путаница фиксируется, только если введен полный ответ другой карточки пула.
  if (correctIsShi || symbol === 'ツ') {
    await page.getByTestId('tab-stats').click()
    await expect(page.getByTestId('confusion-list')).toBeVisible()
    await expect(page.getByTestId('confusion-list')).toContainText('×1')
  }
})

async function getWordAnswer(page, kind) {
  // Достаем правильный ответ для текущего слова из датасета через модуль страницы.
  return page.evaluate(async (answerKind) => {
    const symbol = document.querySelector('[data-testid="current-word"]').textContent
    const module = await import('/src/data/words.js')
    const word = module.WORDS.find((entry) => entry.kanji === symbol)
    return answerKind === 'reading' ? module.getReadingAnswers(word)[0] : word.meanings[0]
  }, kind)
}

test('words: reading submit mode requires Enter', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed flow is covered on desktop.')
  await openFreshApp(page)

  await page.getByTestId('tab-words').click()
  await page.getByTestId('word-input-submit').click()
  await page.getByTestId('start-words').click()

  const input = page.getByTestId('word-input')
  const answer = await getWordAnswer(page, 'reading')

  await input.fill(answer.slice(0, 2))
  await expect(page.locator('.practice-stage')).not.toHaveClass(/is-success/)

  await input.fill(answer)
  await input.press('Enter')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})

test('words: reading mode accepts romaji without Enter', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed flow is covered on desktop.')
  await openFreshApp(page)

  await page.getByTestId('tab-words').click()
  await expect(page.getByTestId('word-answer-reading')).toHaveClass(/is-active/)
  await page.getByTestId('start-words').click()

  await expect(page.getByTestId('current-word')).toBeVisible()
  await expect(page.getByTestId('word-meanings')).toBeVisible()

  const answer = await getWordAnswer(page, 'reading')
  await page.getByTestId('word-input').fill(answer)
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
  await expect(page.getByTestId('session-chips')).toContainText('1 карточка')
})

test('words: translation mode hides meaning and requires Enter', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed flow is covered on desktop.')
  await openFreshApp(page)

  await page.getByTestId('tab-words').click()
  await page.getByTestId('word-answer-translation').click()
  await page.getByTestId('start-words').click()

  await expect(page.getByTestId('word-meanings-hidden')).toBeVisible()

  const input = page.getByTestId('word-input')
  await input.fill('заведомо неверный ответ')
  await input.press('Enter')
  await expect(page.getByText(/Правильно:/)).toBeVisible()
  await expect(page.getByTestId('word-meanings')).toBeVisible()

  const answer = await getWordAnswer(page, 'translation')
  await input.fill(answer)
  await input.press('Enter')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})

test('words: favorites toggle and favorites-only pool', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed flow is covered on desktop.')
  await openFreshApp(page)

  await page.getByTestId('tab-words').click()
  await page.getByTestId('toggle-word-list').click()
  await page.getByTestId('word-search').fill('окане')

  // Поиск по переводу «деньги» надежнее: найдем おかね по русскому значению.
  await page.getByTestId('word-search').fill('деньги')
  const star = page.getByTestId('fav-o-okane-9859876a')
  await star.click()
  await expect(star).toHaveClass(/is-active/)
  await expect(page.getByText('Только избранные (1)')).toBeVisible()

  await page.getByTestId('only-favorites').check()
  await page.getByTestId('start-words').click()
  await expect(page.getByTestId('current-word')).toHaveText('お金')

  // Избранное переживает перезагрузку.
  await page.reload()
  await page.getByTestId('tab-words').click()
  await expect(page.getByText('Только избранные (1)')).toBeVisible()
})

test('words: favorites-only start without favorites shows error', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Detailed flow is covered on desktop.')
  await openFreshApp(page)

  await page.getByTestId('tab-words').click()
  await page.getByTestId('only-favorites').check()
  await page.getByTestId('start-words').click()
  await expect(page.getByText(/В избранном пока нет слов/)).toBeVisible()
})

test('words mobile smoke: reading flow works', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only smoke test.')
  await openFreshApp(page)

  await page.getByTestId('tab-words').click()
  await page.getByTestId('start-words').click()
  await expect(page.getByTestId('current-word')).toBeVisible()

  await page.getByTestId('word-hint-button').click()
  await expect(page.getByText(/Чтение:/)).toBeVisible()

  const answer = await getWordAnswer(page, 'reading')
  await page.getByTestId('word-input').fill(answer)
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})

test('mobile smoke: practice with hint button works end to end', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only smoke test.')
  await openFreshApp(page)

  await expect(page.getByTestId('start-practice')).toBeVisible()
  await startSingleCardPractice(page)

  await expect(page.getByTestId('session-chips')).toBeVisible()
  await page.getByTestId('hint-button').click()
  await expect(page.getByText('Подсказка: n / nn')).toBeVisible()

  await page.getByTestId('answer-input').fill('n')
  await expect(page.locator('.practice-stage')).toHaveClass(/is-success/)
})
