import { test } from '@playwright/test'
import { expect, mockAccountsApi } from './helpers.js'

async function openSeededChooser(page) {
  await mockAccountsApi(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('repetition-sessions-seeded')) return
    sessionStorage.setItem('repetition-sessions-seeded', '1')
    localStorage.clear()
    localStorage.setItem('jp-account-session-v1', JSON.stringify({
      token: 'e2e-token', accountId: 'acc_e2e_default', expiresAt: Date.now() + 86400000,
    }))
    const customWords = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`custom:w${index}`, {
      id: `custom:w${index}`, writing: `語${index}`, kana: 'ことば', romaji: `kotoba${index}`,
      meanings: [`слово ${index}`], kanji: [],
    }]))
    const stats = Object.fromEntries(Object.keys(customWords).map((id, index) => {
      const recentAnswers = index < 10 ? Array(10).fill('wrong')
        : index === 10 ? [...Array(5).fill('wrong'), ...Array(10).fill('correct')]
          : Array(4).fill('wrong')
      return [id, {
        exposures: recentAnswers.length, clears: recentAnswers.filter((answer) => answer === 'correct').length,
        errors: recentAnswers.filter((answer) => answer === 'wrong').length, hints: 0, streak: 0, bestStreak: 0,
        mastery: 0.15, avgLatencyMs: 0, fastestLatencyMs: 0, lastSeenAt: Date.now(),
        lastClearAt: 0, lastErrorAt: Date.now(), lastHintAt: 0, eventAccuracy: 0, recentAnswers,
      }]
    }))
    localStorage.setItem('jp-state-draft-v1:acc_e2e_default', JSON.stringify({
      version: 32, vocab: {
        myWords: Object.keys(customWords), customWords, stats, trainingSessions: [], activeSessionId: null,
        preferences: { sessionMode: 'drill', drillMode: 'romaji', source: 'mine', reviewWindowSize: 5,
          reviewScope: 'all', reviewProblemLimit: 0 },
      },
    }))
  })
  await page.goto('/train', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('new-vocab-session')).toBeVisible()
  await expect(page.getByTestId('vocab-session-card')).toHaveCount(0)
  await expect(page.getByTestId('vocab-setup')).toHaveCount(0)
}

function sessionCard(page, name) {
  return page.getByTestId('vocab-session-card').filter({ has: page.getByRole('heading', { name, exact: true }) })
}

async function nameNewestSession(page, name) {
  const card = page.getByTestId('vocab-session-card').filter({ has: page.getByRole('heading', { name: /^Тренировка \d+$/ }) })
  await card.getByRole('button', { name: 'Переименовать', exact: true }).click()
  await page.locator('.vocab-session-rename').getByRole('textbox', { name: 'Название тренировки' }).fill(name)
  await page.locator('.vocab-session-rename').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(sessionCard(page, name)).toBeVisible()
}

async function readSessions(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  return page.evaluate(() => JSON.parse(localStorage.getItem('jp-state-draft-v1:acc_e2e_default') ?? '{}').vocab?.trainingSessions ?? [])
}

function progressSnapshot(session) {
  return {
    id: session.id,
    preferences: session.preferences,
    currentCardId: session.liveSession.currentCardId,
    poolIds: session.liveSession.session.poolIds,
    adaptive: session.liveSession.session.adaptive,
    counters: session.liveSession.sessionStats,
    navHistory: session.liveSession.navHistory,
    navIndex: session.liveSession.navIndex,
  }
}

async function waitForSavedSession(page, name, answered) {
  await expect.poll(async () => {
    const sessions = await readSessions(page)
    return sessions.find((session) => session.name === name)?.liveSession?.sessionStats.answered
  }).toBe(answered)
  return (await readSessions(page)).find((session) => session.name === name)
}

async function forgetOne(page) {
  const before = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-dont-know').click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(before)
}

