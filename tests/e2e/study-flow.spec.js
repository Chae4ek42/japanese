import { test } from '@playwright/test'
import { expect, mockAccountsApi } from './helpers.js'

async function openStudyHome(page) {
  await mockAccountsApi(page)
  // Guard the shared seed so a real reload can test the saved study state.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('study-flow-seeded')) return
    sessionStorage.setItem('study-flow-seeded', '1')
    localStorage.clear()
    localStorage.setItem('jp-account-session-v1', JSON.stringify({
      token: 'e2e-token', accountId: 'acc_e2e_default', expiresAt: Date.now() + 86400000,
    }))
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('home-study-plan')).toBeVisible()
}

async function savedState(page) {
  // Exercise the app's page-hide persistence path without waiting for its debounce.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('jp-state-draft-v1:acc_e2e_default')))).toBe(true)
  return page.evaluate(() => JSON.parse(localStorage.getItem('jp-state-draft-v1:acc_e2e_default')))
}

for (const minutes of [5, 10, 20]) {
  test(`compact home creates an approximately ${minutes}-minute plan with pending steps`, async ({ page }, testInfo) => {
    await openStudyHome(page)
    const home = page.locator('.home-page')
    const plan = page.getByTestId('home-study-plan')
    await expect(home.locator('a[href="/particles"], a[href="/verbs"]')).toHaveCount(0)
    await expect(page.getByTestId('nav-particles')).toHaveCount(0)
    await expect(page.getByTestId('nav-verbs')).toHaveCount(0)
    await expect(page.getByTestId('home-open-srs')).toHaveCount(0)
    await expect(home.getByText(/SRS|Интервальн|Адаптивн/i)).toHaveCount(0)
    const duration = plan.getByRole('combobox', { name: 'Длительность занятия', exact: true })
    await expect(duration.locator('option')).toHaveText(['5 минут', '10 минут', '20 минут'])
    await duration.selectOption(String(minutes))
    await plan.getByRole('button', { name: 'Составить занятие', exact: true }).click()
    const disclosure = plan.locator('details')
    await expect(disclosure).not.toHaveAttribute('open', '')
    await expect(disclosure.locator('summary')).toHaveText(`План · около ${minutes} минут`)
    await expect(plan.getByRole('button', { name: 'Продолжить →', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`home-plan-${minutes}-${testInfo.project.name}.png`), fullPage: true })
    const { studyPlan } = await savedState(page)
    expect(studyPlan.minutes).toBe(minutes)
    expect(studyPlan.steps.length).toBe(minutes === 5 ? 2 : 3)
    expect(studyPlan.steps.every((step) => step.status === 'pending' && !step.completion)).toBe(true)
    expect(studyPlan.steps.every((step) => !['particles', 'verbs'].includes(step.page))).toBe(true)
    // Opening any next activity is navigation, not evidence of completion.
    await plan.getByRole('button', { name: 'Продолжить →', exact: true }).click()
    await expect(page.getByTestId('return-study-plan')).toBeVisible()
    await page.getByTestId('return-study-plan').click()
    await expect(plan).toBeVisible()
    const returned = (await savedState(page)).studyPlan
    expect(returned.createdAt).toBe(studyPlan.createdAt)
    expect(returned.steps.every((step) => step.status === 'pending' && !step.completion)).toBe(true)
  })
}

test('theory check measures plan progress separately from an explicit read mark and survives reload', async ({ page }, testInfo) => {
  await openStudyHome(page)
  const plan = page.getByTestId('home-study-plan')
  await plan.getByRole('button', { name: 'Составить занятие', exact: true }).click()
  const original = (await savedState(page)).studyPlan
  const theoryStep = original.steps.find((step) => step.kind === 'theory')
  expect(theoryStep).toBeTruthy()
  await plan.locator('summary').click()
  const lessonStep = plan.locator('li').filter({ has: page.locator('strong', { hasText: theoryStep.title }) })
  await lessonStep.getByRole('button', { name: 'Открыть', exact: true }).click()
  await expect(page.getByTestId('theory-page')).toBeVisible()
  const check = page.getByTestId('theory-lesson-check')
  await expect(check.getByRole('button', { name: 'Отметить как прочитанное', exact: true })).toBeVisible()
  let state = await savedState(page)
  expect(state.studyPlan.steps.find((step) => step.id === theoryStep.id).status).toBe('pending')
  expect(state.theory.lessons[theoryStep.targetIds[0]]?.checkAttempts ?? 0).toBe(0)
  expect(state.theory.lessons[theoryStep.targetIds[0]]?.readAt ?? null).toBeNull()
  // Fresh plan chooses this authored lesson; target it by its plan identity, not step order.
  expect(theoryStep.targetIds).toEqual(['ko-so-a-do'])
  await check.locator('fieldset').nth(0).getByRole('radio', { name: 'これ', exact: true }).check()
  await check.locator('fieldset').nth(1).getByRole('radio', { name: 'この', exact: true }).check()
  await check.getByRole('button', { name: 'Проверить ответы', exact: true }).click()
  await expect(check.getByRole('button', { name: 'Повторить проверку', exact: true })).toBeVisible()
  state = await savedState(page)
  const checked = state.theory.lessons[theoryStep.targetIds[0]]
  expect(checked.checkAttempts).toBe(1)
  expect(checked.lastScore).toBe(2)
  expect(checked.questionCount).toBe(2)
  expect(checked.readAt).toBeNull()
  await check.getByRole('button', { name: 'Отметить как прочитанное', exact: true }).click()
  await expect(check.getByRole('button', { name: 'Прочитано · ваша отметка', exact: true })).toBeVisible()
  await check.screenshot({ path: testInfo.outputPath(`theory-checked-${testInfo.project.name}.png`) })
  await page.getByTestId('return-study-plan').click()
  await expect(plan).toBeVisible()
  await plan.locator('summary').click()
  await expect(plan.getByText('Выполнено по результатам', { exact: true })).toBeVisible()
  state = await savedState(page)
  expect(state.theory.lessons[theoryStep.targetIds[0]].readAt).toBeGreaterThan(0)
  expect(state.studyPlan.steps.find((step) => step.id === theoryStep.id)).toMatchObject({ status: 'done', completion: 'measured' })
  expect(state.studyPlan.steps.filter((step) => step.id !== theoryStep.id).every((step) => step.status === 'pending')).toBe(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(plan).toBeVisible()
  await plan.locator('summary').click()
  await expect(plan.getByText('Выполнено по результатам', { exact: true })).toBeVisible()
  const restored = await savedState(page)
  expect(restored.studyPlan).toEqual(state.studyPlan)
  expect(restored.theory.lessons[theoryStep.targetIds[0]]).toEqual(state.theory.lessons[theoryStep.targetIds[0]])
})