test('two saved repetition sessions retain independent scope, window, pool and exact progress', async ({ page }) => {
  await openSeededChooser(page)

  await page.getByTestId('new-vocab-session').click()
  await expect(page.getByTestId('vocab-setup')).toBeVisible()
  await page.getByTestId('vocab-session-mode-adaptive').click()
  await expect(page.getByTestId('vocab-session-mode-adaptive')).toHaveText('Повторение')
  await page.getByTestId('vocab-review-window').fill('7')
  await page.getByTestId('vocab-review-problem').click()
  await page.getByTestId('vocab-review-problem-limit').fill('8')
  await expect(page.getByTestId('vocab-review-window')).toHaveValue('7')
  await expect(page.getByTestId('vocab-review-problem-limit')).toHaveValue('8')
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-current-writing')).toBeVisible()
  await forgetOne(page)
  const firstWriting = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-sessions-back').click()
  await nameNewestSession(page, 'Сложные: окно 7')
  const firstSaved = await waitForSavedSession(page, 'Сложные: окно 7', 1)
  expect(firstSaved.preferences).toMatchObject({ sessionMode: 'adaptive', reviewWindowSize: 7, reviewScope: 'problem', reviewProblemLimit: 8 })
  expect(firstSaved.liveSession.session.poolIds).toHaveLength(8)
  expect(firstSaved.liveSession.session.poolIds).not.toContain('custom:w10')
  expect(firstSaved.liveSession.session.poolIds).not.toContain('custom:w11')
  expect(firstSaved.liveSession.session.adaptive.windowSize).toBe(7)
  expect(firstSaved.liveSession.session.adaptive.active).toHaveLength(7)
  const firstSnapshot = progressSnapshot(firstSaved)
  await expect(sessionCard(page, 'Сложные: окно 7')).toContainText('Проблемные слова')
  await expect(sessionCard(page, 'Сложные: окно 7')).toContainText('Окно: 7')

  await page.getByTestId('new-vocab-session').click()
  await page.getByTestId('vocab-session-mode-adaptive').click()
  await page.getByTestId('vocab-review-all').click()
  await page.getByTestId('vocab-review-window').fill('3')
  await page.getByTestId('start-vocab').click()
  await expect(page.getByTestId('vocab-current-writing')).toBeVisible()
  await forgetOne(page)
  await forgetOne(page)
  const secondWriting = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-sessions-back').click()
  await nameNewestSession(page, 'Все: окно 3')
  const secondSaved = await waitForSavedSession(page, 'Все: окно 3', 2)
  expect(secondSaved.preferences).toMatchObject({ sessionMode: 'adaptive', reviewWindowSize: 3, reviewScope: 'all' })
  expect(secondSaved.liveSession.session.poolIds).toHaveLength(12)
  expect(secondSaved.liveSession.session.adaptive.windowSize).toBe(3)
  const secondSnapshot = progressSnapshot(secondSaved)
  expect(progressSnapshot((await readSessions(page)).find((session) => session.name === 'Сложные: окно 7'))).toEqual(firstSnapshot)

  await page.getByTestId('nav-main').click()
  await page.getByTestId('nav-train').click()
  await expect(page.getByTestId('vocab-session-card')).toHaveCount(2)
  await sessionCard(page, 'Сложные: окно 7').getByRole('button', { name: 'Продолжить', exact: true }).click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(firstWriting)
  await page.getByTestId('vocab-sessions-back').click()
  await sessionCard(page, 'Все: окно 3').getByRole('button', { name: 'Продолжить', exact: true }).click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(secondWriting)
  await page.getByTestId('vocab-sessions-back').click()

  await expect.poll(async () => (await readSessions(page)).map(progressSnapshot).sort((a, b) => a.id.localeCompare(b.id)))
    .toEqual([firstSnapshot, secondSnapshot].sort((a, b) => a.id.localeCompare(b.id)))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('vocab-session-card')).toHaveCount(2)
  expect((await readSessions(page)).map(progressSnapshot).sort((a, b) => a.id.localeCompare(b.id)))
    .toEqual([firstSnapshot, secondSnapshot].sort((a, b) => a.id.localeCompare(b.id)))

  for (const [name, writing] of [['Сложные: окно 7', firstWriting], ['Все: окно 3', secondWriting]]) {
    await sessionCard(page, name).getByRole('button', { name: 'Продолжить', exact: true }).click()
    await expect(page.getByTestId('vocab-current-writing')).toHaveText(writing)
    await page.getByTestId('vocab-sessions-back').click()
  }
})

test('leaving during successful feedback resumes after the recorded answer exactly once', async ({ page, isMobile }) => {
  await openSeededChooser(page)
  await page.getByTestId('new-vocab-session').click()
  await page.getByTestId('vocab-session-mode-adaptive').click()
  await page.getByTestId('start-vocab').click()
  const first = await page.getByTestId('vocab-current-writing').innerText()
  // Keep the feedback phase open long enough to navigate away deterministically.
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window)
    window.setTimeout = (callback, delay, ...args) => original(callback, delay === 280 ? 60000 : delay, ...args)
  })
  if (isMobile) await page.getByTestId('vocab-remember').click()
  else await page.getByTestId('vocab-answer-input').fill(`kotoba${first.replace(/\D/g, '')}`)
  await expect(page.getByTestId('session-chips').locator('.session-chip').first()).toHaveText('1 карточка')
  await page.getByTestId('vocab-sessions-back').click()
  const saved = await waitForSavedSession(page, 'Тренировка 1', 1)
  expect(saved.liveSession.pendingAdvance).toBe(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sessionCard(page, 'Тренировка 1').getByRole('button', { name: 'Продолжить', exact: true }).click()
  await expect(page.getByTestId('vocab-current-writing')).not.toHaveText(first)
  await expect(page.getByTestId('session-chips').locator('.session-chip').first()).toHaveText('1 карточка')
  const next = await page.getByTestId('vocab-current-writing').innerText()
  await page.getByTestId('vocab-sessions-back').click()
  expect((await waitForSavedSession(page, 'Тренировка 1', 1)).liveSession.pendingAdvance).toBeUndefined()
  await sessionCard(page, 'Тренировка 1').getByRole('button', { name: 'Продолжить', exact: true }).click()
  await expect(page.getByTestId('vocab-current-writing')).toHaveText(next)
})
